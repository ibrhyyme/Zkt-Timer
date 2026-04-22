import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace, fetchDataFromCache} from './redis';
import {sendPushToUser} from './push';
import {WcaApiService} from './WcaApiService';
import WcaCompetitionCountdownNotification from '../resources/notification_types/wca_competition_countdown';

const TICK_LOCK_TTL_MS = 60 * 60 * 1000; // 1 saat
const LOCK_KEY = createRedisKey(RedisNamespace.WCA_WCIF, 'countdown_cron_lock');
const DAYS_BEFORE = [7, 3, 1];
const WCIF_CACHE_TTL = 60 * 60; // 1 saat

export function initWcaCompetitionCountdownCronJob() {
	// Her gun 09:00 (America/Los_Angeles) — TR saatiyle ~19:00
	const job = new CronJob(
		'0 0 9 * * *',
		async () => {
			try {
				await runTick();
			} catch (err: any) {
				logger.error('[WcaCountdown] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles',
	);
	logger.debug('[WcaCountdown] cron initialized', {running: job.running});
}

async function runTick() {
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) {
		logger.info('[WcaCountdown] tick skipped — busy');
		return;
	}

	try {
		const prisma = getPrisma();

		// Hedef tarihler: bugun + 7 / + 3 / + 1
		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const targetDates = DAYS_BEFORE.map((days) => {
			const d = new Date(today);
			d.setDate(d.getDate() + days);
			return {days, date: d};
		});

		// Tek query: tum hedef tarihlerde baslayan state'leri cek
		const minDate = targetDates[0].date; // en uzak (7 gun sonra)
		const maxDate = targetDates[targetDates.length - 1].date; // en yakin (1 gun sonra)
		const rangeMin = minDate < maxDate ? minDate : maxDate;
		const rangeMax = minDate < maxDate ? maxDate : minDate;

		const states = await prisma.wcaCompetitionNotificationState.findMany({
			where: {
				start_date: {gte: rangeMin, lte: rangeMax},
			},
			include: {
				notified_countdowns: true,
				user: {include: {settings: true}},
			},
		});

		if (states.length === 0) {
			logger.info('[WcaCountdown] tick done', {states: 0, pushed: 0});
			return;
		}

		let pushed = 0;
		const wcifCache = new Map<string, any>();

		for (const state of states) {
			try {
				// Hangi gune duser? (start_date - today)
				const stateStartDate = new Date(state.start_date);
				stateStartDate.setHours(0, 0, 0, 0);
				const diffMs = stateStartDate.getTime() - today.getTime();
				const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24));

				if (!DAYS_BEFORE.includes(daysUntil)) continue;

				// Daha once bu gun icin gonderilmis mi?
				const alreadySent = state.notified_countdowns.some((n) => n.days_before === daysUntil);
				if (alreadySent) continue;

				// WCIF'ten baslangic saatini cek (cache'li)
				let wcif = wcifCache.get(state.competition_id);
				if (!wcif) {
					wcif = await fetchDataFromCache(
						createRedisKey(RedisNamespace.WCA_WCIF, state.competition_id),
						() => WcaApiService.fetchCompetitionWcif(state.competition_id),
						WCIF_CACHE_TTL,
					);
					wcifCache.set(state.competition_id, wcif);
				}

				const startTime = extractFirstDayStartTime(wcif, state.start_date);
				const compName = wcif?.name || wcif?.shortName || state.competition_id;
				const locale = getUserLocale(state);

				const notif = new WcaCompetitionCountdownNotification(
					{
						user: state.user as any,
						triggeringUser: state.user as any,
						sendEmail: false,
					},
					{
						competitionId: state.competition_id,
						competitionName: compName,
						daysBefore: daysUntil,
						startTime: startTime || undefined,
						locale,
					},
				);

				await notif.send().catch((err: any) => {
					logger.warn('[WcaCountdown] DB notif write failed', {
						userId: state.user_id,
						compId: state.competition_id,
						err: err?.message,
					});
				});

				await sendPushToUser(state.user_id, notif.subject(), notif.inAppMessage(), {
					type: 'wca_competition_countdown',
					competitionId: state.competition_id,
					daysBefore: String(daysUntil),
				}).catch((err: any) => {
					logger.warn('[WcaCountdown] push send failed', {
						userId: state.user_id,
						compId: state.competition_id,
						err: err?.message,
					});
				});

				await prisma.wcaCompetitionCountdownNotified.create({
					data: {
						state_id: state.id,
						days_before: daysUntil,
					},
				});

				pushed++;
			} catch (err: any) {
				logger.warn('[WcaCountdown] state failed', {
					stateId: state.id,
					err: err?.message,
				});
			}
		}

		logger.info('[WcaCountdown] tick done', {states: states.length, pushed});
	} finally {
		try {
			await (lock as any).release();
		} catch {
			// ignore
		}
	}
}

function getUserLocale(state: {user?: any}): string {
	const locale = state.user?.settings?.locale;
	return locale && ['tr', 'en', 'es', 'ru'].includes(locale) ? locale : 'tr';
}

// WCIF schedule'dan ilk gunun en erken activity startTime'ini cek
// WCA API UTC dondurur; venue.timezone ile yerel saate cevirip goster
function extractFirstDayStartTime(wcif: any, startDate: Date): string | null {
	const venues = wcif?.schedule?.venues;
	if (!Array.isArray(venues) || venues.length === 0) return null;

	const targetDateStr = startDate.toISOString().slice(0, 10); // "YYYY-MM-DD"
	let earliestMs: number | null = null;
	let venueTimezone: string | null = null;

	for (const venue of venues) {
		const tz = typeof venue.timezone === 'string' ? venue.timezone : null;
		for (const room of venue.rooms || []) {
			for (const activity of room.activities || []) {
				const iso = activity?.startTime;
				if (typeof iso !== 'string') continue;
				if (!iso.startsWith(targetDateStr)) continue;
				const ms = new Date(iso).getTime();
				if (isNaN(ms)) continue;
				if (earliestMs === null || ms < earliestMs) {
					earliestMs = ms;
					venueTimezone = tz;
				}
			}
		}
	}

	if (earliestMs === null) return null;

	if (venueTimezone) {
		try {
			const parts = new Intl.DateTimeFormat('en-GB', {
				timeZone: venueTimezone,
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			}).formatToParts(new Date(earliestMs));
			const hour = parts.find((p) => p.type === 'hour')?.value;
			const minute = parts.find((p) => p.type === 'minute')?.value;
			if (hour && minute) return `${hour}:${minute}`;
		} catch {
			// bilinmeyen timezone ise UTC'ye duser
		}
	}

	// Fallback: UTC saat (timezone yoksa veya hatali)
	const utcMatch = new Date(earliestMs).toISOString().match(/T(\d{2}):(\d{2})/);
	return utcMatch ? `${utcMatch[1]}:${utcMatch[2]}` : null;
}
