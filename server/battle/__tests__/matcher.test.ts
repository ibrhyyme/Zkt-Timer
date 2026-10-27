// Online Battle matcher on a fake clock and an in-memory store (design ranking-battle.md
// 4.2, 4.6): the rating window and how it grows, the open queue after 30 s, the larger
// window applying, the same opponent cooldown, ghost sockets leaving the queue, the
// "still here" question, the claim race and the startup cleanup.

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));

import {QUEUE_IDLE_CHECK_SEC, QUEUE_SAME_OPPONENT_COOLDOWN_SEC} from '../../../shared/battle/config';
import {BattleServerEvent} from '../../../shared/battle/events';
import {RedisNamespace} from '../../services/redis';
import {BattleMatcher, planPairs, STILL_HERE_ANSWER_SEC} from '../matcher';
import {
	claimPair,
	clearQueue,
	confirmStillHere,
	countSearching,
	getQueueEntries,
	getQueueEntry,
	putQueueEntry,
	QueueEntry,
	queueKey,
	queueMetaKey,
} from '../queue';
import {clearAllBattleSessions, getBattleSession, setBattleSession} from '../session';
import {battleKey} from '../store';
import {FakeClock, MemoryStore} from '../testing/memory';

const T0 = Date.UTC(2026, 9, 7, 12, 0, 0);

function entry(userId: string, rating: number, waitedSec: number, over: Partial<QueueEntry> = {}): QueueEntry {
	const joinedAt = T0 - waitedSec * 1000;
	return {
		userId,
		socketId: `sock-${userId}`,
		joinedAt,
		rating,
		rd: 350,
		lastConfirmAt: joinedAt,
		askDeadline: null,
		lastOpponentId: null,
		lastOpponentUntil: 0,
		ip: null,
		...over,
	};
}

function ids(pairs: Array<[QueueEntry, QueueEntry]>): string[][] {
	return pairs.map(([a, b]) => [a.userId, b.userId]);
}

describe('planPairs: rating window (design 4.2)', () => {
	it('keeps two fresh players 150 apart waiting, then pairs them once the window grows', () => {
		const a = entry('a', 1500, 0);
		const b = entry('b', 1650, 0);
		expect(planPairs([a, b], T0)).toEqual([]);
		// After 5 s both windows are 100 + 10 * 5 = 150.
		expect(ids(planPairs([a, b], T0 + 5000))).toEqual([['a', 'b']]);
	});

	it('applies the larger window, so a newcomer does not turn away someone who waited 25 s', () => {
		const waited = entry('old', 1500, 25); // window 350
		const fresh = entry('new', 1800, 0); // window 100
		expect(ids(planPairs([fresh, waited], T0))).toEqual([['old', 'new']]);
	});

	it('pairs anyone after 30 s, however far apart', () => {
		const a = entry('a', 900, 30);
		const b = entry('b', 2400, 0);
		expect(ids(planPairs([a, b], T0))).toEqual([['a', 'b']]);
		expect(planPairs([entry('a', 900, 29), b], T0)).toEqual([]);
	});

	it('starts from the longest waiter and takes the closest rating in its window', () => {
		const oldest = entry('oldest', 1500, 20); // window 300
		const near = entry('near', 1540, 2);
		const far = entry('far', 1750, 10);
		const other = entry('other', 1560, 1);
		const pairs = planPairs([near, far, other, oldest], T0);
		expect(ids(pairs)[0]).toEqual(['oldest', 'near']);
		// far (window 200) and other are 190 apart: they pair too.
		expect(ids(pairs)[1]).toEqual(['far', 'other']);
	});

	it('pairs nobody twice and leaves an odd one out', () => {
		const pairs = planPairs([entry('a', 1500, 40), entry('b', 1500, 35), entry('c', 1500, 31)], T0);
		expect(pairs).toHaveLength(1);
		expect(ids(pairs)).toEqual([['a', 'b']]);
	});
});

describe('planPairs: same opponent cooldown (design 4.2)', () => {
	const until = T0 + QUEUE_SAME_OPPONENT_COOLDOWN_SEC * 1000;

	it('skips the last opponent while someone else is searching', () => {
		const a = entry('a', 1500, 40, {lastOpponentId: 'b', lastOpponentUntil: until});
		const b = entry('b', 1500, 39, {lastOpponentId: 'a', lastOpponentUntil: until});
		const c = entry('c', 1900, 38);
		expect(ids(planPairs([a, b, c], T0))).toEqual([['a', 'c']]);
	});

	it('applies the rule from either side', () => {
		const a = entry('a', 1500, 40);
		const b = entry('b', 1500, 39, {lastOpponentId: 'a', lastOpponentUntil: until});
		const c = entry('c', 1500, 38);
		expect(ids(planPairs([a, b, c], T0))).toEqual([['a', 'c']]);
	});

	it('pairs them again when nobody else is in the queue', () => {
		const a = entry('a', 1500, 40, {lastOpponentId: 'b', lastOpponentUntil: until});
		const b = entry('b', 1500, 39, {lastOpponentId: 'a', lastOpponentUntil: until});
		expect(ids(planPairs([a, b], T0))).toEqual([['a', 'b']]);
	});

	it('lets the pair meet again after 2 minutes', () => {
		const a = entry('a', 1500, 40, {lastOpponentId: 'b', lastOpponentUntil: until});
		const b = entry('b', 1500, 39);
		const c = entry('c', 1500, 38);
		expect(ids(planPairs([a, b, c], until + 1))).toEqual([['a', 'b']]);
	});
});

describe('BattleMatcher.tick', () => {
	function setup(alive: Set<string> = new Set()) {
		const clock = new FakeClock(T0);
		const store = new MemoryStore(clock);
		const emitted: Array<{socketId: string; event: string; payload: any}> = [];
		const paired: Array<[string, string]> = [];
		const matcher = new BattleMatcher({
			store,
			clock,
			isSocketAlive: async (socketId) => alive.has(socketId),
			emitToSocket: (socketId, event, payload) => emitted.push({socketId, event, payload}),
			onPair: async (a, b) => {
				paired.push([a.userId, b.userId]);
			},
		});
		const join = async (e: QueueEntry) => {
			alive.add(e.socketId);
			await putQueueEntry(store, e);
			await setBattleSession(store, e.userId, {kind: 'queue', socketId: e.socketId, since: e.joinedAt});
		};
		return {clock, store, emitted, paired, matcher, alive, join};
	}

	it('claims a pair, takes both out of the queue and starts the match', async () => {
		const t = setup();
		await t.join(entry('a', 1500, 0));
		await t.join(entry('b', 1520, 0));
		await t.matcher.tick();
		expect(t.paired).toEqual([['a', 'b']]);
		expect(await countSearching(t.store)).toBe(0);
		expect(await getQueueEntry(t.store, 'a')).toBeNull();
	});

	it('drops a ghost socket from the queue and keeps the live player searching', async () => {
		const t = setup();
		await t.join(entry('a', 1500, 0));
		await t.join(entry('ghost', 1500, 0));
		t.alive.delete('sock-ghost');
		await t.matcher.tick();
		expect(t.paired).toEqual([]);
		expect(await getQueueEntry(t.store, 'ghost')).toBeNull();
		expect(await getBattleSession(t.store, 'ghost')).toBeNull();
		expect(await getQueueEntry(t.store, 'a')).not.toBeNull();
		expect(await getBattleSession(t.store, 'a')).toMatchObject({kind: 'queue'});

		// The next live player is paired with the one who stayed.
		await t.join(entry('c', 1500, 0));
		await t.matcher.tick();
		expect(t.paired).toEqual([['a', 'c']]);
	});

	it('pairs across the window only after 30 s of waiting', async () => {
		const t = setup();
		await t.join(entry('a', 1200, 0));
		await t.join(entry('b', 2000, 0));
		await t.matcher.tick();
		expect(t.paired).toEqual([]);
		await t.clock.advance(29_000);
		await t.matcher.tick();
		expect(t.paired).toEqual([]);
		await t.clock.advance(1_000);
		await t.matcher.tick();
		expect(t.paired).toEqual([['a', 'b']]);
	});

	it('refreshes queue_state with the waiting time and the searching count', async () => {
		const t = setup();
		await t.join(entry('a', 1500, 0));
		await t.clock.advance(5_000);
		await t.matcher.tick();
		const state = t.emitted.filter((e) => e.event === BattleServerEvent.QUEUE_STATE);
		expect(state).toHaveLength(1);
		expect(state[0]).toMatchObject({socketId: 'sock-a', payload: {searching: true, waitedSec: 5, searchingCount: 1}});
	});

	it('asks "still here" after 10 minutes and removes the player who does not answer', async () => {
		const t = setup();
		await t.join(entry('a', 1500, 0));
		await t.clock.advance(QUEUE_IDLE_CHECK_SEC * 1000);
		await t.matcher.tick();
		const asked = t.emitted.filter((e) => e.payload?.askStillHere);
		expect(asked).toHaveLength(1);
		expect(asked[0].payload.stillHereDeadline).toBe(T0 + (QUEUE_IDLE_CHECK_SEC + STILL_HERE_ANSWER_SEC) * 1000);

		await t.clock.advance(STILL_HERE_ANSWER_SEC * 1000);
		await t.matcher.tick();
		expect(await getQueueEntry(t.store, 'a')).toBeNull();
		expect(await getBattleSession(t.store, 'a')).toBeNull();
		const last = t.emitted[t.emitted.length - 1];
		expect(last).toMatchObject({event: BattleServerEvent.QUEUE_STATE, payload: {searching: false}});
	});

	it('keeps the player who answers "still here" and restarts the 10 minutes', async () => {
		const t = setup();
		await t.join(entry('a', 1500, 0));
		await t.clock.advance(QUEUE_IDLE_CHECK_SEC * 1000);
		await t.matcher.tick();
		await t.clock.advance(10_000);
		expect(await confirmStillHere(t.store, 'a', 'sock-other', t.clock.now())).toBe(false);
		expect(await confirmStillHere(t.store, 'a', 'sock-a', t.clock.now())).toBe(true);
		await t.clock.advance(STILL_HERE_ANSWER_SEC * 1000);
		await t.matcher.tick();
		const e = await getQueueEntry(t.store, 'a');
		expect(e).toMatchObject({askDeadline: null, joinedAt: T0});
	});

	it('does not run two ticks at once', async () => {
		const t = setup();
		await t.join(entry('a', 1500, 0));
		await t.join(entry('b', 1500, 0));
		await Promise.all([t.matcher.tickWithLock(), t.matcher.tickWithLock()]);
		expect(t.paired).toEqual([['a', 'b']]);
	});

	it('runs every second once started', async () => {
		const t = setup();
		t.matcher.start();
		await t.join(entry('a', 1500, 0));
		await t.join(entry('b', 1500, 0));
		await t.clock.advance(1_000);
		expect(t.paired).toEqual([['a', 'b']]);
		t.matcher.stop();
		expect(t.clock.pendingTimers()).toBe(0);
	});
});

describe('queue storage', () => {
	it('claims a pair only when both removals succeed, and puts the other back otherwise', async () => {
		const clock = new FakeClock(T0);
		const store = new MemoryStore(clock);
		const a = entry('a', 1500, 0);
		const b = entry('b', 1510, 0);
		await putQueueEntry(store, a);
		await putQueueEntry(store, b);
		// Another process already took b.
		await store.zrem(queueKey(), 'b');
		expect(await claimPair(store, a, b)).toBe(false);
		expect(await countSearching(store)).toBe(1);
		expect((await store.zrangeWithScores(queueKey()))[0]).toEqual({member: 'a', score: 1500});
	});

	it('drops half written entries (member without meta, meta without member)', async () => {
		const clock = new FakeClock(T0);
		const store = new MemoryStore(clock);
		await putQueueEntry(store, entry('ok', 1500, 0));
		await store.zadd(queueKey(), 1500, 'no-meta');
		await store.hset(queueMetaKey(), 'no-member', JSON.stringify(entry('no-member', 1500, 0)));
		const entries = await getQueueEntries(store);
		expect(entries.map((e) => e.userId)).toEqual(['ok']);
		expect(await store.hget(queueMetaKey(), 'no-member')).toBeNull();
		expect(await countSearching(store)).toBe(1);
	});
});

describe('startup cleanup (design 4.6)', () => {
	it('empties the queue and every battle session, and leaves friendly room sessions alone', async () => {
		const clock = new FakeClock(T0);
		const store = new MemoryStore(clock);
		await putQueueEntry(store, entry('a', 1500, 0));
		await putQueueEntry(store, entry('b', 1500, 0));
		await setBattleSession(store, 'a', {kind: 'queue', socketId: 'sock-a', since: T0});
		await setBattleSession(store, 'c', {kind: 'match', socketId: 'sock-c', matchId: 'm1', since: T0});
		const roomKey = battleKey(RedisNamespace.FRIENDLY_ROOM_SESSION, 'a');
		await store.set(roomKey, '{"roomId":"r"}');

		await clearQueue(store);
		expect(await clearAllBattleSessions(store)).toBe(2);

		expect(await countSearching(store)).toBe(0);
		expect(await store.hgetall(queueMetaKey())).toEqual({});
		expect(await getBattleSession(store, 'a')).toBeNull();
		expect(await getBattleSession(store, 'c')).toBeNull();
		expect(await store.get(roomKey)).not.toBeNull();
	});
});
