import {getPrisma} from '../database';
import {logger} from './logger';
import {getWcaLiveData, fetchLiveRoundResults} from './WcaLiveService';

/**
 * If a user is registered and accepted for a WCA competition, create dedup state.
 * If it already exists, no-op. After creation, existing results are retroactively
 * marked "notified" so we don't send spam push notifications for old results.
 *
 * This function is called fire-and-forget from competition detail resolver.
 */
export async function ensureNotificationState(
	userId: string,
	competitionId: string,
	wcaId: string,
	personName: string,
	scheduleStartDate: string, // ISO date, e.g. "2026-04-11"
	numberOfDays: number,
): Promise<void> {
	const prisma = getPrisma();

	// Date calculations — start_date and end_date (last day inclusive)
	const startDate = new Date(scheduleStartDate);
	if (isNaN(startDate.getTime())) {
		logger.warn('[WcaNotify] invalid scheduleStartDate', {competitionId, scheduleStartDate});
		return;
	}
	const endDate = new Date(startDate);
	endDate.setDate(endDate.getDate() + Math.max(0, numberOfDays - 1));

	// Don't create state if competition is finished
	const cutoff = new Date();
	cutoff.setDate(cutoff.getDate() - 1); // 1 day tolerance
	if (endDate < cutoff) {
		return;
	}

	// Already exists?
	const existing = await prisma.wcaCompetitionNotificationState.findUnique({
		where: {user_id_competition_id: {user_id: userId, competition_id: competitionId}},
		select: {id: true},
	});
	if (existing) {
		return; // Already tracked
	}

	// Create new state + retroactive suppression
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

		// Fetch current round status from WCA Live and suppress old results
		try {
			const liveData = await getWcaLiveData(competitionId);
			if (liveData) {
				for (const rm of liveData.roundMap) {
					try {
						const round = await fetchLiveRoundResults(rm.liveRoundId);
						if (!round) continue;

						// Does user have a result in this round?
						const userResult = round.results.find(
							(r) => (r.personWcaId && r.personWcaId === wcaId) || r.personName === personName,
						);

						// If user has result or round is finished: mark notified
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
			// Retroactive step failed: safe side — mark all rounds as notified,
			// no risk of spam for old results
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
		// Race condition: if two requests arrive simultaneously, unique constraint fails silently
		if (err?.code !== 'P2002') {
			logger.warn('[WcaNotify] ensureNotificationState create failed', {
				userId,
				competitionId,
				err: err?.message,
			});
		}
	}
}
