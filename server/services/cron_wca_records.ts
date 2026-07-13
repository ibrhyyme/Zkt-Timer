import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace, fetchDataFromCache} from './redis';
import {sendPushToUser} from './push';
import {getWcaLiveData, fetchCompetitionRecords, formatRecordResult, WcaLiveRecordEntry} from './WcaLiveService';
import {WcaApiService} from './WcaApiService';
import {watchMatchesRecord, WatchRule, RecordCandidate} from './record_radar_match';
import WcaRecordBrokenNotification from '../resources/notification_types/wca_record_broken';

const TICK_LOCK_TTL_MS = 170_000; // < 3 min interval
const LOCK_KEY = createRedisKey(RedisNamespace.WCA_WCIF, 'record_radar_cron_lock');

export function initWcaRecordRadarCronJob() {
	const job = new CronJob(
		'0 */3 * * * *', // Every 3 minutes
		async () => {
			try {
				await runTick();
			} catch (err: any) {
				logger.error('[RecordRadar] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles',
	);
	logger.debug('[RecordRadar] cron initialized', {running: job.running});
}

function recordSignature(rec: WcaLiveRecordEntry): string {
	return `${rec.eventId}:${rec.type}:${rec.tag}:${rec.attemptResult}:${rec.personCountryIso2 || ''}`;
}

function dateStr(offsetDays: number): string {
	const d = new Date();
	d.setDate(d.getDate() + offsetDays);
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function userLocale(user: any): string {
	const locale = user?.settings?.locale;
	return locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(locale) ? locale : 'en';
}

async function runTick() {
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) {
		logger.info('[RecordRadar] tick skipped — busy');
		return;
	}

	try {
		const prisma = getPrisma();

		// 1) Load enabled watches. Zero watches => zero WCA load.
		const watches = await prisma.recordWatch.findMany({
			where: {enabled: true},
			include: {user: {include: {settings: true}}},
		});
		if (watches.length === 0) return;

		const watchedEvents = new Set<string>();
		for (const w of watches) {
			for (const e of w.events) watchedEvents.add(e);
		}

		// 2) Active competitions today whose events intersect the watched set.
		const todayMinus1 = dateStr(-1);
		const todayPlus1 = dateStr(1);
		// Cache the enumeration for 30 min so the main WCA REST API is hit ~2x/hour,
		// not every 3-minute tick. Active-comp membership doesn't change faster than this.
		let upcoming: any[];
		try {
			upcoming = await fetchDataFromCache(
				createRedisKey(RedisNamespace.WCA_COMPETITIONS, 'radar_active_enum'),
				() => WcaApiService.fetchUpcomingCompetitions(),
				30 * 60,
			);
		} catch (err: any) {
			logger.warn('[RecordRadar] fetchUpcomingCompetitions failed', {err: err?.message});
			return;
		}
		const activeComps = upcoming.filter((c: any) => {
			if (!(c.start_date <= todayPlus1 && c.end_date >= todayMinus1)) return false;
			const eventIds: string[] = c.event_ids || [];
			return eventIds.some((e) => watchedEvents.has(e));
		});
		if (activeComps.length === 0) return;

		let notifiedCount = 0;
		const sentTickKeys = new Set<string>(); // `${userId}:${signature}` — de-dupe overlapping watches

		for (const comp of activeComps) {
			try {
				const liveData = await getWcaLiveData(comp.id).catch(() => null);
				if (!liveData?.compId) continue;

				const records = await fetchCompetitionRecords(liveData.compId);
				if (records.length === 0) continue;

				const scanState = await prisma.wcaRecordScanState.findUnique({
					where: {competition_id: comp.id},
				});

				// FIRST SIGHT — seed baseline, notify nobody (retroactive-spam suppression).
				if (!scanState) {
					await prisma.wcaRecordSeen.createMany({
						data: records.map((r) => ({competition_id: comp.id, signature: recordSignature(r)})),
						skipDuplicates: true,
					});
					await prisma.wcaRecordScanState.create({data: {competition_id: comp.id}});
					continue;
				}

				const seenRows = await prisma.wcaRecordSeen.findMany({
					where: {competition_id: comp.id},
					select: {signature: true},
				});
				const seen = new Set(seenRows.map((s) => s.signature));

				const newRecords = records.filter((r) => !seen.has(recordSignature(r)));

				// Persist new signatures + bump scan time regardless of matches.
				if (newRecords.length > 0) {
					await prisma.wcaRecordSeen.createMany({
						data: newRecords.map((r) => ({competition_id: comp.id, signature: recordSignature(r)})),
						skipDuplicates: true,
					});
				}
				await prisma.wcaRecordScanState.update({
					where: {competition_id: comp.id},
					data: {last_scanned_at: new Date()},
				});

				// 3) Notify: for each new record, fan out to matching watches' users.
				for (const rec of newRecords) {
					const candidate: RecordCandidate = {
						eventId: rec.eventId,
						tag: rec.tag,
						personCountryIso2: rec.personCountryIso2,
					};
					const sig = recordSignature(rec);

					for (const w of watches) {
						const rule: WatchRule = {events: w.events, scope: w.scope, region: w.region};
						if (!watchMatchesRecord(rule, candidate)) continue;

						const dedupeKey = `${w.user_id}:${sig}`;
						if (sentTickKeys.has(dedupeKey)) continue;
						sentTickKeys.add(dedupeKey);

						await notifyRecord(comp, rec, w.user).catch((err: any) =>
							logger.warn('[RecordRadar] notify failed', {userId: w.user_id, err: err?.message}),
						);
						notifiedCount++;
					}
				}
			} catch (err: any) {
				logger.warn('[RecordRadar] competition scan failed', {compId: comp.id, err: err?.message});
			}
		}

		if (notifiedCount > 0) {
			logger.info(`[RecordRadar] sent ${notifiedCount} record notification(s)`);
		}
	} finally {
		await lock.release().catch(() => {});
	}
}

async function notifyRecord(comp: any, rec: WcaLiveRecordEntry, user: any): Promise<void> {
	const eventName = WcaApiService.getShortEventName(rec.eventId);
	const resultText = formatRecordResult(rec.attemptResult, rec.eventId, rec.type === 'average');
	const roundNumber = rec.roundNumber || 1;
	const locale = userLocale(user);

	const notif = new WcaRecordBrokenNotification(
		{user, triggeringUser: user, sendEmail: false},
		{
			competitionId: comp.id,
			competitionName: comp.name || '',
			eventId: rec.eventId,
			eventName,
			recordTag: rec.tag,
			resultText,
			personName: rec.personName,
			roundNumber,
			locale,
		},
	);

	await notif.send();
	await sendPushToUser(user.id, notif.subject(), notif.inAppMessage(), {
		type: 'wca_record_broken',
		competitionId: comp.id,
		eventId: rec.eventId,
		roundNumber: String(roundNumber),
	}).catch(() => {});
}
