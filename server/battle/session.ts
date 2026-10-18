/**
 * Per-user Online Battle bookkeeping in Redis (design ranking-battle.md 4.2, 4.3, 4.6).
 *
 * - Session: a user is in at most one queue or one match at a time, from one socket
 *   (`cd:battle:session#<userId>`). Two tabs must not play two matches on one rating.
 * - Abandon cooldown: leaving inside the "opponent found" screen costs 1 min, then 5 min,
 *   then 15 min of queue time that day.
 * - Recent opponent: the last opponent is skipped for 2 minutes while someone else waits.
 * - Ended tombstone: why a match ended, so a reconnecting client is told (server restart,
 *   both disconnected) instead of "not found".
 */

import {RedisNamespace} from '../services/redis';
import {QUEUE_SAME_OPPONENT_COOLDOWN_SEC} from '../../shared/battle/config';
import {BattleCancelReason} from '../../shared/battle/events';
import {abandonCooldownSec} from '../../shared/battle/rules';
import {battleKey, battleKeyPattern, BattleStore} from './store';

/** Session TTL in a match: longer than the longest match plus its rematch window. */
export const MATCH_SESSION_TTL_SEC = 30 * 60;
/** Session TTL while queued; refreshed when the player answers "still here". */
export const QUEUE_SESSION_TTL_SEC = 15 * 60;
/** Match snapshots and tombstones expire after this (design 4.8: 30 min). */
export const MATCH_SNAPSHOT_TTL_SEC = 30 * 60;
/** "Same day" for repeated abandons. */
const ABANDON_WINDOW_SEC = 24 * 60 * 60;

export type BattleSessionKind = 'queue' | 'match';

export interface BattleSession {
	kind: BattleSessionKind;
	socketId: string;
	matchId?: string;
	since: number;
}

function sessionKey(userId: string): string {
	return battleKey(RedisNamespace.BATTLE_SESSION, userId);
}

export async function getBattleSession(store: BattleStore, userId: string): Promise<BattleSession | null> {
	const raw = await store.get(sessionKey(userId));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed.kind === 'string' ? (parsed as BattleSession) : null;
	} catch {
		return null;
	}
}

export async function setBattleSession(store: BattleStore, userId: string, session: BattleSession): Promise<void> {
	const ttl = session.kind === 'match' ? MATCH_SESSION_TTL_SEC : QUEUE_SESSION_TTL_SEC;
	await store.set(sessionKey(userId), JSON.stringify(session), ttl);
}

/**
 * Clears the session, but only when it still is the one the caller means: a late event
 * from an old socket or a finished match must not wipe the user's new queue or match.
 */
export async function clearBattleSession(
	store: BattleStore,
	userId: string,
	expect?: {socketId?: string; matchId?: string; kind?: BattleSessionKind}
): Promise<void> {
	if (expect) {
		const current = await getBattleSession(store, userId);
		if (!current) return;
		if (expect.kind && current.kind !== expect.kind) return;
		if (expect.socketId && current.socketId !== expect.socketId) return;
		if (expect.matchId && current.matchId !== expect.matchId) return;
	}
	await store.del(sessionKey(userId));
}

/** Startup: every session refers to a socket of the previous process (design 4.6). */
export async function clearAllBattleSessions(store: BattleStore): Promise<number> {
	const keys = await store.scanKeys(battleKeyPattern(RedisNamespace.BATTLE_SESSION));
	for (const key of keys) await store.del(key);
	return keys.length;
}

/** A friendly room session blocks the queue (design 4.3). */
export async function isInFriendlyRoom(store: BattleStore, userId: string): Promise<boolean> {
	return (await store.get(battleKey(RedisNamespace.FRIENDLY_ROOM_SESSION, userId))) != null;
}

// ── Abandon cooldown ─────────────────────────────────────────────────────────

/** Seconds of queue cooldown left, 0 when none. */
export async function getQueueCooldownSec(store: BattleStore, userId: string): Promise<number> {
	const ttl = await store.ttl(battleKey(RedisNamespace.BATTLE_COOLDOWN, userId));
	return ttl > 0 ? ttl : 0;
}

/** Counts an abandon and starts its cooldown. Returns the cooldown in seconds. */
export async function recordAbandon(store: BattleStore, userId: string): Promise<number> {
	const count = await store.incr(battleKey(RedisNamespace.BATTLE_ABANDONS, userId), ABANDON_WINDOW_SEC);
	const sec = abandonCooldownSec(count);
	if (sec > 0) await store.set(battleKey(RedisNamespace.BATTLE_COOLDOWN, userId), String(sec), sec);
	return sec;
}

// ── Recent opponent ──────────────────────────────────────────────────────────

export interface RecentOpponent {
	opponentId: string;
	/** Server clock until which the pair is not matched again from the queue. */
	until: number;
}

export async function setRecentOpponent(store: BattleStore, userId: string, opponentId: string, now: number): Promise<void> {
	const value: RecentOpponent = {opponentId, until: now + QUEUE_SAME_OPPONENT_COOLDOWN_SEC * 1000};
	await store.set(battleKey(RedisNamespace.BATTLE_RECENT_OPPONENT, userId), JSON.stringify(value), QUEUE_SAME_OPPONENT_COOLDOWN_SEC);
}

export async function getRecentOpponent(store: BattleStore, userId: string): Promise<RecentOpponent | null> {
	const raw = await store.get(battleKey(RedisNamespace.BATTLE_RECENT_OPPONENT, userId));
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed.opponentId === 'string' ? (parsed as RecentOpponent) : null;
	} catch {
		return null;
	}
}

// ── Ended tombstone ──────────────────────────────────────────────────────────

export async function markMatchEnded(store: BattleStore, matchId: string, reason: BattleCancelReason): Promise<void> {
	await store.set(battleKey(RedisNamespace.BATTLE_ENDED, matchId), reason, MATCH_SNAPSHOT_TTL_SEC);
}

export async function getMatchEndedReason(store: BattleStore, matchId: string): Promise<BattleCancelReason | null> {
	const raw = await store.get(battleKey(RedisNamespace.BATTLE_ENDED, matchId));
	return (raw as BattleCancelReason) || null;
}
