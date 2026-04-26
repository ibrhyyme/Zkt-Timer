import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock} from './redis';
import {createRedisKey, RedisNamespace} from './redis';
import {sendPushToUser} from './push';
import {getWcaLiveData, fetchLiveRoundResults, formatCentiseconds, WcaLiveRoundData} from './WcaLiveService';
import WcaResultEnteredNotification from '../resources/notification_types/wca_result_entered';
import WcaRoundFinishedNotification from '../resources/notification_types/wca_round_finished';
import {WcaApiService} from './WcaApiService';
import {createI18nInstance} from '../i18n_server';

const TICK_LOCK_TTL_MS = 55_000;
const LOCK_KEY = createRedisKey(RedisNamespace.WCA_WCIF, 'notifications_cron_lock');

export function initWcaCompetitionNotificationCronJob() {
	const job = new CronJob(
		'0 * * * * *', // Her 1 dakikada bir
		async () => {
			try {
				await runTick();
			} catch (err: any) {
				logger.error('[WcaNotify] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles',
	);
	logger.debug('[WcaNotify] cron initialized', {running: job.running});
}

async function runTick() {
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) {
		logger.info('[WcaNotify] tick skipped — busy');
		return;
	}

	try {
		const prisma = getPrisma();

		// Aktif pencere: bugun -1 ile +2 gun arasi (timezone toleransi)
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		today.setDate(today.getDate() - 1);
		const tomorrow = new Date();
		tomorrow.setHours(23, 59, 59, 999);
		tomorrow.setDate(tomorrow.getDate() + 2);

		const states = await prisma.wcaCompetitionNotificationState.findMany({
			where: {
				start_date: {lte: tomorrow},
				end_date: {gte: today},
			},
			include: {
				notified_rounds: true,
				user: {
					include: {
						settings: true,
					},
				},
			},
		});

		if (states.length === 0) {
			logger.info('[WcaNotify] tick done', {states: 0, comps: 0, pushed: 0});
			return;
		}

		// Yarismaya gore grupla
		const byComp = new Map<string, typeof states>();
		for (const s of states) {
			if (!byComp.has(s.competition_id)) byComp.set(s.competition_id, []);
			byComp.get(s.competition_id)!.push(s);
		}

		let totalPushed = 0;
		for (const [compId, compStates] of byComp) {
			try {
				totalPushed += await processCompetition(compId, compStates);
			} catch (err: any) {
				logger.warn('[WcaNotify] comp failed', {compId, err: err?.message});
			}
		}

		logger.info('[WcaNotify] tick done', {
			states: states.length,
			comps: byComp.size,
			pushed: totalPushed,
		});
	} finally {
		try {
			await (lock as any).release();
		} catch {
			// ignore
		}
	}
}

type StateRow = Awaited<ReturnType<typeof loadStates>>[number];
async function loadStates() {
	return getPrisma().wcaCompetitionNotificationState.findMany({
		include: {
			notified_rounds: true,
			user: {include: {settings: true}},
		},
	});
}

function getUserLocale(state: StateRow): string {
	const locale = (state.user as any)?.settings?.locale;
	return locale && ['tr', 'en', 'es', 'ru'].includes(locale) ? locale : 'tr';
}

async function processCompetition(compId: string, states: StateRow[]): Promise<number> {
	const liveData = await getWcaLiveData(compId).catch(() => null);
	if (!liveData) return 0;

	// Hizli erisim icin map'ler — bos string key'leri kabul etme
	const byWcaId = new Map<string, StateRow>();
	const byName = new Map<string, StateRow>();
	for (const s of states) {
		if (s.wca_id && s.wca_id.trim()) byWcaId.set(s.wca_id, s);
		if (s.person_name && s.person_name.trim()) byName.set(s.person_name, s);
	}

	// Event basina max round numarasi (final tespiti icin)
	const maxRoundByEvent = new Map<string, number>();
	for (const rm of liveData.roundMap) {
		const m = rm.activityCode.match(/^(.+)-r(\d+)$/);
		if (!m) continue;
		const [, eventId, n] = m;
		const num = parseInt(n, 10);
		if (!maxRoundByEvent.has(eventId) || maxRoundByEvent.get(eventId)! < num) {
			maxRoundByEvent.set(eventId, num);
		}
	}

	let pushed = 0;
	let allFinished = true;

	for (const rm of liveData.roundMap) {
		let round: WcaLiveRoundData | null;
		try {
			round = await fetchLiveRoundResults(rm.liveRoundId);
		} catch (err: any) {
			logger.warn('[WcaNotify] round fetch failed', {
				compId,
				liveRoundId: rm.liveRoundId,
				err: err?.message,
			});
			allFinished = false;
			continue;
		}
		if (!round) {
			allFinished = false;
			continue;
		}
		if (!round.finished) allFinished = false;

		// Activity code parsing
		const m = rm.activityCode.match(/^(.+)-r(\d+)$/);
		if (!m) continue;
		const [, eventId, roundNumStr] = m;
		const roundNumber = parseInt(roundNumStr, 10);
		const eventName = WcaApiService.getShortEventName(eventId);
		const isFinal = maxRoundByEvent.get(eventId) === roundNumber;

		for (const result of round.results) {
			const state =
				(result.personWcaId && byWcaId.get(result.personWcaId)) ||
				byName.get(result.personName);
			if (!state) continue;

			const existingNr = state.notified_rounds.find((nr) => nr.activity_code === rm.activityCode);

			// --- Sonuc girildi bildirimi ---
			if (result.best && result.best > 0 && !existingNr?.result_notified) {
				try {
					await sendResultEntered(
						state,
						compId,
						eventId,
						eventName,
						roundNumber,
						result,
						round.numberOfAttempts,
					);
					await upsertNotifiedRound(state.id, rm.activityCode, {result_notified: true});
					pushed++;
				} catch (err: any) {
					logger.warn('[WcaNotify] result push failed', {
						compId,
						userId: state.user_id,
						err: err?.message,
					});
				}
			}

			// --- Round bitti bildirimi ---
			if (round.finished && !existingNr?.finish_notified) {
				try {
					await sendRoundFinished(
						state,
						compId,
						eventId,
						eventName,
						roundNumber,
						result,
						isFinal,
					);
					await upsertNotifiedRound(state.id, rm.activityCode, {finish_notified: true});
					pushed++;
				} catch (err: any) {
					logger.warn('[WcaNotify] finish push failed', {
						compId,
						userId: state.user_id,
						err: err?.message,
					});
				}
			}
		}
	}

	// --- Auto-cleanup: tum roundlar bitti ve yarisma tarihi gecti ---
	if (allFinished && states.length > 0) {
		const endDate = states[0].end_date;
		const now = new Date();
		now.setHours(0, 0, 0, 0);
		const cleanupCutoff = new Date(endDate);
		cleanupCutoff.setDate(cleanupCutoff.getDate() + 1);

		if (now > cleanupCutoff) {
			await getPrisma().wcaCompetitionNotificationState.deleteMany({
				where: {competition_id: compId},
			});
			logger.info('[WcaNotify] comp auto-cleaned', {compId});
		}
	}

	return pushed;
}

async function sendResultEntered(
	state: StateRow,
	competitionId: string,
	eventId: string,
	eventName: string,
	roundNumber: number,
	result: {best: number; average: number},
	numberOfAttempts: number,
) {
	const locale = getUserLocale(state);
	const i18n = createI18nInstance(locale);
	const t = (key: string, vars?: any) => i18n.t(`my_schedule.${key}`, vars) as string;

	const bestText = formatCentiseconds(result.best, eventId);
	const hasAverage = result.average && result.average > 0;
	const avgText = hasAverage ? formatCentiseconds(result.average, eventId) : '';
	const isBo1 = numberOfAttempts === 1;

	const body = isBo1 || !hasAverage
		? t('notif_result_body_single_only', {single: bestText})
		: t('notif_result_body_avg_single', {avg: avgText, single: bestText});

	const notif = new WcaResultEnteredNotification(
		{
			user: state.user as any,
			triggeringUser: state.user as any,
			sendEmail: false,
		},
		{
			competitionId,
			competitionName: '',
			eventId,
			eventName,
			roundNumber,
			resultText: body,
			locale,
		},
	);

	const title = notif.subject();

	await notif.send().catch((err: any) => {
		logger.warn('[WcaNotify] result notif DB write failed', {err: err?.message});
	});

	await sendPushToUser(state.user_id, title, body, {
		type: 'wca_result_entered',
		competitionId,
		eventId,
		roundNumber: String(roundNumber),
	}).catch((err: any) => {
		logger.warn('[WcaNotify] result push send failed', {err: err?.message});
	});
}

async function sendRoundFinished(
	state: StateRow,
	competitionId: string,
	eventId: string,
	eventName: string,
	roundNumber: number,
	result: {ranking?: number; advancing: boolean; advancingQuestionable: boolean},
	isFinal: boolean,
) {
	const locale = getUserLocale(state);
	const ranking = result.ranking ?? 0;

	const notif = new WcaRoundFinishedNotification(
		{
			user: state.user as any,
			triggeringUser: state.user as any,
			sendEmail: false,
		},
		{
			competitionId,
			competitionName: '',
			eventId,
			eventName,
			roundNumber,
			ranking,
			advancing: result.advancing,
			advancingQuestionable: result.advancingQuestionable,
			isFinal,
			locale,
		},
	);

	const title = notif.subject();
	const body = notif.inAppMessage();

	await notif.send().catch((err: any) => {
		logger.warn('[WcaNotify] finish notif DB write failed', {err: err?.message});
	});

	await sendPushToUser(state.user_id, title, body, {
		type: 'wca_round_finished',
		competitionId,
		eventId,
		roundNumber: String(roundNumber),
	}).catch((err: any) => {
		logger.warn('[WcaNotify] finish push send failed', {err: err?.message});
	});
}

async function upsertNotifiedRound(
	stateId: string,
	activityCode: string,
	patch: {result_notified?: boolean; finish_notified?: boolean},
) {
	await getPrisma().wcaCompetitionNotifiedRound.upsert({
		where: {state_id_activity_code: {state_id: stateId, activity_code: activityCode}},
		create: {
			state_id: stateId,
			activity_code: activityCode,
			result_notified: patch.result_notified ?? false,
			finish_notified: patch.finish_notified ?? false,
		},
		update: patch,
	});
}
