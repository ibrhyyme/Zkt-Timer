/**
 * Online Battle queue (design ranking-battle.md 4.2, 4.3).
 *
 * Redis layout per puzzle:
 * - sorted set `cd:battle:queue#<puzzle>`: member = user id, score = rating
 * - hash `cd:battle:queue_meta#<puzzle>`: user id -> QueueEntry JSON
 *
 * joinQueue runs every server side condition of design 4.3 in one place: the site flag
 * (the client FeatureGuard alone can be bypassed from the console), verified email, bans,
 * the puzzle, a cube with its own clock, one queue or match per user, no friendly room,
 * the abandon cooldown. Pro is never required (S-7).
 */

import {RedisNamespace} from '../services/redis';
import {BATTLE_PUZZLE, INITIAL_RATING, INITIAL_RD} from '../../shared/battle/config';
import {BATTLE_ERROR_KEYS, BattleErrorPayload, QueueJoinPayload} from '../../shared/battle/events';
import {battleKey, BattleStore} from './store';
import {
	clearBattleSession,
	getBattleSession,
	getQueueCooldownSec,
	getRecentOpponent,
	isInFriendlyRoom,
	setBattleSession,
} from './session';

export interface QueueEntry {
	userId: string;
	socketId: string;
	/** Server clock when the search started. Kept when the same user rejoins from a new socket. */
	joinedAt: number;
	rating: number;
	rd: number;
	/** Last moment the player showed they are there (join or "still here"). */
	lastConfirmAt: number;
	/** Set while the "Are you still there?" question is open. */
	askDeadline: number | null;
	lastOpponentId: string | null;
	/** Server clock until which lastOpponentId is skipped while someone else waits. */
	lastOpponentUntil: number;
	ip: string | null;
}

export function queueKey(puzzle: string = BATTLE_PUZZLE): string {
	return battleKey(RedisNamespace.BATTLE_QUEUE, puzzle);
}

export function queueMetaKey(puzzle: string = BATTLE_PUZZLE): string {
	return battleKey(RedisNamespace.BATTLE_QUEUE_META, puzzle);
}

function parseEntry(raw: string | null | undefined): QueueEntry | null {
	if (!raw) return null;
	try {
		const e = JSON.parse(raw);
		return e && typeof e.userId === 'string' && typeof e.socketId === 'string' ? (e as QueueEntry) : null;
	} catch {
		return null;
	}
}

export async function getQueueEntry(store: BattleStore, userId: string, puzzle: string = BATTLE_PUZZLE): Promise<QueueEntry | null> {
	return parseEntry(await store.hget(queueMetaKey(puzzle), userId));
}

export async function putQueueEntry(store: BattleStore, entry: QueueEntry, puzzle: string = BATTLE_PUZZLE): Promise<void> {
	await store.hset(queueMetaKey(puzzle), entry.userId, JSON.stringify(entry));
	await store.zadd(queueKey(puzzle), entry.rating, entry.userId);
}

/** Meta only (the matcher's housekeeping), the sorted set stays as it is. */
export async function updateQueueEntry(store: BattleStore, entry: QueueEntry, puzzle: string = BATTLE_PUZZLE): Promise<void> {
	await store.hset(queueMetaKey(puzzle), entry.userId, JSON.stringify(entry));
}

/**
 * Takes a user out of the queue. With `socketId`, only when the entry belongs to that
 * socket (a disconnect of an old tab must not cancel the search of the new one).
 * Returns the removed entry.
 */
export async function removeFromQueue(
	store: BattleStore,
	userId: string,
	opts: {socketId?: string; puzzle?: string} = {}
): Promise<QueueEntry | null> {
	const puzzle = opts.puzzle || BATTLE_PUZZLE;
	const entry = await getQueueEntry(store, userId, puzzle);
	if (opts.socketId && entry && entry.socketId !== opts.socketId) return null;
	await store.zrem(queueKey(puzzle), userId);
	await store.hdel(queueMetaKey(puzzle), userId);
	await clearBattleSession(store, userId, {kind: 'queue', ...(opts.socketId ? {socketId: opts.socketId} : {})});
	return entry;
}

/**
 * Queue entries, oldest first. A member without meta (or meta without a member) is a
 * leftover of a half finished write and is dropped here.
 */
export async function getQueueEntries(store: BattleStore, puzzle: string = BATTLE_PUZZLE): Promise<QueueEntry[]> {
	const [members, meta] = await Promise.all([store.zrangeWithScores(queueKey(puzzle)), store.hgetall(queueMetaKey(puzzle))]);
	const out: QueueEntry[] = [];
	const seen = new Set<string>();
	for (const {member, score} of members) {
		const entry = parseEntry(meta[member]);
		if (!entry) {
			await store.zrem(queueKey(puzzle), member);
			continue;
		}
		seen.add(member);
		out.push({...entry, rating: Number.isFinite(score) ? score : entry.rating});
	}
	for (const userId of Object.keys(meta)) {
		if (!seen.has(userId)) await store.hdel(queueMetaKey(puzzle), userId);
	}
	out.sort((a, b) => a.joinedAt - b.joinedAt || (a.userId < b.userId ? -1 : 1));
	return out;
}

export async function countSearching(store: BattleStore, puzzle: string = BATTLE_PUZZLE): Promise<number> {
	return store.zcard(queueKey(puzzle));
}

/**
 * Takes both players out of the sorted set. Valid only when both removals succeed (no
 * other process took either of them); otherwise the one removed here goes back.
 */
export async function claimPair(store: BattleStore, a: QueueEntry, b: QueueEntry, puzzle: string = BATTLE_PUZZLE): Promise<boolean> {
	const ra = await store.zrem(queueKey(puzzle), a.userId);
	const rb = await store.zrem(queueKey(puzzle), b.userId);
	if (ra === 1 && rb === 1) {
		await store.hdel(queueMetaKey(puzzle), a.userId);
		await store.hdel(queueMetaKey(puzzle), b.userId);
		return true;
	}
	if (ra === 1) await store.zadd(queueKey(puzzle), a.rating, a.userId);
	if (rb === 1) await store.zadd(queueKey(puzzle), b.rating, b.userId);
	return false;
}

/** Startup (design 4.6): queued socket ids belong to the previous process. */
export async function clearQueue(store: BattleStore, puzzle: string = BATTLE_PUZZLE): Promise<void> {
	await store.del(queueKey(puzzle));
	await store.del(queueMetaKey(puzzle));
}

// ── Joining ──────────────────────────────────────────────────────────────────

export interface BattleEligibility {
	admin: boolean;
	email_verified: boolean;
	banned_forever: boolean;
	banned_until: Date | null;
}

export interface QueueSiteConfig {
	online_battle_enabled?: boolean | null;
	feature_overrides?: Record<string, {mode?: string; users?: Array<{id?: string} | null>} | null> | null;
}

/** What the queue needs from the match manager. */
export interface QueueMatchView {
	/** 'live': a match is running for the user; 'finished': only its rematch window is open. */
	matchStatusFor(userId: string): 'live' | 'finished' | null;
	/** Leaves the rematch window of a finished match (the user picked "New opponent"). */
	leaveFinished(userId: string): Promise<void>;
}

export interface JoinQueueDeps {
	store: BattleStore;
	now(): number;
	getSiteConfig(): Promise<QueueSiteConfig | null>;
	isOnlineBattleOpen(config: QueueSiteConfig | null, user: {id: string; admin: boolean}): boolean;
	loadEligibility(userId: string): Promise<BattleEligibility | null>;
	getStoredRating(userId: string): Promise<{rating: number; rd: number} | null>;
	matches: QueueMatchView;
}

export interface JoinQueueInput {
	userId: string;
	socketId: string;
	ip: string | null;
	payload: Partial<QueueJoinPayload> | null | undefined;
}

export type JoinQueueResult = {ok: true; entry: QueueEntry} | {ok: false; error: BattleErrorPayload};

function fail(i18nKey: string, params?: Record<string, string | number>): JoinQueueResult {
	return {ok: false, error: params ? {i18nKey, params} : {i18nKey}};
}

export async function joinQueue(deps: JoinQueueDeps, input: JoinQueueInput): Promise<JoinQueueResult> {
	const {store} = deps;
	const {userId, socketId} = input;
	const now = deps.now();

	const eligibility = await deps.loadEligibility(userId);
	if (!eligibility) return fail(BATTLE_ERROR_KEYS.notLoggedIn);

	const config = await deps.getSiteConfig();
	if (!deps.isOnlineBattleOpen(config, {id: userId, admin: !!eligibility.admin})) {
		return fail(BATTLE_ERROR_KEYS.disabled);
	}
	if (!eligibility.email_verified) return fail(BATTLE_ERROR_KEYS.emailNotVerified);
	const bannedUntil = eligibility.banned_until ? new Date(eligibility.banned_until).getTime() : 0;
	if (eligibility.banned_forever || bannedUntil > now) return fail(BATTLE_ERROR_KEYS.banned);

	const payload = input.payload || {};
	if ((payload.puzzle || BATTLE_PUZZLE) !== BATTLE_PUZZLE) return fail(BATTLE_ERROR_KEYS.puzzleNotSupported);
	if (!payload.cube || payload.cube.hasClock !== true) return fail(BATTLE_ERROR_KEYS.cubeNotSupported);

	if (await isInFriendlyRoom(store, userId)) return fail(BATTLE_ERROR_KEYS.inFriendlyRoom);

	const matchStatus = deps.matches.matchStatusFor(userId);
	if (matchStatus === 'live') return fail(BATTLE_ERROR_KEYS.alreadyInMatch);
	if (matchStatus === 'finished') await deps.matches.leaveFinished(userId);

	const session = await getBattleSession(store, userId);
	if (session?.kind === 'match' && matchStatus == null) {
		// A match session without a match in this process: the match is gone (restart,
		// expired), the session is a leftover.
		await clearBattleSession(store, userId, {kind: 'match'});
	}

	const cooldown = await getQueueCooldownSec(store, userId);
	if (cooldown > 0) return fail(BATTLE_ERROR_KEYS.queueCooldown, {seconds: cooldown});

	const previous = await getQueueEntry(store, userId);
	const stored = await deps.getStoredRating(userId);
	const recent = await getRecentOpponent(store, userId);

	const entry: QueueEntry = {
		userId,
		socketId,
		// Rejoining from a new socket (reconnect, second tab) keeps the waiting time.
		joinedAt: previous ? previous.joinedAt : now,
		rating: stored?.rating ?? INITIAL_RATING,
		rd: stored?.rd ?? INITIAL_RD,
		lastConfirmAt: now,
		askDeadline: null,
		lastOpponentId: recent && recent.until > now ? recent.opponentId : null,
		lastOpponentUntil: recent && recent.until > now ? recent.until : 0,
		ip: input.ip,
	};

	await putQueueEntry(store, entry);
	await setBattleSession(store, userId, {kind: 'queue', socketId, since: now});
	return {ok: true, entry};
}

/** "Still here": the question closes, the 10 minute clock restarts, the session TTL too. */
export async function confirmStillHere(store: BattleStore, userId: string, socketId: string, now: number): Promise<boolean> {
	const entry = await getQueueEntry(store, userId);
	if (!entry || entry.socketId !== socketId) return false;
	await updateQueueEntry(store, {...entry, lastConfirmAt: now, askDeadline: null});
	await setBattleSession(store, userId, {kind: 'queue', socketId, since: entry.joinedAt});
	return true;
}
