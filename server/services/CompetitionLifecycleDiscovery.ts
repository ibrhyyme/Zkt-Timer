// Who is registered where, for the competition lifecycle notifications.
//
// Before this, a registrant was only known once they opened the competition
// page (see ensureNotificationState). Here every accepted WCIF registrant is
// matched to a Zkt-Timer user on each WCIF read, by linked identity only:
// WCA id, WCA account id, ZKT account id, ZKT competitor id. The same matcher
// as the competition page (findPersonInWcif). Never by name.

import {getPrisma} from '../database';
import {logger} from './logger';
import {createRedisKey, getValueFromRedis, RedisNamespace, setKeyInRedis} from './redis';
import {findPersonInWcif, WcifData, WcifIdentity, WcifPerson} from './WcifTransformer';
import {isZktCompetitionId} from './ZktWcaAdapter';
import {
	acceptedPersons,
	buildPersonTimeline,
	isPastCompetition,
	LifecycleSource,
	PersonTimeline,
	rankBaselineFromPerson,
	scheduleHash,
	wcifDates,
	wcifTimezone,
	zktWcifStatus,
} from './CompetitionLifecycle';

const VIEWER_SYNC_THROTTLE_SECONDS = 10 * 60;
// A page view of a competition that ended long ago has nothing left to notify.
const VIEWER_HOOK_MAX_AGE_DAYS = 30;

export function lifecycleSourceOf(competitionId: string): LifecycleSource {
	return isZktCompetitionId(competitionId) ? 'zkt' : 'wca';
}

function toDate(value: string | Date | null | undefined): Date | null {
	if (!value) return null;
	if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
	const str = String(value).slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
	const d = new Date(`${str}T00:00:00.000Z`);
	return isNaN(d.getTime()) ? null : d;
}

/**
 * Create the watch for a competition we just learned about, or refresh its
 * name and dates. A new watch is due immediately.
 */
export async function upsertWatch(args: {
	competitionId: string;
	name: string;
	startDate: string | Date;
	endDate: string | Date;
	timezone?: string | null;
}) {
	const start = toDate(args.startDate);
	const end = toDate(args.endDate) || start;
	if (!start || !end) return null;
	const name = args.name || args.competitionId;
	return getPrisma().competitionLifecycleWatch.upsert({
		where: {competition_id: args.competitionId},
		create: {
			competition_id: args.competitionId,
			source: lifecycleSourceOf(args.competitionId),
			name,
			timezone: args.timezone || null,
			start_date: start,
			end_date: end,
		},
		update: {
			name,
			start_date: start,
			end_date: end,
			...(args.timezone ? {timezone: args.timezone} : {}),
		},
	});
}

export async function upsertWatchFromWcif(competitionId: string, wcif: any) {
	const dates = wcifDates(wcif);
	if (!dates) return null;
	return upsertWatch({
		competitionId,
		name: wcif?.name || wcif?.shortName || competitionId,
		startDate: dates.start,
		endDate: dates.end,
		timezone: wcifTimezone(wcif),
	});
}

/**
 * Remember WCA competitions from a listing (the TR feed, or a user's own
 * "my competitions"). Only ones that have not ended: a finished competition
 * nobody was tracked for has nothing left to notify.
 */
export async function rememberWcaCompetitions(
	comps: {id: string; name?: string; start_date?: string; end_date?: string}[]
): Promise<number> {
	const today = new Date().toISOString().slice(0, 10);
	let count = 0;
	for (const c of comps || []) {
		if (!c?.id || isZktCompetitionId(c.id)) continue;
		if (!c.start_date || String(c.end_date || c.start_date).slice(0, 10) < today) continue;
		try {
			await upsertWatch({competitionId: c.id, name: c.name || c.id, startDate: c.start_date, endDate: c.end_date || c.start_date});
			count++;
		} catch (err: any) {
			logger.warn('[Lifecycle] watch upsert failed', {competitionId: c.id, err: err?.message});
		}
	}
	return count;
}

type WatchRow = NonNullable<Awaited<ReturnType<typeof upsertWatch>>>;

function seedData(args: {
	watch: WatchRow;
	userId: string;
	person: WcifPerson;
	timeline: PersonTimeline;
	wcif: any;
	now: Date;
	silent: boolean;
}) {
	const {watch, userId, person, timeline, wcif, now, silent} = args;
	const source = watch.source as LifecycleSource;
	const over = isPastCompetition(watch.end_date, now);
	const hasGroups = timeline.kind === 'assigned';
	return {
		user_id: userId,
		competition_id: watch.competition_id,
		registrant_id: person.registrantId ?? null,
		wca_id: person.wcaId || null,
		// First sight of a competition: groups that already exist are not news.
		// Later matches go through the normal quiet-period flow instead.
		groups_notified_at: (silent && hasGroups) || over ? now : null,
		schedule_hash: scheduleHash(timeline),
		schedule_baseline: timeline as any,
		rank_baseline: source === 'wca' ? (rankBaselineFromPerson(person) as any) : undefined,
		// Results the federation already published are not news either.
		results_notified_at: source === 'zkt' && zktWcifStatus(wcif) === 'PUBLISHED' ? now : null,
	};
}

/** Every linked identity the registrants of this WCIF could be matched by, grouped per user. */
async function identitiesFor(persons: WcifPerson[]): Promise<Map<string, WcifIdentity>> {
	const wcaIds = new Set<string>();
	const wcaUserIds = new Set<string>();
	const zktUserIds = new Set<string>();
	const zktIds = new Set<string>();
	for (const p of persons) {
		if (p.wcaId) wcaIds.add(String(p.wcaId));
		if (p.wcaUserId) wcaUserIds.add(String(p.wcaUserId));
		if (p.zktUserId) zktUserIds.add(String(p.zktUserId));
		if (p.zktId) zktIds.add(String(p.zktId));
	}

	const or: any[] = [];
	if (wcaIds.size) or.push({service_name: 'wca', wca_id: {in: [...wcaIds]}});
	if (wcaUserIds.size) or.push({service_name: 'wca', wca_user_id: {in: [...wcaUserIds]}});
	if (zktUserIds.size) or.push({service_name: 'zkt', zkt_user_id: {in: [...zktUserIds]}});
	if (zktIds.size) or.push({service_name: 'zkt', zkt_id: {in: [...zktIds]}});
	if (or.length === 0) return new Map();

	const rows = await getPrisma().integration.findMany({
		where: {OR: or},
		select: {user_id: true, service_name: true, wca_id: true, wca_user_id: true, zkt_user_id: true, zkt_id: true},
	});

	const byUser = new Map<string, WcifIdentity>();
	for (const row of rows) {
		const id = byUser.get(row.user_id) || {};
		if (row.service_name === 'wca') {
			id.wcaId = row.wca_id;
			id.wcaUserId = row.wca_user_id;
		} else if (row.service_name === 'zkt') {
			id.zktUserId = row.zkt_user_id;
			id.zktId = row.zkt_id;
		}
		byUser.set(row.user_id, id);
	}
	return byUser;
}

export interface MatchedRegistrant {
	state: Awaited<ReturnType<typeof loadStates>>[number];
	person: WcifPerson;
	timeline: PersonTimeline;
}

function loadStates(competitionId: string, userIds?: string[]) {
	return getPrisma().competitionLifecycleState.findMany({
		where: {competition_id: competitionId, ...(userIds ? {user_id: {in: userIds}} : {})},
		include: {user: {include: {settings: true}}},
	});
}

/**
 * Match every accepted registrant to a Zkt-Timer user and keep one state row per
 * match. Runs on every WCIF read the cron makes, so it is idempotent:
 *
 * - new match: row created. Seeded silently on the competition's first sync,
 *   otherwise left for the groups flow to announce.
 * - existing match: registrant id, WCA id and (before the start) rank baseline refreshed
 * - match gone (registration cancelled, account unlinked): row removed, unless
 *   the competition is over and results are still to come
 */
export async function syncStatesFromWcif(watch: WatchRow, wcif: WcifData, now = new Date()): Promise<MatchedRegistrant[]> {
	const prisma = getPrisma();
	const source = watch.source as LifecycleSource;
	const persons = acceptedPersons(wcif);
	const silent = !watch.synced_at;

	const identities = await identitiesFor(persons);
	const matched = new Map<string, WcifPerson>();
	for (const [userId, identity] of identities) {
		const person = findPersonInWcif(persons, identity);
		if (person) matched.set(userId, person);
	}

	const existing = await loadStates(watch.competition_id);
	const existingByUser = new Map(existing.map((s) => [s.user_id, s]));
	const beforeStart = now.getTime() < watch.start_date.getTime();

	for (const [userId, person] of matched) {
		const state = existingByUser.get(userId);
		if (!state) {
			const timeline = buildPersonTimeline(wcif, person);
			try {
				await prisma.competitionLifecycleState.create({
					data: seedData({watch, userId, person, timeline, wcif, now, silent}),
				});
			} catch (err: any) {
				if (err?.code !== 'P2002') throw err; // created concurrently by the page hook
			}
			continue;
		}
		const patch: any = {};
		if ((person.registrantId ?? null) !== state.registrant_id) patch.registrant_id = person.registrantId ?? null;
		if ((person.wcaId || null) !== state.wca_id) patch.wca_id = person.wcaId || null;
		if (source === 'wca' && beforeStart) {
			const baseline = rankBaselineFromPerson(person);
			if (JSON.stringify(baseline) !== JSON.stringify(state.rank_baseline)) patch.rank_baseline = baseline;
		}
		if (Object.keys(patch).length) {
			await prisma.competitionLifecycleState.update({where: {id: state.id}, data: patch});
		}
	}

	// An empty registrant list is a WCIF hiccup, not everyone withdrawing.
	if (persons.length > 0 && !isPastCompetition(watch.end_date, now)) {
		const gone = existing.filter((s) => !matched.has(s.user_id)).map((s) => s.id);
		if (gone.length) {
			await prisma.competitionLifecycleState.deleteMany({where: {id: {in: gone}}});
		}
	}

	if (silent) {
		await prisma.competitionLifecycleWatch.update({
			where: {competition_id: watch.competition_id},
			data: {synced_at: now},
		});
	}

	const states = await loadStates(watch.competition_id, [...matched.keys()]);
	return states.map((state) => {
		const person = matched.get(state.user_id)!;
		return {state, person, timeline: buildPersonTimeline(wcif, person)};
	});
}

/**
 * The competition page hook: the viewer is an accepted registrant. Start
 * tracking them now instead of waiting for the cron, which matters for
 * competitions the cron does not discover on its own (abroad, unlisted).
 *
 * Only the viewer's own row is created, seeded from what they are looking at:
 * whatever is on their screen is not news to them. Other registrants are left
 * to the cron, so a page view never silences anyone else's notification.
 * Throttled per user and competition; never throws.
 */
export async function ensureLifecycleForViewer(args: {
	userId: string;
	competitionId: string;
	wcif: any;
	identity: WcifIdentity;
}): Promise<void> {
	const {userId, competitionId, wcif, identity} = args;
	try {
		const dates = wcifDates(wcif);
		if (!dates) return;
		const now = new Date();
		if (now.getTime() - dates.end.getTime() > VIEWER_HOOK_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return;

		const throttleKey = createRedisKey(RedisNamespace.COMPETITION_LIFECYCLE, `viewer:${competitionId}:${userId}`);
		if (await getValueFromRedis(throttleKey)) return;
		await setKeyInRedis(throttleKey, '1', VIEWER_SYNC_THROTTLE_SECONDS);

		const person = findPersonInWcif(acceptedPersons(wcif), identity);
		if (!person) return;

		const watch = await upsertWatchFromWcif(competitionId, wcif);
		if (!watch) return;

		const prisma = getPrisma();
		const existing = await prisma.competitionLifecycleState.findUnique({
			where: {user_id_competition_id: {user_id: userId, competition_id: competitionId}},
			select: {id: true},
		});
		if (existing) return;

		const timeline = buildPersonTimeline(wcif, person);
		await prisma.competitionLifecycleState
			.create({data: seedData({watch, userId, person, timeline, wcif, now, silent: true})})
			.catch((err: any) => {
				if (err?.code !== 'P2002') throw err;
			});
	} catch (err: any) {
		logger.warn('[Lifecycle] viewer hook failed', {competitionId, err: err?.message});
	}
}
