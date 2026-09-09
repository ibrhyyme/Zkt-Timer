import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace, fetchDataFromCache} from './redis';
import {sendPushToUser} from './push';
import {getWcaLiveData, fetchCompetitionRecords, formatRecordResult, WcaLiveRecordEntry} from './WcaLiveService';
import {WcaApiService} from './WcaApiService';
import {watchMatchesRecord, WatchRule, RecordCandidate} from './record_radar_match';
import {ZktFederationService} from './ZktFederationService';
import {ZKT_PREFIX} from './ZktWcaAdapter';
import RecordBrokenNotification, {RecordSource} from '../resources/notification_types/record_broken';

const TICK_LOCK_TTL_MS = 170_000; // < 3 min interval
const LOCK_KEY = createRedisKey(RedisNamespace.WCA_WCIF, 'record_radar_cron_lock');

// The ZKT competition list changes far more slowly than the 3-minute tick, so
// cache the enumeration the same way the WCA one is cached.
const ZKT_LIST_TTL = 15 * 60;

// How far past a ZKT competition's end date to keep scanning it.
//
// A ZKT national record row is only written when the round is FINISHED, and
// organizers routinely finalize the last rounds the following morning. The WCA
// branch's ±1 day is enough there because WCA Live tags records as results are
// entered; here a 1-day tail would silently drop every late-finalized record.
const ZKT_FINALIZE_TAIL_DAYS = -3;

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

/**
 * De-dupe key for one record within one competition.
 *
 * Deliberately a value signature rather than the source's own row id. The ZKT
 * federation rebuilds its record rows whenever a round is re-finalized — routine
 * when an organizer reopens a round to fix a typo — and the rebuilt rows carry
 * fresh UUIDs. Keying on the id would re-announce an unchanged record every time
 * that happens; keying on the value does not, while a genuinely corrected value
 * still reads as new, which is what you want.
 */
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

/**
 * Is this ZKT competition worth scanning on this tick?
 *
 * Exported for tests. `from`/`to` are `YYYY-MM-DD`; the federation returns full
 * ISO datetimes, so the dates are sliced before comparing — comparing
 * "2026-09-09T00:00:00.000Z" against "2026-09-09" as strings is always false.
 */
export function isZktCompActiveForRadar(
	item: any,
	to: string,
	from: string,
	watchedEvents: Set<string>,
): boolean {
	if (!item) return false;
	// Cancelled competitions stay in the public list but can never produce a record.
	if (String(item.status).toUpperCase() === 'CANCELLED') return false;

	const start = String(item.startDate || '').slice(0, 10);
	const end = String(item.endDate || '').slice(0, 10);
	if (!start || !end) return false;
	if (!(start <= to && end >= from)) return false;

	const eventIds: string[] = item.eventIds || [];
	return eventIds.some((e) => watchedEvents.has(e));
}

async function runTick() {
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) {
		logger.info('[RecordRadar] tick skipped — busy');
		return;
	}

	try {
		const prisma = getPrisma();

		// Load enabled watches. Zero watches => zero load on either authority.
		const watches = await prisma.recordWatch.findMany({
			where: {enabled: true},
			include: {user: {include: {settings: true}}},
		});
		if (watches.length === 0) return;

		const watchedEvents = new Set<string>();
		for (const w of watches) {
			for (const e of w.events) watchedEvents.add(e);
		}

		// Shared across both scans so a user whose two overlapping rules match the
		// same record is still notified once.
		const sentTickKeys = new Set<string>(); // `${userId}:${signature}`

		// The two authorities are independent: a WCA Live outage must not stop ZKT
		// records being announced, and vice versa.
		const [wcaCount, zktCount] = await Promise.all([
			runWcaScan(prisma, watches, watchedEvents, sentTickKeys).catch((err: any) => {
				logger.warn('[RecordRadar] WCA scan failed', {err: err?.message});
				return 0;
			}),
			runZktScan(prisma, watches, watchedEvents, sentTickKeys).catch((err: any) => {
				logger.warn('[RecordRadar] ZKT scan failed', {err: err?.message});
				return 0;
			}),
		]);

		const notifiedCount = wcaCount + zktCount;
		if (notifiedCount > 0) {
			logger.info(`[RecordRadar] sent ${notifiedCount} record notification(s)`, {wca: wcaCount, zkt: zktCount});
		}
	} finally {
		await lock.release().catch(() => {});
	}
}

async function runWcaScan(
	prisma: any,
	watches: any[],
	watchedEvents: Set<string>,
	sentTickKeys: Set<string>,
): Promise<number> {
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
		return 0;
	}

	const activeComps = upcoming.filter((c: any) => {
		if (!(c.start_date <= todayPlus1 && c.end_date >= todayMinus1)) return false;
		const eventIds: string[] = c.event_ids || [];
		return eventIds.some((e) => watchedEvents.has(e));
	});
	if (activeComps.length === 0) return 0;

	let notifiedCount = 0;

	for (const comp of activeComps) {
		try {
			// WCA needs the id translated: the records query keys on WCA Live's own
			// numeric competition id, not the WCA competition id.
			const liveData = await getWcaLiveData(comp.id).catch(() => null);
			if (!liveData?.compId) continue;

			const records = await fetchCompetitionRecords(liveData.compId);

			notifiedCount += await scanCompetition(prisma, {
				source: 'WCA',
				competitionId: comp.id,
				competitionName: comp.name || '',
				records,
				watches,
				sentTickKeys,
			});
		} catch (err: any) {
			logger.warn('[RecordRadar] competition scan failed', {compId: comp.id, err: err?.message});
		}
	}

	return notifiedCount;
}

async function runZktScan(
	prisma: any,
	watches: any[],
	watchedEvents: Set<string>,
	sentTickKeys: Set<string>,
): Promise<number> {
	// A ZKT record is always an NR held by a TR competitor, so only an NR/TR watch
	// can ever match one. With none on file, skip the federation entirely.
	if (!watches.some((w) => w.scope === 'NR' && w.region === 'TR')) return 0;

	const to = dateStr(1);
	const from = dateStr(ZKT_FINALIZE_TAIL_DAYS);

	const payload = await fetchDataFromCache(
		createRedisKey(RedisNamespace.ZKT_FED_LIST, 'radar_active_enum'),
		() => ZktFederationService.fetchCompetitions({page: 0, pageSize: 100}),
		ZKT_LIST_TTL,
	);

	const activeComps = ((payload as any)?.items || []).filter((c: any) =>
		isZktCompActiveForRadar(c, to, from, watchedEvents),
	);
	if (activeComps.length === 0) return 0;

	let notifiedCount = 0;

	for (const comp of activeComps) {
		// Unlike WCA, no id translation step: `fetchCompetitionRecords` resolves a
		// `zkt-` id against the federation itself. Routing through `getWcaLiveData`
		// here would pull the competition's entire detail payload only to hand back
		// the string we already have.
		const competitionId = `${ZKT_PREFIX}${comp.slug || comp.id}`;
		try {
			const records = await fetchCompetitionRecords(competitionId);

			notifiedCount += await scanCompetition(prisma, {
				source: 'ZKT',
				competitionId,
				competitionName: comp.name || '',
				records,
				watches,
				sentTickKeys,
			});
		} catch (err: any) {
			logger.warn('[RecordRadar] ZKT competition scan failed', {compId: competitionId, err: err?.message});
		}
	}

	return notifiedCount;
}

interface ScanArgs {
	source: RecordSource;
	competitionId: string;
	competitionName: string;
	records: WcaLiveRecordEntry[];
	watches: any[];
	sentTickKeys: Set<string>;
}

/**
 * Diff one competition's records against what has already been seen, persist the
 * new ones and notify. Shared by both authorities on purpose: the retroactive-spam
 * guard is the subtle part, and it should exist exactly once.
 *
 * `wca_record_scan_state` / `wca_record_seen` are keyed by a free-text
 * `competition_id`, so ZKT rows live in the same tables under their `zkt-<slug>`
 * id. WCA ids never start with `zkt-`, so the two namespaces cannot collide.
 */
async function scanCompetition(prisma: any, args: ScanArgs): Promise<number> {
	const {source, competitionId, competitionName, records, watches, sentTickKeys} = args;
	if (records.length === 0) return 0;

	const scanState = await prisma.wcaRecordScanState.findUnique({
		where: {competition_id: competitionId},
	});

	// FIRST SIGHT — seed baseline, notify nobody (retroactive-spam suppression).
	// Both enumerations reach a competition a day before it starts, so in practice
	// this seeds against an empty record set and the first real record still fires.
	if (!scanState) {
		await prisma.wcaRecordSeen.createMany({
			data: records.map((r) => ({competition_id: competitionId, signature: recordSignature(r)})),
			skipDuplicates: true,
		});
		await prisma.wcaRecordScanState.create({data: {competition_id: competitionId}});
		return 0;
	}

	const seenRows = await prisma.wcaRecordSeen.findMany({
		where: {competition_id: competitionId},
		select: {signature: true},
	});
	const seen = new Set(seenRows.map((s: {signature: string}) => s.signature));

	const newRecords = records.filter((r) => !seen.has(recordSignature(r)));

	// Persist new signatures + bump scan time regardless of matches.
	if (newRecords.length > 0) {
		await prisma.wcaRecordSeen.createMany({
			data: newRecords.map((r) => ({competition_id: competitionId, signature: recordSignature(r)})),
			skipDuplicates: true,
		});
	}
	await prisma.wcaRecordScanState.update({
		where: {competition_id: competitionId},
		data: {last_scanned_at: new Date()},
	});

	let notifiedCount = 0;
	for (const rec of newRecords) {
		notifiedCount += await fanOut({source, competitionId, competitionName}, rec, watches, sentTickKeys);
	}
	return notifiedCount;
}

/** Fan one record out to every watch it matches. Returns how many were sent. */
async function fanOut(
	comp: {source: RecordSource; competitionId: string; competitionName: string},
	rec: WcaLiveRecordEntry,
	watches: any[],
	sentTickKeys: Set<string>,
): Promise<number> {
	const candidate: RecordCandidate = {
		eventId: rec.eventId,
		tag: rec.tag,
		personCountryIso2: rec.personCountryIso2,
	};
	const sig = recordSignature(rec);

	let sent = 0;
	for (const w of watches) {
		const rule: WatchRule = {events: w.events, scope: w.scope, region: w.region};
		if (!watchMatchesRecord(rule, candidate)) continue;

		const dedupeKey = `${w.user_id}:${sig}`;
		if (sentTickKeys.has(dedupeKey)) continue;
		sentTickKeys.add(dedupeKey);

		await notifyRecord(comp, rec, w.user).catch((err: any) =>
			logger.warn('[RecordRadar] notify failed', {userId: w.user_id, err: err?.message}),
		);
		sent++;
	}
	return sent;
}

async function notifyRecord(
	comp: {source: RecordSource; competitionId: string; competitionName: string},
	rec: WcaLiveRecordEntry,
	user: any,
): Promise<void> {
	// The federation ships its own event names, including ZKT-only formats the WCA
	// map has no entry for, so prefer it and fall back only when absent.
	const eventName = rec.eventName || WcaApiService.getShortEventName(rec.eventId);
	const resultText = formatRecordResult(rec.attemptResult, rec.eventId, rec.type === 'average');
	const roundNumber = rec.roundNumber || 1;
	const locale = userLocale(user);

	const notif = new RecordBrokenNotification(
		{user, triggeringUser: user, sendEmail: false},
		{
			source: comp.source,
			competitionId: comp.competitionId,
			competitionName: comp.competitionName,
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
		// `type` stays 'wca_record_broken' for WCA records: already-installed native
		// builds route that string through a hardcoded fallback, and changing it
		// would strand their taps on /timer until they update.
		//
		// `link` is the route for everything else, and it must stay RELATIVE — the
		// client hands an absolute http link to the in-app browser instead of
		// navigating in-app.
		type: notif.notificationType(),
		link: notif.relativeLink(),
		competitionId: comp.competitionId,
		eventId: rec.eventId,
		roundNumber: String(roundNumber),
	}).catch(() => {});
}
