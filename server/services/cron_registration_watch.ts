// Registration watch: keeps a timeline of who joined and who left every upcoming
// WCA competition in Turkey. WCA shows only the current accepted list, so a swap
// behind an unchanged count leaves no public trace; this record is the trace.
//
// Every 15 minutes each active competition gets a light read (the accepted
// registrations, ~10 KB). Only when its fingerprint moved, or the stored copy is
// an hour old, the WCIF (~200 KB) is read for names, groups and tasks and diffed
// against the stored list. Each change becomes a RegistrationWatchEvent stamped
// with the window it happened in.
//
// The first full read of a competition is its baseline and writes no events:
// what was already there when watching started is not a change we saw.
//
// Changes made after registration closed are pushed to the allowlisted owner
// (REGISTRATION_WATCH_VIEWERS).

import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, getValueFromRedis, RedisNamespace, setKeyInRedis} from './redis';
import {sendPushToUser} from './push';
import {WcaApiService} from './WcaApiService';
import {
	changeDigest,
	changeFlags,
	diffRegistrants,
	hasGroups,
	isWatchActive,
	lightRegistrationsFromApi,
	listHash,
	registrantsFromWcif,
	WatchedRegistrant,
} from './RegistrationWatch';
import {registrationWatchViewerIds} from '../util/registration_watch_access';
import RegistrationWatchChangeNotification from '../resources/notification_types/registration_watch_change';

const TICK_LOCK_TTL_MS = 14 * 60 * 1000; // < 15 min interval
const LOCK_KEY = createRedisKey(RedisNamespace.REGISTRATION_WATCH, 'cron_lock');
const DISCOVERY_KEY = createRedisKey(RedisNamespace.REGISTRATION_WATCH, 'discovered');
const DISCOVERY_SECONDS = 6 * 60 * 60;

const WATCH_COUNTRY = 'TR';
const WCIF_REFRESH_MS = 60 * 60 * 1000;
// While registration is open joins and withdrawals are routine: hourly is enough.
// Once it closes every tick counts, the window of a change is the evidence.
const OPEN_REGISTRATION_READ_MS = 60 * 60 * 1000;
const REQUEST_GAP_MS = 300;
const MAX_COMPETITIONS_PER_TICK = 40;

const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type WatchRow = Awaited<ReturnType<typeof loadActiveWatches>>[number];

export function initRegistrationWatchCronJob() {
	const job = new CronJob(
		'0 */15 * * * *',
		async () => {
			try {
				await runRegistrationWatchTick();
			} catch (err: any) {
				logger.error('[RegistrationWatch] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('[RegistrationWatch] cron initialized', {running: job.running});
}

/** One tick. Exported so a script can run it on demand. */
export async function runRegistrationWatchTick(now = new Date()): Promise<void> {
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) return;

	try {
		try {
			await discoverIfDue();
		} catch (err: any) {
			// Known competitions are still read; discovery retries next tick.
			logger.warn('[RegistrationWatch] discovery failed', {err: err?.message});
		}
		const watches = await loadActiveWatches(now);
		for (const watch of watches) {
			if (watch.registration_open && watch.registration_open.getTime() > now.getTime()) continue;
			const stillOpen = !watch.registration_close || watch.registration_close.getTime() > now.getTime();
			const readRecently =
				!!watch.confirmed_at && now.getTime() - watch.confirmed_at.getTime() < OPEN_REGISTRATION_READ_MS;
			if (stillOpen && readRecently) continue;
			try {
				await readCompetition(watch, new Date());
			} catch (err: any) {
				logger.warn('[RegistrationWatch] read failed', {competitionId: watch.competition_id, err: err?.message});
			}
			await sleep(REQUEST_GAP_MS);
		}
	} finally {
		try {
			await (lock as any).release();
		} catch {
			// ignore
		}
	}
}

function loadActiveWatches(now: Date) {
	return getPrisma().registrationWatchCompetition.findMany({
		where: {end_date: {gte: new Date(now.getTime() - 2 * DAY_MS)}},
		orderBy: {start_date: 'asc'},
		take: MAX_COMPETITIONS_PER_TICK,
	});
}

function parseDate(value: unknown): Date | null {
	if (!value) return null;
	const d = new Date(String(value));
	return Number.isNaN(d.getTime()) ? null : d;
}

function parseDay(value: unknown): Date | null {
	return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : null;
}

/** Upcoming competitions of the country, refreshed every few hours (dates and close times get edited). */
async function discoverIfDue(): Promise<void> {
	if (await getValueFromRedis(DISCOVERY_KEY)) return;

	const comps = await WcaApiService.fetchUpcomingCompetitions(WATCH_COUNTRY);
	const prisma = getPrisma();
	const now = new Date();
	let count = 0;
	for (const c of comps) {
		const start = parseDay(c?.start_date);
		const end = parseDay(c?.end_date);
		if (!c?.id || !start || !end || !isWatchActive(end, now)) continue;
		const data = {
			name: String(c.name || c.id),
			start_date: start,
			end_date: end,
			registration_open: parseDate(c.registration_open),
			registration_close: parseDate(c.registration_close),
			competitor_limit: Number.isFinite(c.competitor_limit) ? c.competitor_limit : null,
		};
		await prisma.registrationWatchCompetition.upsert({
			where: {competition_id: c.id},
			create: {competition_id: c.id, ...data},
			update: data,
		});
		count++;
	}
	await setKeyInRedis(DISCOVERY_KEY, '1', DISCOVERY_SECONDS);
	logger.info('[RegistrationWatch] discovery done', {country: WATCH_COUNTRY, watched: count});
}

async function readCompetition(watch: WatchRow, now: Date): Promise<void> {
	const prisma = getPrisma();
	const id = watch.competition_id;

	const light = await WcaApiService.fetchCompetitionRegistrations(id);
	if (!light) return;

	const wcifFresh = !!watch.wcif_read_at && now.getTime() - watch.wcif_read_at.getTime() < WCIF_REFRESH_MS;
	if (watch.baseline_at && wcifFresh && listHash(lightRegistrationsFromApi(light)) === watch.list_hash) {
		await prisma.registrationWatchCompetition.update({where: {competition_id: id}, data: {confirmed_at: now}});
		return;
	}

	const wcif = await WcaApiService.fetchCompetitionWcif(id);
	if (!wcif) return;

	const after = registrantsFromWcif(wcif);
	const stored = await prisma.registrationWatchRegistrant.findMany({where: {competition_id: id}});
	const before: WatchedRegistrant[] = stored.map((r) => ({
		wcaRegistrationId: r.wca_registration_id,
		registrantId: r.registrant_id,
		wcaUserId: r.wca_user_id,
		wcaId: r.wca_id,
		name: r.name,
		eventIds: r.event_ids,
		roles: r.roles,
		competitorGroups: r.competitor_groups,
		staffTasks: r.staff_tasks,
	}));

	// An empty list next to a stored one is a WCA hiccup, not everyone withdrawing.
	if (after.length === 0 && before.length > 0) {
		logger.warn('[RegistrationWatch] empty WCIF list, skipped', {competitionId: id, stored: before.length});
		return;
	}

	const isBaseline = !watch.baseline_at;
	const changes = isBaseline ? [] : diffRegistrants(before, after);
	// The flags use what was known before this read: groups first seen now did
	// not exist for sure when the window opened.
	const flags = changeFlags({
		windowStart: watch.confirmed_at,
		registrationClose: watch.registration_close,
		groupsSeenAt: watch.groups_seen_at,
	});
	const firstSeen = new Map(stored.map((r) => [r.wca_registration_id, r.first_seen_at]));

	await prisma.$transaction([
		prisma.registrationWatchEvent.createMany({
			data: changes.map((c) => ({
				competition_id: id,
				kind: c.kind,
				wca_registration_id: c.registrant.wcaRegistrationId,
				registrant_id: c.registrant.registrantId,
				wca_user_id: c.registrant.wcaUserId,
				wca_id: c.registrant.wcaId,
				name: c.registrant.name,
				events_before: c.eventsBefore,
				events_after: c.eventsAfter,
				after_close: flags.afterClose,
				after_groups: flags.afterGroups,
				window_start: watch.confirmed_at,
				observed_at: now,
			})),
		}),
		prisma.registrationWatchRegistrant.deleteMany({where: {competition_id: id}}),
		prisma.registrationWatchRegistrant.createMany({
			data: after.map((r) => ({
				competition_id: id,
				wca_registration_id: r.wcaRegistrationId,
				registrant_id: r.registrantId,
				wca_user_id: r.wcaUserId,
				wca_id: r.wcaId,
				name: r.name,
				event_ids: r.eventIds,
				roles: r.roles,
				competitor_groups: r.competitorGroups,
				staff_tasks: r.staffTasks,
				first_seen_at: firstSeen.get(r.wcaRegistrationId) ?? now,
			})),
		}),
		prisma.registrationWatchCompetition.update({
			where: {competition_id: id},
			data: {
				list_hash: listHash(after),
				baseline_at: watch.baseline_at ?? now,
				confirmed_at: now,
				wcif_read_at: now,
				groups_seen_at: watch.groups_seen_at ?? (hasGroups(after) ? now : null),
			},
		}),
	]);

	if (changes.length === 0) return;
	logger.info('[RegistrationWatch] list changed', {
		competitionId: id,
		joined: changes.filter((c) => c.kind === 'joined').length,
		left: changes.filter((c) => c.kind === 'left').length,
		eventsChanged: changes.filter((c) => c.kind === 'events_changed').length,
	});

	const body = changeDigest(changes.map((c) => ({kind: c.kind, name: c.registrant.name, ...flags})));
	if (body) await notifyViewers(id, watch.name, body);
}

async function notifyViewers(competitionId: string, competitionName: string, body: string): Promise<void> {
	const ids = registrationWatchViewerIds();
	if (ids.length === 0) return;
	const viewers = await getPrisma().userAccount.findMany({where: {id: {in: ids}, admin: true}});
	for (const user of viewers) {
		try {
			const notif = new RegistrationWatchChangeNotification(
				{user: user as any, triggeringUser: user as any, sendEmail: false},
				{competitionId, competitionName, body}
			);
			await notif.send();
			await sendPushToUser(user.id, notif.subject(), body, notif.pushData());
		} catch (err: any) {
			logger.warn('[RegistrationWatch] notify failed', {userId: user.id, err: err?.message});
		}
	}
}
