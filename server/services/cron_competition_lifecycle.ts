// Competition lifecycle notifications for registrants, WCA and ZKT alike:
//
// - groups published:   the person's assignments appeared and held still
// - schedule changed:   a time in the person's own schedule moved (one push per burst)
// - results official:   WCA posted / the federation published the results,
//                       with the national rank climb when WCA has caught up
//
// Each competition is a CompetitionLifecycleWatch, read on its own clock
// (computeNextCheckAt). Every send is claimed first (updateMany from null), so
// two instances or a retried tick can never send the same notification twice.
//
// Never touches the WCIF cache key the competition page uses
// (`cd:wca:wcif#<id>`): a long-lived cron write there would hold the page to
// stale groups right when a "groups are out" push sends people to it.

import {CronJob} from 'cron';
import {Prisma} from '@prisma/client';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, getValueFromRedis, RedisNamespace, setKeyInRedis} from './redis';
import {sendPushToUser} from './push';
import {WcaApiService} from './WcaApiService';
import {ZktFederationService} from './ZktFederationService';
import {zktSlugOf} from './ZktWcaAdapter';
import {getUserIdsWithPrefDisabled} from '../models/notification_preference';
import {
	bestsAtCompetition,
	buildRankLines,
	computeNextCheckAt,
	computeResultsNextCheckAt,
	decideQuiet,
	diffSize,
	findNewPbs,
	GROUPS_QUIET_MS,
	groupsHash,
	isPastCompetition,
	LifecycleSource,
	PersonTimeline,
	RANK_RECHECK_MS,
	RANK_WAIT_MS,
	RankBaselineEntry,
	ranksReady,
	RESULTS_GIVE_UP_DAYS,
	SCHEDULE_QUIET_MS,
	scheduleChangeDiff,
	scheduleHash,
	summarizeAssignments,
} from './CompetitionLifecycle';
import {MatchedRegistrant, rememberWcaCompetitions, syncStatesFromWcif, upsertWatch, upsertWatchFromWcif} from './CompetitionLifecycleDiscovery';
import CompetitionLifecycleNotification from '../resources/notification_types/competition_lifecycle_base';
import CompetitionGroupsPublishedNotification from '../resources/notification_types/competition_groups_published';
import CompetitionScheduleChangedNotification from '../resources/notification_types/competition_schedule_changed';
import CompetitionResultsOfficialNotification from '../resources/notification_types/competition_results_official';

const TICK_LOCK_TTL_MS = 270_000; // < 5 min interval
const LOCK_KEY = createRedisKey(RedisNamespace.COMPETITION_LIFECYCLE, 'cron_lock');

// Per-tick budgets. The federation allows 60 requests a minute per IP, shared
// with page renders and the live poller; these keep this cron to a handful.
const MAX_WATCHES_PER_TICK = 15;
const MAX_RESULT_CHECKS_PER_TICK = 10;
const MAX_RESULT_STATES_PER_TICK = 30;
const WCA_REQUEST_GAP_MS = 300;
const ZKT_REQUEST_GAP_MS = 1000;
const WCIF_RETRY_MS = 30 * 60 * 1000;

const ZKT_DISCOVERY_SECONDS = 15 * 60;
const WCA_DISCOVERY_SECONDS = 6 * 60 * 60;
const CLEANUP_SECONDS = 60 * 60;

// Federation statuses worth watching for groups and schedule.
const ZKT_WATCH_STATUSES = new Set(['ANNOUNCED', 'REGISTRATION_OPEN', 'REGISTRATION_CLOSED', 'ONGOING']);

// The country whose WCA competitions are watched without anyone opening them.
const WCA_DISCOVERY_COUNTRY = 'TR';

const DAY_MS = 24 * 60 * 60 * 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function initCompetitionLifecycleCronJob() {
	const job = new CronJob(
		'30 */5 * * * *', // Every 5 minutes, offset from the minute-aligned crons
		async () => {
			try {
				await runCompetitionLifecycleTick();
			} catch (err: any) {
				logger.error('[Lifecycle] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('[Lifecycle] cron initialized', {running: job.running});
}

/** One tick. Exported so a script or an admin action can run it on demand. */
export async function runCompetitionLifecycleTick() {
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) {
		logger.info('[Lifecycle] tick skipped, busy');
		return;
	}

	try {
		// Each phase is independent: one failing never stops the next. Each takes
		// its own "now", so a watch discovered a moment ago is already due.
		await runPhase('discovery', () => runDiscovery());
		await runPhase('watches', () => processDueWatches(new Date()));
		await runPhase('results_check', () => checkResultsOfficial(new Date()));
		await runPhase('results_deliver', () => deliverResults(new Date()));
		await runPhase('cleanup', () => cleanup(new Date()));
	} finally {
		try {
			await (lock as any).release();
		} catch {
			// ignore
		}
	}
}

async function runPhase(name: string, fn: () => Promise<unknown>) {
	try {
		await fn();
	} catch (err: any) {
		logger.warn('[Lifecycle] phase failed', {phase: name, err: err?.message});
	}
}

/**
 * Run `fn` at most once per `ttlSeconds` across all instances (the tick lock
 * already serialises them). The gate closes only after `fn` succeeds, so a
 * failed upstream call is retried on the next tick instead of hours later.
 */
async function everyAtMost(name: string, ttlSeconds: number, fn: () => Promise<void>): Promise<void> {
	const key = createRedisKey(RedisNamespace.COMPETITION_LIFECYCLE, `gate:${name}`);
	if (await getValueFromRedis(key)) return;
	await fn();
	await setKeyInRedis(key, '1', ttlSeconds);
}

// --- Discovery ----------------------------------------------------------------

/**
 * Which competitions to watch. Registrants themselves are matched on every
 * WCIF read (syncStatesFromWcif); this only finds the competitions:
 *
 * - ZKT: the federation's public list
 * - WCA: upcoming competitions in Turkey. Competitions abroad are picked up
 *   when a registrant opens the page or their "my competitions" list. No
 *   background call uses a user's WCA token: refreshing one at the same moment
 *   as the user's own session could get the link marked revoked.
 */
async function runDiscovery() {
	// Independent sources: the federation being down must not hold up WCA.
	await runPhase('discovery_zkt', () =>
		everyAtMost('discovery_zkt', ZKT_DISCOVERY_SECONDS, async () => {
			const payload: any = await ZktFederationService.fetchCompetitions({page: 0, pageSize: 100});
			let count = 0;
			for (const item of payload?.items || []) {
				if (!ZKT_WATCH_STATUSES.has(String(item?.status || '').toUpperCase())) continue;
				const competitionId = `zkt-${item.slug || item.id}`;
				try {
					await upsertWatch({competitionId, name: item.name || competitionId, startDate: item.startDate, endDate: item.endDate});
					count++;
				} catch (err: any) {
					logger.warn('[Lifecycle] ZKT watch upsert failed', {competitionId, err: err?.message});
				}
			}
			logger.info('[Lifecycle] ZKT discovery done', {watched: count});
		})
	);

	await runPhase('discovery_wca', () =>
		everyAtMost('discovery_wca', WCA_DISCOVERY_SECONDS, async () => {
			const comps = await WcaApiService.fetchUpcomingCompetitions(WCA_DISCOVERY_COUNTRY);
			const count = await rememberWcaCompetitions(comps);
			logger.info('[Lifecycle] WCA discovery done', {country: WCA_DISCOVERY_COUNTRY, watched: count});
		})
	);
}

// --- Groups and schedule --------------------------------------------------------

type Watch = NonNullable<Awaited<ReturnType<typeof upsertWatch>>>;

async function fetchWcifFor(watch: Watch): Promise<any | null> {
	if (watch.source === 'zkt') {
		try {
			return await ZktFederationService.fetchWcif(zktSlugOf(watch.competition_id));
		} catch {
			return null;
		}
	}
	return WcaApiService.fetchCompetitionWcif(watch.competition_id);
}

async function processDueWatches(now: Date) {
	const prisma = getPrisma();
	const watches = await prisma.competitionLifecycleWatch.findMany({
		where: {next_check_at: {lte: now}},
		orderBy: {next_check_at: 'asc'},
		take: MAX_WATCHES_PER_TICK,
	});

	let sent = 0;
	for (const watch of watches) {
		try {
			sent += await processWatch(watch, now);
		} catch (err: any) {
			logger.warn('[Lifecycle] watch failed', {competitionId: watch.competition_id, err: err?.message});
			await prisma.competitionLifecycleWatch
				.update({where: {competition_id: watch.competition_id}, data: {next_check_at: new Date(now.getTime() + WCIF_RETRY_MS)}})
				.catch(() => {});
		}
		await sleep(watch.source === 'zkt' ? ZKT_REQUEST_GAP_MS : WCA_REQUEST_GAP_MS);
	}
	if (watches.length) logger.info('[Lifecycle] watches processed', {count: watches.length, sent});
}

async function processWatch(watch: Watch, now: Date): Promise<number> {
	const prisma = getPrisma();

	if (isPastCompetition(watch.end_date, now)) {
		// Nothing left in the WCIF to watch; results run on their own clock.
		await prisma.competitionLifecycleWatch.update({
			where: {competition_id: watch.competition_id},
			data: {next_check_at: new Date(now.getTime() + 365 * DAY_MS)},
		});
		return 0;
	}

	const wcif = await fetchWcifFor(watch);
	if (!wcif) {
		await prisma.competitionLifecycleWatch.update({
			where: {competition_id: watch.competition_id},
			data: {next_check_at: new Date(now.getTime() + WCIF_RETRY_MS)},
		});
		return 0;
	}

	const fresh = (await upsertWatchFromWcif(watch.competition_id, wcif)) || watch;
	const matched = await syncStatesFromWcif(fresh, wcif, now);

	let sent = 0;
	let pendingDue: Date | null = null;
	const earliest = (d: Date | null) => {
		if (d && (!pendingDue || d < pendingDue)) pendingDue = d;
	};

	if (matched.length && !isPastCompetition(fresh.end_date, now)) {
		const userIds = matched.map((m) => m.state.user_id);
		const groupsOff = await getUserIdsWithPrefDisabled(userIds, 'competition_groups_published');
		const scheduleOff = await getUserIdsWithPrefDisabled(userIds, 'competition_schedule_changed');

		for (const m of matched) {
			try {
				const g = await evaluateGroups(fresh, m, now, groupsOff);
				if (g.sent) sent++;
				earliest(g.due);
				const s = await evaluateSchedule(fresh, m, now, scheduleOff);
				if (s.sent) sent++;
				earliest(s.due);
			} catch (err: any) {
				logger.warn('[Lifecycle] registrant evaluation failed', {
					competitionId: fresh.competition_id,
					userId: m.state.user_id,
					err: err?.message,
				});
			}
		}
	}

	await prisma.competitionLifecycleWatch.update({
		where: {competition_id: fresh.competition_id},
		data: {
			next_check_at: computeNextCheckAt({
				start: fresh.start_date,
				end: fresh.end_date,
				now,
				hasStates: matched.length > 0,
				source: fresh.source as LifecycleSource,
				pendingDue,
			}),
		},
	});
	return sent;
}

interface Evaluation {
	sent: boolean;
	due: Date | null; // when a pending change will be ready to send
}

const NOTHING: Evaluation = {sent: false, due: null};

function notificationInput(state: MatchedRegistrant['state']) {
	return {user: state.user as any, triggeringUser: state.user as any, sendEmail: false};
}

function userLocale(state: MatchedRegistrant['state']): string {
	return (state.user as any)?.settings?.locale || 'en';
}

function baseMeta(watch: Watch, state: MatchedRegistrant['state']) {
	return {
		source: watch.source as LifecycleSource,
		competitionId: watch.competition_id,
		competitionName: watch.name || watch.competition_id,
		registrantId: state.registrant_id,
		timezone: watch.timezone,
		locale: userLocale(state),
	};
}

/** In-app row, then push. A failure in either is logged and never escapes. */
async function deliver(userId: string, notif: CompetitionLifecycleNotification) {
	await notif.send().catch((err: any) => {
		logger.warn('[Lifecycle] notification row write failed', {userId, err: err?.message});
	});
	await sendPushToUser(userId, notif.subject(), notif.detail(), notif.pushData()).catch((err: any) => {
		logger.warn('[Lifecycle] push failed', {userId, err: err?.message});
	});
}

async function evaluateGroups(watch: Watch, m: MatchedRegistrant, now: Date, optedOut: Set<string>): Promise<Evaluation> {
	const prisma = getPrisma();
	const s = m.state;
	if (s.groups_notified_at) return NOTHING;

	const current = groupsHash(m.timeline);
	if (!current) {
		if (s.groups_pending_hash) {
			await prisma.competitionLifecycleState.update({
				where: {id: s.id},
				data: {groups_pending_hash: null, groups_pending_since: null},
			});
		}
		return NOTHING;
	}

	const decision = decideQuiet({
		current,
		baseline: null,
		pending: s.groups_pending_hash,
		pendingSince: s.groups_pending_since,
		now,
		quietMs: GROUPS_QUIET_MS,
	});

	if (decision === 'set_pending') {
		await prisma.competitionLifecycleState.update({
			where: {id: s.id},
			data: {groups_pending_hash: current, groups_pending_since: now},
		});
		return {sent: false, due: new Date(now.getTime() + GROUPS_QUIET_MS)};
	}
	if (decision !== 'fire') {
		return {sent: false, due: s.groups_pending_since ? new Date(s.groups_pending_since.getTime() + GROUPS_QUIET_MS) : null};
	}

	// Groups are out: this also becomes the schedule baseline, so the groups
	// appearing is never reported a second time as a schedule change.
	const newScheduleHash = scheduleHash(m.timeline);
	const claim = await prisma.competitionLifecycleState.updateMany({
		where: {id: s.id, groups_notified_at: null},
		data: {
			groups_notified_at: now,
			groups_pending_hash: null,
			groups_pending_since: null,
			schedule_hash: newScheduleHash,
			schedule_baseline: m.timeline as any,
			schedule_pending_hash: null,
			schedule_pending_since: null,
		},
	});
	if (claim.count !== 1) return NOTHING;
	Object.assign(s, {
		groups_notified_at: now,
		schedule_hash: newScheduleHash,
		schedule_baseline: m.timeline,
		schedule_pending_hash: null,
		schedule_pending_since: null,
	});

	if (optedOut.has(s.user_id)) return NOTHING;
	await deliver(
		s.user_id,
		new CompetitionGroupsPublishedNotification(notificationInput(s), {
			...baseMeta(watch, s),
			summary: summarizeAssignments(m.timeline),
		})
	);
	return {sent: true, due: null};
}

async function evaluateSchedule(watch: Watch, m: MatchedRegistrant, now: Date, optedOut: Set<string>): Promise<Evaluation> {
	const prisma = getPrisma();
	const s = m.state;
	const current = m.timeline;
	const baseline = s.schedule_baseline as unknown as PersonTimeline | null;

	// Groups appearing is the groups notification's news, not a schedule change.
	if (current.kind === 'assigned' && !s.groups_notified_at) return NOTHING;

	if (!baseline || !Array.isArray(baseline.entries) || baseline.kind !== current.kind) {
		// Groups withdrawn, or a malformed baseline: start over quietly.
		await prisma.competitionLifecycleState.update({
			where: {id: s.id},
			data: {
				schedule_hash: scheduleHash(current),
				schedule_baseline: current as any,
				schedule_pending_hash: null,
				schedule_pending_since: null,
			},
		});
		return NOTHING;
	}

	const currentHash = scheduleHash(current);
	const decision = decideQuiet({
		current: currentHash,
		baseline: s.schedule_hash,
		pending: s.schedule_pending_hash,
		pendingSince: s.schedule_pending_since,
		now,
		quietMs: SCHEDULE_QUIET_MS,
	});

	if (decision === 'clear') {
		await prisma.competitionLifecycleState.update({
			where: {id: s.id},
			data: {schedule_pending_hash: null, schedule_pending_since: null},
		});
		return NOTHING;
	}
	if (decision === 'set_pending') {
		await prisma.competitionLifecycleState.update({
			where: {id: s.id},
			data: {schedule_pending_hash: currentHash, schedule_pending_since: now},
		});
		return {sent: false, due: new Date(now.getTime() + SCHEDULE_QUIET_MS)};
	}
	if (decision === 'none') {
		return {sent: false, due: s.schedule_pending_since ? new Date(s.schedule_pending_since.getTime() + SCHEDULE_QUIET_MS) : null};
	}

	const diff = scheduleChangeDiff(baseline, current, now);
	const meaningful = diffSize(diff) > 0;
	const claim = await prisma.competitionLifecycleState.updateMany({
		where: {id: s.id, schedule_hash: s.schedule_hash},
		data: {
			schedule_hash: currentHash,
			schedule_baseline: current as any,
			schedule_pending_hash: null,
			schedule_pending_since: null,
			...(meaningful ? {schedule_notified_at: now} : {}),
		},
	});
	if (claim.count !== 1 || !meaningful || optedOut.has(s.user_id)) return NOTHING;

	await deliver(
		s.user_id,
		new CompetitionScheduleChangedNotification(notificationInput(s), {...baseMeta(watch, s), diff})
	);
	return {sent: true, due: null};
}

// --- Official results -------------------------------------------------------------

/** Ask WCA / the federation whether results are official yet, for competitions on their last day or later. */
async function checkResultsOfficial(now: Date) {
	const prisma = getPrisma();
	const watches = await prisma.competitionLifecycleWatch.findMany({
		where: {
			results_official_at: null,
			end_date: {lte: now},
			OR: [{results_next_check_at: null}, {results_next_check_at: {lte: now}}],
		},
		orderBy: {end_date: 'asc'},
		take: MAX_RESULT_CHECKS_PER_TICK,
		include: {_count: {select: {states: true}}},
	});

	for (const watch of watches) {
		const source = watch.source as LifecycleSource;
		if (watch._count.states === 0) {
			// Nobody to tell. Keep it only while new registrants could still show up.
			await prisma.competitionLifecycleWatch.update({
				where: {competition_id: watch.competition_id},
				data: {results_next_check_at: new Date(now.getTime() + 6 * 60 * 60 * 1000)},
			});
			continue;
		}

		let officialAt: Date | null = null;
		try {
			if (source === 'zkt') {
				const detail: any = await ZktFederationService.fetchCompetitionDetail(zktSlugOf(watch.competition_id));
				if (String(detail?.status || '').toUpperCase() === 'PUBLISHED') officialAt = now;
			} else {
				const postedAt = await WcaApiService.fetchResultsPostedAt(watch.competition_id);
				if (postedAt) officialAt = new Date(postedAt);
			}
		} catch (err: any) {
			logger.warn('[Lifecycle] results check failed', {competitionId: watch.competition_id, err: err?.message});
			await prisma.competitionLifecycleWatch.update({
				where: {competition_id: watch.competition_id},
				data: {results_next_check_at: new Date(now.getTime() + 60 * 60 * 1000)},
			});
			continue;
		}

		await prisma.competitionLifecycleWatch.update({
			where: {competition_id: watch.competition_id},
			data: officialAt
				? {results_official_at: officialAt}
				: {results_next_check_at: computeResultsNextCheckAt(source, watch.end_date, now)},
		});
		if (officialAt) logger.info('[Lifecycle] results official', {competitionId: watch.competition_id, officialAt});
		await sleep(source === 'zkt' ? ZKT_REQUEST_GAP_MS : WCA_REQUEST_GAP_MS);
	}
}

/** Tell each tracked registrant, once results are official. */
async function deliverResults(now: Date) {
	const prisma = getPrisma();
	const states = await prisma.competitionLifecycleState.findMany({
		where: {
			results_notified_at: null,
			watch: {results_official_at: {not: null}},
			OR: [{results_checked_at: null}, {results_checked_at: {lte: new Date(now.getTime() - RANK_RECHECK_MS)}}],
		},
		include: {watch: true, user: {include: {settings: true}}},
		take: MAX_RESULT_STATES_PER_TICK,
	});
	if (states.length === 0) return;

	const optedOut = await getUserIdsWithPrefDisabled(
		states.map((s) => s.user_id),
		'competition_results_official'
	);

	let sent = 0;
	for (const state of states) {
		try {
			if (await deliverResultFor(state, now, optedOut)) sent++;
		} catch (err: any) {
			logger.warn('[Lifecycle] results delivery failed', {
				competitionId: state.competition_id,
				userId: state.user_id,
				err: err?.message,
			});
			await prisma.competitionLifecycleState
				.update({where: {id: state.id}, data: {results_checked_at: now}})
				.catch(() => {});
		}
		if (state.watch.source === 'wca') await sleep(WCA_REQUEST_GAP_MS);
	}
	logger.info('[Lifecycle] results delivered', {checked: states.length, sent});
}

type ResultState = Prisma.CompetitionLifecycleStateGetPayload<{
	include: {watch: true; user: {include: {settings: true}}};
}>;

async function deliverResultFor(state: ResultState, now: Date, optedOut: Set<string>): Promise<boolean> {
	const prisma = getPrisma();
	const watch = state.watch;
	const source = watch.source as LifecycleSource;
	const officialAt = watch.results_official_at!;

	const claimAndSend = async (meta?: {rankLines?: any[]; pbs?: any[]}): Promise<boolean> => {
		const claim = await prisma.competitionLifecycleState.updateMany({
			where: {id: state.id, results_notified_at: null},
			data: {results_notified_at: now, results_checked_at: now},
		});
		if (claim.count !== 1 || !meta || optedOut.has(state.user_id)) return false;
		await deliver(
			state.user_id,
			new CompetitionResultsOfficialNotification(
				{user: state.user as any, triggeringUser: state.user as any, sendEmail: false},
				{...baseMeta(watch, state), ...meta}
			)
		);
		return true;
	};
	const markChecked = (data: any = {}) =>
		prisma.competitionLifecycleState.update({where: {id: state.id}, data: {results_checked_at: now, ...data}});

	if (source === 'zkt') return claimAndSend({});

	// Posted before this person was tracked (e.g. a page view of an old
	// competition): nothing new for them.
	if (officialAt.getTime() < state.created_at.getTime()) return claimAndSend(undefined);

	let wcaId = state.wca_id;
	if (!wcaId) {
		const integration = await prisma.integration.findFirst({
			where: {user_id: state.user_id, service_name: 'wca'},
			select: {wca_id: true},
		});
		wcaId = integration?.wca_id || null;
	}
	// No WCA id yet (first competition): no way to read their results, keep it plain.
	if (!wcaId) return claimAndSend({});

	const results = await WcaApiService.fetchPersonResultsOrThrow(wcaId);
	const bests = bestsAtCompetition(results, state.competition_id);
	const detectedAt = state.results_detected_at;
	const waited = detectedAt ? now.getTime() - detectedAt.getTime() : 0;

	if (bests.length === 0) {
		// Either they did not compete, or the person endpoint lags the posting.
		if (!detectedAt) {
			await markChecked({results_detected_at: now});
			return false;
		}
		if (waited < RANK_WAIT_MS) {
			await markChecked();
			return false;
		}
		return claimAndSend(undefined); // registered but never competed
	}

	const baseline = (state.rank_baseline as unknown as RankBaselineEntry[]) || [];
	const pbs = findNewPbs(baseline, bests);
	if (pbs.length === 0) return claimAndSend({});

	const person = await WcaApiService.fetchPersonData(wcaId);
	const records = (person?.personal_records as any) || null;
	if (records && ranksReady(pbs, records)) {
		const rankLines = buildRankLines(pbs, baseline, records);
		return claimAndSend(rankLines.length ? {rankLines} : {pbs});
	}

	// WCA has not recomputed rankings yet: hold, then give up on the rank.
	if (!detectedAt) {
		await markChecked({results_detected_at: now});
		return false;
	}
	if (waited < RANK_WAIT_MS) {
		await markChecked();
		return false;
	}
	return claimAndSend({pbs});
}

// --- Cleanup ------------------------------------------------------------------------

async function cleanup(now: Date) {
	await everyAtMost('cleanup', CLEANUP_SECONDS, async () => {
		const prisma = getPrisma();

		// Results never turned official (or we never heard): stop asking.
		const expired = await prisma.competitionLifecycleWatch.deleteMany({
			where: {end_date: {lt: new Date(now.getTime() - RESULTS_GIVE_UP_DAYS * DAY_MS)}},
		});
		// Everyone told, with a few days' margin for a late page-view row.
		const done = await prisma.competitionLifecycleWatch.deleteMany({
			where: {
				results_official_at: {lt: new Date(now.getTime() - 3 * DAY_MS)},
				states: {none: {results_notified_at: null}},
			},
		});
		// Over, and nobody here was registered.
		const empty = await prisma.competitionLifecycleWatch.deleteMany({
			where: {end_date: {lt: new Date(now.getTime() - 2 * DAY_MS)}, states: {none: {}}},
		});

		if (expired.count || done.count || empty.count) {
			logger.info('[Lifecycle] cleanup', {expired: expired.count, done: done.count, empty: empty.count});
		}
	});
}
