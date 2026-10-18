/**
 * Online Battle matcher (design ranking-battle.md 4.2, 4.6).
 *
 * One loop per second. A Redis lock (`cd:battle:matcher`, 900 ms) keeps it to a single
 * runner even if more processes start. Each tick:
 * 1. housekeeping: the "Are you still there?" question every 10 minutes, removal when it
 *    goes unanswered, a queue_state refresh every few seconds;
 * 2. pairing, oldest waiter first: the closest rating inside the window. The window grows
 *    with waiting (100 + 10 per second, the larger of the two windows applies) and after
 *    30 s there is no window at all. The last opponent is skipped for 2 minutes while
 *    anyone else is in the queue;
 * 3. both sockets must still be alive (fetchSockets) before the pair is claimed, so nobody
 *    is matched with a ghost and then dragged into a cancel.
 */

import {RedisNamespace} from '../services/redis';
import {BATTLE_PUZZLE, QUEUE_IDLE_CHECK_SEC} from '../../shared/battle/config';
import {BattleServerEvent, QueueStatePayload} from '../../shared/battle/events';
import {withinQueueWindow} from '../../shared/battle/rules';
import {battleKey, BattleClock, BattleStore, TimerHandle} from './store';
import {claimPair, countSearching, getQueueEntries, QueueEntry, removeFromQueue, updateQueueEntry} from './queue';

export const MATCHER_INTERVAL_MS = 1000;
export const MATCHER_LOCK_MS = 900;
/** How long the "Are you still there?" question stays open. */
export const STILL_HERE_ANSWER_SEC = 60;
/** queue_state refresh while searching (waiting time and the searching count). */
export const QUEUE_STATE_EVERY_SEC = 5;

export interface MatcherDeps {
	store: BattleStore;
	clock: BattleClock;
	isSocketAlive(socketId: string): Promise<boolean>;
	emitToSocket(socketId: string, event: string, payload: unknown): void;
	/** Starts the match. A throw puts nobody back in the queue; the caller tells the players. */
	onPair(a: QueueEntry, b: QueueEntry): Promise<void>;
	log?: {warn(msg: string, meta?: unknown): void; error(msg: string, meta?: unknown): void};
}

// ── Pure pairing ─────────────────────────────────────────────────────────────

export function waitedSec(entry: QueueEntry, now: number): number {
	return Math.max(0, (now - entry.joinedAt) / 1000);
}

/** One of them played the other in the last 2 minutes. */
export function isRecentOpponent(a: QueueEntry, b: QueueEntry, now: number): boolean {
	return (
		(a.lastOpponentId === b.userId && a.lastOpponentUntil > now) ||
		(b.lastOpponentId === a.userId && b.lastOpponentUntil > now)
	);
}

/**
 * Pairs for one tick. Entries oldest first; A of each pair is the one who waited longer.
 *
 * The recent opponent rule follows the design literally: "skipped while someone else is
 * in the queue". With only the two of them searching they are paired again; a third
 * player, even outside the window for now, makes them wait until the windows open up.
 */
export function planPairs(entries: QueueEntry[], now: number): Array<[QueueEntry, QueueEntry]> {
	const sorted = [...entries].sort((a, b) => a.joinedAt - b.joinedAt || (a.userId < b.userId ? -1 : 1));
	const taken = new Set<string>();
	const pairs: Array<[QueueEntry, QueueEntry]> = [];

	for (const e of sorted) {
		if (taken.has(e.userId)) continue;
		const free = sorted.filter((c) => c.userId !== e.userId && !taken.has(c.userId));
		if (!free.length) continue;

		const inWindow = free.filter((c) =>
			withinQueueWindow(e.rating, waitedSec(e, now), c.rating, waitedSec(c, now))
		);
		const someoneElse = free.some((c) => !isRecentOpponent(e, c, now));
		const allowed = someoneElse ? inWindow.filter((c) => !isRecentOpponent(e, c, now)) : inWindow;
		if (!allowed.length) continue;

		let best = allowed[0];
		for (const c of allowed) {
			const d = Math.abs(c.rating - e.rating);
			const bd = Math.abs(best.rating - e.rating);
			if (d < bd || (d === bd && c.joinedAt < best.joinedAt)) best = c;
		}
		taken.add(e.userId);
		taken.add(best.userId);
		pairs.push([e, best]);
	}
	return pairs;
}

// ── Tick ─────────────────────────────────────────────────────────────────────

export class BattleMatcher {
	private interval: TimerHandle | null = null;
	private running = false;
	/** userId -> last queue_state sent (process memory; only the refresh rate depends on it). */
	private lastStateAt = new Map<string, number>();

	constructor(private deps: MatcherDeps, private puzzle: string = BATTLE_PUZZLE) {}

	start(): void {
		if (this.interval) return;
		this.interval = this.deps.clock.setInterval(() => {
			void this.tickWithLock();
		}, MATCHER_INTERVAL_MS);
	}

	stop(): void {
		if (this.interval) this.deps.clock.clearInterval(this.interval);
		this.interval = null;
	}

	async tickWithLock(): Promise<void> {
		// A slow tick (DB, many sockets) must not overlap the next one in this process.
		if (this.running) return;
		this.running = true;
		try {
			await this.deps.store.withLock(battleKey(RedisNamespace.BATTLE_MATCHER_LOCK, this.puzzle), MATCHER_LOCK_MS, () =>
				this.tick()
			);
		} catch (e) {
			this.deps.log?.error('[battle] matcher tick failed', {error: (e as Error)?.message});
		} finally {
			this.running = false;
		}
	}

	/** Sends the current queue state to one entry. */
	async sendState(entry: QueueEntry, extra: Partial<QueueStatePayload> = {}): Promise<void> {
		const now = this.deps.clock.now();
		const payload: QueueStatePayload = {
			searching: true,
			waitedSec: Math.floor(waitedSec(entry, now)),
			searchingCount: await countSearching(this.deps.store, this.puzzle),
			...extra,
		};
		this.lastStateAt.set(entry.userId, now);
		this.deps.emitToSocket(entry.socketId, BattleServerEvent.QUEUE_STATE, payload);
	}

	async tick(): Promise<void> {
		const {store, clock} = this.deps;
		const now = clock.now();
		let entries = await getQueueEntries(store, this.puzzle);

		// 1. Housekeeping
		const kept: QueueEntry[] = [];
		for (const entry of entries) {
			if (entry.askDeadline != null && now >= entry.askDeadline) {
				await removeFromQueue(store, entry.userId, {socketId: entry.socketId, puzzle: this.puzzle});
				this.lastStateAt.delete(entry.userId);
				this.deps.emitToSocket(entry.socketId, BattleServerEvent.QUEUE_STATE, {
					searching: false,
					waitedSec: Math.floor(waitedSec(entry, now)),
					searchingCount: await countSearching(store, this.puzzle),
				} as QueueStatePayload);
				continue;
			}
			if (entry.askDeadline == null && now - entry.lastConfirmAt >= QUEUE_IDLE_CHECK_SEC * 1000) {
				const asked = {...entry, askDeadline: now + STILL_HERE_ANSWER_SEC * 1000};
				await updateQueueEntry(store, asked, this.puzzle);
				await this.sendState(asked, {askStillHere: true, stillHereDeadline: asked.askDeadline as number});
				kept.push(asked);
				continue;
			}
			const last = this.lastStateAt.get(entry.userId) ?? entry.joinedAt;
			if (now - last >= QUEUE_STATE_EVERY_SEC * 1000) {
				await this.sendState(
					entry,
					entry.askDeadline != null ? {askStillHere: true, stillHereDeadline: entry.askDeadline} : {}
				);
			}
			kept.push(entry);
		}
		entries = kept;
		for (const userId of Array.from(this.lastStateAt.keys())) {
			if (!entries.some((e) => e.userId === userId)) this.lastStateAt.delete(userId);
		}

		// 2. Pairing (a player with the still-here question open is still searching)
		const pairs = planPairs(entries, now);
		for (const [a, b] of pairs) {
			const [aliveA, aliveB] = await Promise.all([this.deps.isSocketAlive(a.socketId), this.deps.isSocketAlive(b.socketId)]);
			if (!aliveA || !aliveB) {
				// A ghost leaves the queue; the live one is paired on a later tick.
				if (!aliveA) await removeFromQueue(store, a.userId, {socketId: a.socketId, puzzle: this.puzzle});
				if (!aliveB) await removeFromQueue(store, b.userId, {socketId: b.socketId, puzzle: this.puzzle});
				continue;
			}
			if (!(await claimPair(store, a, b, this.puzzle))) continue;
			this.lastStateAt.delete(a.userId);
			this.lastStateAt.delete(b.userId);
			try {
				await this.deps.onPair(a, b);
			} catch (e) {
				this.deps.log?.error('[battle] could not start a match', {error: (e as Error)?.message});
			}
		}
	}
}
