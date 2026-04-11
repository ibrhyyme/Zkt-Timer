import {getPrisma} from '../database';
import {logger} from './logger';
import {getWcaLiveData, fetchLiveRoundResults} from './WcaLiveService';

/**
 * Kullanici bir WCA yarismasina kayitli ve accepted ise dedup state olustur.
 * Halihazirda olusmussa no-op. Olustuktan sonra mevcut sonuclar retroactive olarak
 * "notified" isaretlenir ki kullaniciya eski sonuclardan spam push atmasin.
 *
 * Bu fonksiyon yarisma detay resolver'indan fire-and-forget cagrilir.
 */
export async function ensureNotificationState(
	userId: string,
	competitionId: string,
	wcaId: string,
	personName: string,
	scheduleStartDate: string, // ISO date, orn. "2026-04-11"
	numberOfDays: number,
): Promise<void> {
	const prisma = getPrisma();

	// Tarih hesaplamalari — start_date ve end_date (son gun dahil)
	const startDate = new Date(scheduleStartDate);
	if (isNaN(startDate.getTime())) {
		logger.warn('[WcaNotify] invalid scheduleStartDate', {competitionId, scheduleStartDate});
		return;
	}
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + Math.max(0, numberOfDays - 1));

	// Yarisma bitmisse state kurma
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 1); // 1 gun tolerans
	if (endDate < cutoff) {
		return;
	}

	// Zaten var mi?
	const existing = await prisma.wcaCompetitionNotificationState.findUnique({
		where: {user_id_competition_id: {user_id: userId, competition_id: competitionId}},
		select: {id: true},
	});
	if (existing) {
		return; // Zaten takipte
	}

	// Yeni state olustur + retroactive suppression
	try {
		const state = await prisma.wcaCompetitionNotificationState.create({
			data: {
				user_id: userId,
				competition_id: competitionId,
				wca_id: wcaId,
				person_name: personName,
				start_date: startDate,
				end_date: endDate,
			},
		});

		// WCA Live'dan mevcut round durumunu cek ve gecmis sonuclari suppress et
		try {
			const liveData = await getWcaLiveData(competitionId);
			if (liveData) {
				for (const rm of liveData.roundMap) {
					try {
						const round = await fetchLiveRoundResults(rm.liveRoundId);
						if (!round) continue;

						// Kullanicinin bu round'da sonucu var mi?
						const userResult = round.results.find(
							(r) => (r.personWcaId && r.personWcaId === wcaId) || r.personName === personName,
						);

						// Sonuc varsa veya round bitmisse: notified isaretle
						const hasResult = userResult && userResult.best > 0;
						const isFinished = round.finished;

						if (hasResult || isFinished) {
							await prisma.wcaCompetitionNotifiedRound.upsert({
								where: {
									state_id_activity_code: {
										state_id: state.id,
										activity_code: rm.activityCode,
									},
								},
								create: {
									state_id: state.id,
									activity_code: rm.activityCode,
									result_notified: !!hasResult,
									finish_notified: isFinished,
								},
								update: {
									result_notified: hasResult ? true : undefined,
									finish_notified: isFinished ? true : undefined,
								},
							});
						}
					} catch (err: any) {
						logger.warn('[WcaNotify] ensure round fetch failed', {
							competitionId,
							liveRoundId: rm.liveRoundId,
							err: err?.message,
						});
					}
				}
			}
		} catch (err: any) {
			// Retroactive adim hata verdi: guvenli taraf — tum roundlari notified isaretle,
			// eski sonuclar icin spam atma riski yok
			logger.warn('[WcaNotify] retroactive suppression failed, marking all rounds as notified', {
				competitionId,
				err: err?.message,
			});
			try {
				const liveData = await getWcaLiveData(competitionId).catch(() => null);
				if (liveData) {
					for (const rm of liveData.roundMap) {
						await prisma.wcaCompetitionNotifiedRound.upsert({
							where: {
								state_id_activity_code: {
									state_id: state.id,
									activity_code: rm.activityCode,
								},
							},
							create: {
								state_id: state.id,
								activity_code: rm.activityCode,
								result_notified: true,
								finish_notified: true,
							},
							update: {result_notified: true, finish_notified: true},
						});
					}
				}
			} catch (inner: any) {
				logger.warn('[WcaNotify] fallback suppression failed', {err: inner?.message});
			}
		}

		logger.info('[WcaNotify] state created', {userId, competitionId});
	} catch (err: any) {
		// Race condition: ayni anda iki request gelirse unique constraint patlar, sessizce gec
		if (err?.code !== 'P2002') {
			logger.warn('[WcaNotify] ensureNotificationState create failed', {
				userId,
				competitionId,
				err: err?.message,
			});
		}
	}
}
