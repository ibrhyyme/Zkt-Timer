// Online Battle match manager on a fake clock and an in-memory store (design
// ranking-battle.md 4.1, 4.3, 4.5-4.7): full match, drawn rounds, disconnect and return,
// forfeit, cancel before start, rematch, the daily pair limit, per-player inspection,
// server restart, check 9, the queue join conditions (the site flag first) and the duel
// mode (never rated, outside the pair limit, its rematch a duel again).

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));
jest.mock('../../database', () => ({getPrisma: () => ({})}));

import {
	COUNTDOWN_SEC,
	DISCONNECT_GRACE_SEC,
	MATCH_FOUND_SEC,
	MAX_ROUNDS,
	REMATCH_WINDOW_SEC,
	ROUND_RESULT_SEC,
	SCRAMBLE_CLOCK_SLACK_MS,
	SCRAMBLE_SEC,
	SCRAMBLE_TIMEOUT_SEC,
} from '../../../shared/battle/config';
import {BATTLE_ERROR_KEYS, BattleServerEvent} from '../../../shared/battle/events';
import {BattleSide} from '../../../shared/battle/types';
import {buildSolve, FIXTURE_SCRAMBLE, FixtureSolve, honestProgress} from '../../../shared/battle/testing/fixtures';
import {startStateFromScramble} from '../../../shared/util/solve/start_state';
import {
	isOnlineBattleOpen,
	PersistMatchInput,
	PersistMatchResult,
	planMatchPersistence,
	StoredBattleRating,
} from '../../models/battle';
import {RedisNamespace} from '../../services/redis';
import {
	BattleMatchManager,
	historyCheck,
	INSPECTION_WINDOW_MS,
	matchKey,
	MatchManagerDeps,
	voidInterruptedMatches,
} from '../match_manager';
import {getQueueEntry, joinQueue, JoinQueueDeps} from '../queue';
import {getBattleSession, getQueueCooldownSec, getRecentOpponent, setBattleSession} from '../session';
import {battleKey} from '../store';
import {FakeClock, flushAsync, MemoryStore} from '../testing/memory';

const FACELETS = startStateFromScramble(FIXTURE_SCRAMBLE) as string;
const A = {userId: 'user-a', socketId: 'sock-a', ip: '10.0.0.1'};
const B = {userId: 'user-b', socketId: 'sock-b', ip: '10.0.0.2'};

/** ~8-9 s solve. */
const FAST = buildSolve({seed: 1, minGapMs: 150, maxGapMs: 220, inspectionMs: 5000});
/** ~15 s solve. */
const SLOW = buildSolve({seed: 2, minGapMs: 280, maxGapMs: 380, inspectionMs: 6000});

interface Emitted {
	socketId: string;
	event: string;
	payload: any;
}

function setup(over: Partial<MatchManagerDeps> = {}, opts: {pairCount?: number} = {}) {
	const clock = new FakeClock();
	const store = new MemoryStore(clock);
	const emitted: Emitted[] = [];
	const persisted: PersistMatchInput[] = [];
	const stored = new Map<string, StoredBattleRating>();
	let ids = 0;
	const state = {pairCount: opts.pairCount ?? 0};

	const persistMatch = jest.fn(async (input: PersistMatchInput): Promise<PersistMatchResult> => {
		persisted.push(input);
		const plan = planMatchPersistence(input, stored.get(input.a.userId) ?? null, stored.get(input.b.userId) ?? null);
		if (plan.rated) state.pairCount++;
		return {...plan.result, matchId: input.id as string};
	});

	const deps: MatchManagerDeps = {
		store,
		clock,
		emitToSocket: (socketId, event, payload) => emitted.push({socketId, event, payload}),
		generateScramble: () => FIXTURE_SCRAMBLE,
		newId: () => `match-${++ids}`,
		loadProfile: async (userId) => ({username: userId.toUpperCase(), avatar: null}),
		getStoredRating: async (userId) => stored.get(userId) ?? null,
		countPairRatedMatches: jest.fn(async () => state.pairCount),
		persistMatch,
		appendBattleFlags: jest.fn(async () => undefined),
		loadSolveHistoryMs: jest.fn(async () => []),
		...over,
	};
	const manager = new BattleMatchManager(deps);

	const events = (socketId: string, event: BattleServerEvent) =>
		emitted.filter((e) => e.socketId === socketId && e.event === event).map((e) => e.payload);
	const last = (socketId: string, event: BattleServerEvent) => {
		const list = events(socketId, event);
		return list[list.length - 1];
	};

	return {clock, store, emitted, persisted, stored, deps, manager, events, last, state};
}

type Ctx = ReturnType<typeof setup>;
type Play = FixtureSolve | 'DNF' | 'skip';

function who(side: BattleSide) {
	return side === 'A' ? A : B;
}

/** Found screen and countdown: the first scramble is on screen afterwards. */
async function toFirstScramble(ctx: Ctx) {
	await ctx.clock.advance(MATCH_FOUND_SEC * 1000);
	await ctx.clock.advance(COUNTDOWN_SEC * 1000);
}

async function scrambleDone(ctx: Ctx, matchId: string, round: number, side: BattleSide, solve: FixtureSolve) {
	const p = who(side);
	await ctx.manager.handleScrambleDone(p.userId, p.socketId, {
		matchId,
		round,
		facelets: FACELETS,
		lastScrambleCubeTs: solve.lastScrambleCubeTs,
	});
	await ctx.manager.handleSolveStart(p.userId, p.socketId, {matchId, round, inspectionMs: solve.inspectionMs});
}

async function solveDone(ctx: Ctx, matchId: string, round: number, side: BattleSide, solve: FixtureSolve, penalty: 'DNF' | null = null) {
	const p = who(side);
	for (const ev of honestProgress(solve.scramble, solve.moves)) {
		await ctx.manager.handleProgress(p.userId, p.socketId, {matchId, round, step: ev.step as any, atMs: ev.atMs});
	}
	await ctx.manager.handleSolveDone(p.userId, p.socketId, {
		matchId,
		round,
		timeMs: solve.timeMs,
		penalty,
		source: 'tracker',
		timeCorrectionMs: 0,
		moves: solve.moves,
	});
}

/** Both players scramble together, then solve; 'DNF' sends the client's own DNF. */
async function playRound(ctx: Ctx, matchId: string, round: number, a: Play, b: Play) {
	const plays: Array<[BattleSide, Play]> = [
		['A', a],
		['B', b],
	];
	for (const [side, play] of plays) {
		if (play !== 'skip') await scrambleDone(ctx, matchId, round, side, play === 'DNF' ? SLOW : play);
	}
	const longest = Math.max(
		...plays.map(([, play]) => (play === 'skip' ? 0 : (play === 'DNF' ? SLOW : play).inspectionMs + (play === 'DNF' ? SLOW : play).timeMs))
	);
	await ctx.clock.advance(longest + 500);
	for (const [side, play] of plays) {
		if (play === 'skip') continue;
		await solveDone(ctx, matchId, round, side, play === 'DNF' ? SLOW : play, play === 'DNF' ? 'DNF' : null);
	}
}

/** Round result screen, next countdown, scramble on screen. */
async function toNextScramble(ctx: Ctx) {
	await ctx.clock.advance(ROUND_RESULT_SEC * 1000);
	await ctx.clock.advance(COUNTDOWN_SEC * 1000);
}

afterEach(() => jest.clearAllMocks());

describe('full match', () => {
	it('plays first to three, writes the rated result and shows the previewed delta', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);

		const matchedA = ctx.last(A.socketId, BattleServerEvent.MATCHED);
		const matchedB = ctx.last(B.socketId, BattleServerEvent.MATCHED);
		expect(matchedA).toMatchObject({matchId: match.id, side: 'A', rated: true, isRematch: false});
		expect(matchedA.opponent).toMatchObject({id: B.userId, username: 'USER-B', rating: 1500, provisional: true});
		expect(matchedB.side).toBe('B');
		expect(matchedA.preview).toEqual({win: 162, draw: 0, loss: -162});
		expect(matchedA.startsAt).toBe(ctx.clock.now() + MATCH_FOUND_SEC * 1000);
		expect((await getBattleSession(ctx.store, A.userId))?.matchId).toBe(match.id);

		await toFirstScramble(ctx);
		const start = ctx.last(A.socketId, BattleServerEvent.ROUND_START);
		expect(start).toMatchObject({matchId: match.id, round: 1, scramble: FIXTURE_SCRAMBLE});
		expect(start.scrambleDeadline - start.goAt).toBe(SCRAMBLE_TIMEOUT_SEC * 1000);
		expect(ctx.last(B.socketId, BattleServerEvent.ROUND_START)).toEqual(start);

		await playRound(ctx, match.id, 1, FAST, SLOW);
		const r1 = ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT);
		expect(r1).toMatchObject({round: 1, winner: 'A', score: {a: 1, b: 0}});
		expect(r1.a.penalty).toBeNull();
		expect(r1.a.timeMs).toBe(FAST.timeMs);

		await toNextScramble(ctx);
		await playRound(ctx, match.id, 2, FAST, SLOW);
		expect(ctx.last(B.socketId, BattleServerEvent.ROUND_RESULT)).toMatchObject({round: 2, winner: 'A', score: {a: 2, b: 0}});
		expect(ctx.events(A.socketId, BattleServerEvent.MATCH_RESULT)).toHaveLength(0);

		await toNextScramble(ctx);
		await playRound(ctx, match.id, 3, FAST, SLOW);
		expect(ctx.last(B.socketId, BattleServerEvent.ROUND_RESULT)).toMatchObject({round: 3, winner: 'A', score: {a: 3, b: 0}});

		// The match result waits for the round result screen.
		expect(ctx.events(A.socketId, BattleServerEvent.MATCH_RESULT)).toHaveLength(0);
		await ctx.clock.advance(ROUND_RESULT_SEC * 1000);

		const resA = ctx.last(A.socketId, BattleServerEvent.MATCH_RESULT);
		const resB = ctx.last(B.socketId, BattleServerEvent.MATCH_RESULT);
		expect(resA).toMatchObject({winner: 'A', endReason: 'NORMAL', rated: true, ratingBefore: 1500, games: 1});
		expect(resA.delta).toBe(matchedA.preview.win);
		expect(resB.delta).toBe(matchedB.preview.loss);
		expect(resA.rounds.map((r: any) => r.round)).toEqual([1, 2, 3]);

		expect(ctx.persisted).toHaveLength(1);
		const written = ctx.persisted[0];
		expect(written).toMatchObject({id: match.id, status: 'FINISHED', endReason: 'NORMAL', rated: true, winner: 'A'});
		expect(written.rounds.map((r) => [r.index, r.winner])).toEqual([
			[1, 'A'],
			[2, 'A'],
			[3, 'A'],
		]);
		expect(written.rounds[0].a.moves).toHaveLength(FAST.moves.length);
		expect(written.startedAt.getTime()).toBe(match.startedAt);

		// Rematch window, then everything is cleaned up.
		const rematch = ctx.last(A.socketId, BattleServerEvent.REMATCH_STATE);
		expect(rematch).toMatchObject({you: false, opponent: false, rated: true});
		await ctx.clock.advance(REMATCH_WINDOW_SEC * 1000 + 10);
		expect(ctx.manager.getMatch(match.id)).toBeUndefined();
		expect(await getBattleSession(ctx.store, A.userId)).toBeNull();
		expect(await ctx.store.get(matchKey(match.id))).toBeNull();
		expect((await getRecentOpponent(ctx.store, A.userId))?.opponentId).toBe(B.userId);
	});

	it('keeps the snapshot in Redis while the match runs', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		const raw = await ctx.store.get(matchKey(match.id));
		expect(JSON.parse(raw as string).a.userId).toBe(A.userId);
	});

	it('flags two players on the same IP without blocking them', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, {...B, ip: A.ip});
		expect(match.flags).toEqual(['same_ip']);
	});
});

describe('drawn rounds', () => {
	it('replays a drawn round with a new round number', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await playRound(ctx, match.id, 1, 'DNF', 'DNF');
		expect(ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT)).toMatchObject({round: 1, winner: 'DRAW', score: {a: 0, b: 0}});
		await toNextScramble(ctx);
		expect(ctx.last(A.socketId, BattleServerEvent.ROUND_START).round).toBe(2);
	});

	it('ends seven rounds without three wins as a draw (rated 0.5)', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		for (let round = 1; round <= MAX_ROUNDS; round++) {
			await playRound(ctx, match.id, round, 'DNF', 'DNF');
			if (round < MAX_ROUNDS) await toNextScramble(ctx);
		}
		await ctx.clock.advance(ROUND_RESULT_SEC * 1000);
		const res = ctx.last(A.socketId, BattleServerEvent.MATCH_RESULT);
		expect(res).toMatchObject({winner: 'DRAW', endReason: 'NORMAL', rated: true, delta: 0});
		expect(ctx.persisted[0].winner).toBe('DRAW');
	});
});

describe('per player inspection (design 4.5)', () => {
	it('starts each inspection at that player\'s own scramble_done', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);

		// A scrambles fast and solves while B is still scrambling.
		await scrambleDone(ctx, match.id, 1, 'A', SLOW);
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE)).toMatchObject({phase: 'solving', round: 1});
		await ctx.clock.advance(SLOW.inspectionMs + SLOW.timeMs + 300);
		await solveDone(ctx, match.id, 1, 'A', SLOW);
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE)).toMatchObject({phase: 'finished', timeMs: SLOW.timeMs});

		// B finishes the scramble 25 s after goAt, past A's whole solve; B's inspection is
		// measured from that moment. The slow scramble itself costs B +2.
		await ctx.clock.advance(25_000 - (SLOW.inspectionMs + SLOW.timeMs + 300));
		await scrambleDone(ctx, match.id, 1, 'B', FAST);
		await ctx.clock.advance(FAST.inspectionMs + FAST.timeMs + 300);
		await solveDone(ctx, match.id, 1, 'B', FAST);

		const r = ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT);
		expect(r.winner).toBe('B');
		expect(r.b).toMatchObject({penalty: 'PLUS_TWO', dnfReason: null});
		expect(r.a).toMatchObject({penalty: null, dnfReason: null});
	});

	it('gives +2 from the cube clock when a player inspects over 15 s', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		const longInspection = buildSolve({seed: 3, inspectionMs: 16_000});
		await playRound(ctx, match.id, 1, longInspection, SLOW);
		expect(ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT).a.penalty).toBe('PLUS_TWO');
	});

	it('gives +2 for a scramble over 20 s and stacks it on an inspection +2', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		const longInspection = buildSolve({seed: 3, inspectionMs: 16_000});
		await scrambleDone(ctx, match.id, 1, 'B', SLOW);
		await ctx.clock.advance(SCRAMBLE_SEC * 1000 + SCRAMBLE_CLOCK_SLACK_MS + 500);
		await scrambleDone(ctx, match.id, 1, 'A', longInspection);
		await ctx.clock.advance(longInspection.inspectionMs + longInspection.timeMs + 300);
		await solveDone(ctx, match.id, 1, 'A', longInspection);
		await solveDone(ctx, match.id, 1, 'B', SLOW);
		const r = ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT);
		expect(r.a).toMatchObject({penalty: 'PLUS_FOUR', dnfReason: null});
		expect(r.b).toMatchObject({penalty: null});
	});

	it('takes the device scramble time when it is within the slack of the server interval', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		// Done on the device at 19.8 s; scramble_done reaches the server at 20.4 s.
		await ctx.clock.advance(20_400);
		const p = who('A');
		await ctx.manager.handleScrambleDone(p.userId, p.socketId, {
			matchId: match.id,
			round: 1,
			facelets: FACELETS,
			lastScrambleCubeTs: FAST.lastScrambleCubeTs,
			scrambleMs: 19_800,
		});
		await ctx.manager.handleSolveStart(p.userId, p.socketId, {matchId: match.id, round: 1, inspectionMs: FAST.inspectionMs});
		await scrambleDone(ctx, match.id, 1, 'B', SLOW);
		await ctx.clock.advance(SLOW.inspectionMs + SLOW.timeMs + 300);
		await solveDone(ctx, match.id, 1, 'A', FAST);
		await solveDone(ctx, match.id, 1, 'B', SLOW);
		expect(ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT).a.penalty).toBeNull();
	});

	it('does not take a device scramble time far under the server interval', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await ctx.clock.advance(23_000);
		const p = who('A');
		await ctx.manager.handleScrambleDone(p.userId, p.socketId, {
			matchId: match.id,
			round: 1,
			facelets: FACELETS,
			lastScrambleCubeTs: FAST.lastScrambleCubeTs,
			scrambleMs: 4_000,
		});
		await ctx.manager.handleSolveStart(p.userId, p.socketId, {matchId: match.id, round: 1, inspectionMs: FAST.inspectionMs});
		await scrambleDone(ctx, match.id, 1, 'B', SLOW);
		await ctx.clock.advance(SLOW.inspectionMs + SLOW.timeMs + 300);
		await solveDone(ctx, match.id, 1, 'A', FAST);
		await solveDone(ctx, match.id, 1, 'B', SLOW);
		expect(ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT).a.penalty).toBe('PLUS_TWO');
	});

	it('refuses a scramble the cube does not match and keeps the player scrambling', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		const solved = startStateFromScramble('') as string;
		await ctx.manager.handleScrambleDone(A.userId, A.socketId, {matchId: match.id, round: 1, facelets: solved, lastScrambleCubeTs: [1, 2]});
		expect(ctx.last(A.socketId, BattleServerEvent.ERROR)).toEqual({i18nKey: BATTLE_ERROR_KEYS.scrambleMismatch});
		expect(ctx.events(B.socketId, BattleServerEvent.OPPONENT_STATE)).toHaveLength(0);
		await scrambleDone(ctx, match.id, 1, 'A', FAST);
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE).phase).toBe('solving');
	});

	// Seen in the closed test, 2026-10-13: the player past 17 s saw DNF on their own screen
	// while the opponent kept seeing them "inspecting" for two minutes.
	it('DNFs an inspection that never starts a solve and tells the opponent at once', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await ctx.manager.handleScrambleDone(A.userId, A.socketId, {
			matchId: match.id,
			round: 1,
			facelets: FACELETS,
			lastScrambleCubeTs: FAST.lastScrambleCubeTs,
		});
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE).phase).toBe('inspecting');

		await ctx.clock.advance(INSPECTION_WINDOW_MS + 10);
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE)).toMatchObject({phase: 'finished', penalty: 'DNF'});

		// A late first move changes nothing.
		await ctx.manager.handleSolveStart(A.userId, A.socketId, {matchId: match.id, round: 1, inspectionMs: 25_000});
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE).phase).toBe('finished');

		await scrambleDone(ctx, match.id, 1, 'B', FAST);
		await ctx.clock.advance(FAST.inspectionMs + FAST.timeMs + 300);
		await solveDone(ctx, match.id, 1, 'B', FAST);
		const r = ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT);
		expect(r.winner).toBe('B');
		expect(r.a).toMatchObject({penalty: 'DNF', dnfReason: 'inspection'});
	});

	it('leaves a solve that starts inside the inspection window alone', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		const late = buildSolve({seed: 4, inspectionMs: 16_000});
		await ctx.manager.handleScrambleDone(A.userId, A.socketId, {
			matchId: match.id,
			round: 1,
			facelets: FACELETS,
			lastScrambleCubeTs: late.lastScrambleCubeTs,
		});
		await ctx.clock.advance(16_000);
		await ctx.manager.handleSolveStart(A.userId, A.socketId, {matchId: match.id, round: 1, inspectionMs: 16_000});
		// Well past the window: the started solve must not be cut off by it.
		await ctx.clock.advance(INSPECTION_WINDOW_MS);
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE).phase).toBe('solving');
	});

	it('loses the round when the scramble is not done in 90 s', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await scrambleDone(ctx, match.id, 1, 'B', FAST);
		await ctx.clock.advance(FAST.inspectionMs + FAST.timeMs + 300);
		await solveDone(ctx, match.id, 1, 'B', FAST);
		await ctx.clock.advance(SCRAMBLE_TIMEOUT_SEC * 1000);
		const r = ctx.last(A.socketId, BattleServerEvent.ROUND_RESULT);
		expect(r).toMatchObject({winner: 'B'});
		expect(r.a).toMatchObject({penalty: 'DNF', dnfReason: 'scramble_timeout'});
	});

	it('ignores events from a socket that is not bound to the match', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await ctx.manager.handleScrambleDone(A.userId, 'other-tab', {matchId: match.id, round: 1, facelets: FACELETS, lastScrambleCubeTs: [1, 2]});
		expect(ctx.events(B.socketId, BattleServerEvent.OPPONENT_STATE)).toHaveLength(0);
	});
});

describe('disconnects (design 4.6)', () => {
	it('continues when the player is back within 20 s', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);

		await ctx.manager.handleDisconnect(A.userId, A.socketId);
		const off = ctx.last(B.socketId, BattleServerEvent.OPPONENT_CONNECTION);
		expect(off).toMatchObject({connected: false, graceUntil: ctx.clock.now() + DISCONNECT_GRACE_SEC * 1000});

		await ctx.clock.advance(5000);
		await ctx.manager.handleResume(A.userId, 'sock-a2', {matchId: match.id});
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_CONNECTION)).toMatchObject({connected: true});
		const state = ctx.last('sock-a2', BattleServerEvent.MATCH_STATE);
		expect(state).toMatchObject({matchId: match.id, round: 1, phase: 'scrambling', opponentConnected: true});
		expect(state.matched.side).toBe('A');
		expect((await getBattleSession(ctx.store, A.userId))?.socketId).toBe('sock-a2');

		// Grace timer is gone: nothing happens at the old deadline; the new socket plays.
		await ctx.clock.advance(DISCONNECT_GRACE_SEC * 1000);
		expect(ctx.events(A.socketId, BattleServerEvent.ROUND_RESULT)).toHaveLength(0);
		const p = {userId: A.userId, socketId: 'sock-a2'};
		await ctx.manager.handleScrambleDone(p.userId, p.socketId, {matchId: match.id, round: 1, facelets: FACELETS, lastScrambleCubeTs: FAST.lastScrambleCubeTs});
		expect(ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE).phase).toBe('inspecting');
	});

	it('loses the round after 20 s away and the match at the next scramble deadline', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await ctx.manager.handleDisconnect(A.userId, A.socketId);

		// B plays round 1 normally.
		await scrambleDone(ctx, match.id, 1, 'B', FAST);
		await ctx.clock.advance(DISCONNECT_GRACE_SEC * 1000);
		const r1 = ctx.last(B.socketId, BattleServerEvent.OPPONENT_STATE);
		expect(r1).toMatchObject({phase: 'finished', penalty: 'DNF'});
		await solveDone(ctx, match.id, 1, 'B', FAST);
		expect(ctx.last(B.socketId, BattleServerEvent.ROUND_RESULT)).toMatchObject({round: 1, winner: 'B'});
		expect(ctx.last(B.socketId, BattleServerEvent.ROUND_RESULT).a.dnfReason).toBe('disconnect');

		// Round 2: A still away when the scramble time runs out -> forfeit, rated.
		await toNextScramble(ctx);
		await ctx.clock.advance(SCRAMBLE_TIMEOUT_SEC * 1000);
		const res = ctx.last(B.socketId, BattleServerEvent.MATCH_RESULT);
		expect(res).toMatchObject({winner: 'B', endReason: 'DISCONNECT', rated: true});
		expect(ctx.persisted[0]).toMatchObject({status: 'FINISHED', endReason: 'DISCONNECT', winner: 'B', rated: true});
		// The one who left cannot be asked for a rematch.
		expect(ctx.last(B.socketId, BattleServerEvent.REMATCH_STATE).opponent).toBe('left');
	});

	it('voids the match when both players are gone', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await ctx.manager.handleDisconnect(A.userId, A.socketId);
		await ctx.manager.handleDisconnect(B.userId, B.socketId);
		await ctx.clock.advance(DISCONNECT_GRACE_SEC * 1000);

		expect(ctx.persisted[0]).toMatchObject({status: 'VOID', endReason: 'DISCONNECT', rated: false, winner: null});
		expect(ctx.last(A.socketId, BattleServerEvent.CANCELLED)).toEqual({matchId: match.id, reason: 'both_disconnected'});
		// A reconnecting client learns why.
		await ctx.manager.handleResume(A.userId, 'sock-a2', {matchId: match.id});
		expect(ctx.last('sock-a2', BattleServerEvent.CANCELLED)).toEqual({matchId: match.id, reason: 'both_disconnected'});
		expect(await getQueueCooldownSec(ctx.store, A.userId)).toBe(0);
	});

	it('answers a resume without a match with not_found', async () => {
		const ctx = setup();
		await ctx.manager.handleResume(A.userId, A.socketId, {});
		expect(ctx.last(A.socketId, BattleServerEvent.CANCELLED)).toEqual({reason: 'not_found'});
	});
});

describe('forfeit and cancel', () => {
	it('gives up as a rated loss once the scramble was shown', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await ctx.manager.handleGiveUp(B.userId, B.socketId, {matchId: match.id});
		expect(ctx.last(A.socketId, BattleServerEvent.MATCH_RESULT)).toMatchObject({winner: 'A', endReason: 'FORFEIT', rated: true});
		expect(ctx.persisted[0]).toMatchObject({endReason: 'FORFEIT', winner: 'A', rated: true});
	});

	it('cancels unrated when someone leaves on the opponent found screen, with growing cooldowns', async () => {
		const ctx = setup();
		const m1 = await ctx.manager.createMatch(A, B);
		await ctx.clock.advance(1000);
		await ctx.manager.handleGiveUp(B.userId, B.socketId, {matchId: m1.id});

		expect(ctx.last(A.socketId, BattleServerEvent.CANCELLED)).toEqual({matchId: m1.id, reason: 'left_before_start'});
		expect(ctx.persisted).toHaveLength(0);
		expect(await getQueueCooldownSec(ctx.store, B.userId)).toBe(60);
		expect(await getQueueCooldownSec(ctx.store, A.userId)).toBe(0);
		expect(ctx.manager.getMatch(m1.id)).toBeUndefined();

		await ctx.clock.advance(61_000);
		const m2 = await ctx.manager.createMatch(A, B);
		await ctx.manager.handleGiveUp(B.userId, B.socketId, {matchId: m2.id});
		expect(await getQueueCooldownSec(ctx.store, B.userId)).toBe(300);
	});

	it('cancels when a player dropped on the found screen is not back when the scramble opens', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await ctx.manager.handleDisconnect(A.userId, A.socketId);
		await toFirstScramble(ctx);
		expect(ctx.last(B.socketId, BattleServerEvent.CANCELLED)).toEqual({matchId: match.id, reason: 'left_before_start'});
		expect(await getQueueCooldownSec(ctx.store, A.userId)).toBe(60);
		expect(ctx.persisted).toHaveLength(0);
	});
});

describe('rematch and the daily pair limit (design 4.5, Q1)', () => {
	async function finishQuickly(ctx: Ctx, matchId: string) {
		await toFirstScramble(ctx);
		await ctx.manager.handleGiveUp(B.userId, B.socketId, {matchId});
	}

	it('starts a new rated match when both press rematch', async () => {
		const ctx = setup();
		const m1 = await ctx.manager.createMatch(A, B);
		await finishQuickly(ctx, m1.id);

		await ctx.manager.handleRematch(A.userId, A.socketId, {matchId: m1.id, accept: true});
		expect(ctx.last(B.socketId, BattleServerEvent.REMATCH_STATE)).toMatchObject({you: false, opponent: true});
		await ctx.manager.handleRematch(B.userId, B.socketId, {matchId: m1.id, accept: true});

		const matched = ctx.last(A.socketId, BattleServerEvent.MATCHED);
		expect(matched).toMatchObject({isRematch: true, rated: true});
		expect(matched.matchId).not.toBe(m1.id);
		expect(ctx.manager.getMatch(m1.id)).toBeUndefined();
		expect((await getBattleSession(ctx.store, B.userId))?.matchId).toBe(matched.matchId);
	});

	it('marks the opponent as left when one picks a new opponent', async () => {
		const ctx = setup();
		const m1 = await ctx.manager.createMatch(A, B);
		await finishQuickly(ctx, m1.id);
		await ctx.manager.handleRematch(A.userId, A.socketId, {matchId: m1.id, accept: true});
		await ctx.manager.leaveFinished(B.userId);
		expect(ctx.last(A.socketId, BattleServerEvent.REMATCH_STATE)).toMatchObject({you: true, opponent: 'left'});
		expect(ctx.manager.matchStatusFor(B.userId)).toBeNull();
		expect(ctx.manager.matchStatusFor(A.userId)).toBe('finished');
	});

	it('plays the fourth match of the day between the same two unrated', async () => {
		const ctx = setup({}, {pairCount: 2});
		const m1 = await ctx.manager.createMatch(A, B);
		expect(ctx.last(A.socketId, BattleServerEvent.MATCHED).rated).toBe(true);
		await finishQuickly(ctx, m1.id);
		// That was the third rated match today: the rematch button says unrated.
		expect(ctx.last(A.socketId, BattleServerEvent.REMATCH_STATE).rated).toBe(false);

		await ctx.manager.handleRematch(A.userId, A.socketId, {matchId: m1.id, accept: true});
		await ctx.manager.handleRematch(B.userId, B.socketId, {matchId: m1.id, accept: true});
		const m2 = ctx.last(A.socketId, BattleServerEvent.MATCHED);
		expect(m2).toMatchObject({rated: false, preview: null, isRematch: true});

		await finishQuickly(ctx, m2.matchId);
		expect(ctx.persisted[1]).toMatchObject({rated: false, status: 'FINISHED'});
		expect(ctx.last(A.socketId, BattleServerEvent.MATCH_RESULT)).toMatchObject({rated: false, ratingBefore: null, delta: null});
	});
});

describe('duel mode (owner decision 2026-10-20)', () => {
	async function finishQuickly(ctx: Ctx, matchId: string) {
		await toFirstScramble(ctx);
		await ctx.manager.handleGiveUp(B.userId, B.socketId, {matchId});
	}

	it('plays a full duel unrated: no preview, no rating change, written as a duel', async () => {
		const countHeadToHead = jest.fn(async () => ({wins: 7, losses: 4, draws: 1}));
		const ctx = setup({countHeadToHead});
		const match = await ctx.manager.createMatch(A, B, {mode: 'challenge'});

		const matchedA = ctx.last(A.socketId, BattleServerEvent.MATCHED);
		expect(matchedA).toMatchObject({matchId: match.id, rated: false, challenge: true, preview: null, isRematch: false});
		expect(ctx.last(B.socketId, BattleServerEvent.MATCHED)).toMatchObject({rated: false, challenge: true, preview: null});
		// The pair limit is neither read nor used up.
		expect(ctx.deps.countPairRatedMatches).not.toHaveBeenCalled();

		await toFirstScramble(ctx);
		for (let round = 1; round <= 3; round++) {
			await playRound(ctx, match.id, round, FAST, SLOW);
			if (round < 3) await toNextScramble(ctx);
		}
		await ctx.clock.advance(ROUND_RESULT_SEC * 1000);

		const resA = ctx.last(A.socketId, BattleServerEvent.MATCH_RESULT);
		const resB = ctx.last(B.socketId, BattleServerEvent.MATCH_RESULT);
		expect(resA).toMatchObject({winner: 'A', rated: false, ratingBefore: null, ratingAfter: null, delta: null, challenge: true});
		expect(resA.headToHead).toEqual({wins: 7, losses: 4, draws: 1});
		// B sees the same score from their side.
		expect(resB.headToHead).toEqual({wins: 4, losses: 7, draws: 1});
		expect(countHeadToHead).toHaveBeenCalledWith(A.userId, B.userId);

		expect(ctx.persisted).toHaveLength(1);
		expect(ctx.persisted[0]).toMatchObject({rated: false, isChallenge: true, status: 'FINISHED', winner: 'A'});
		const plan = planMatchPersistence(ctx.persisted[0], null, null);
		expect(plan.rated).toBe(false);
		expect(plan.ratingWrites).toEqual([]);
		expect(plan.match).toMatchObject({rated: false, is_challenge: true});
		expect(plan.match.rating_a_before).toBeUndefined();

		expect(ctx.last(A.socketId, BattleServerEvent.REMATCH_STATE)).toMatchObject({rated: false});
		expect(ctx.deps.countPairRatedMatches).not.toHaveBeenCalled();
	});

	it('is a duel past the daily pair limit too, and does not count toward it', async () => {
		const ctx = setup({}, {pairCount: 3});
		const duel = await ctx.manager.createMatch(A, B, {mode: 'challenge'});
		await finishQuickly(ctx, duel.id);
		expect(ctx.persisted[0]).toMatchObject({rated: false, isChallenge: true, endReason: 'FORFEIT', winner: 'A'});
		// A rated match bumps the fake count; a duel must not.
		expect(ctx.state.pairCount).toBe(3);

		const fresh = setup({}, {pairCount: 0});
		for (let i = 0; i < 4; i++) {
			const d = await fresh.manager.createMatch(A, B, {mode: 'challenge'});
			await finishQuickly(fresh, d.id);
			await fresh.manager.leaveFinished(A.userId);
			await fresh.manager.leaveFinished(B.userId);
		}
		expect(fresh.state.pairCount).toBe(0);
		// Four duels later the queue still pairs them rated.
		await fresh.manager.createMatch(A, B);
		expect(fresh.last(A.socketId, BattleServerEvent.MATCHED)).toMatchObject({rated: true, challenge: false});
	});

	it('keeps the rematch of a duel a duel', async () => {
		const ctx = setup();
		const d1 = await ctx.manager.createMatch(A, B, {mode: 'challenge'});
		await finishQuickly(ctx, d1.id);
		await ctx.manager.handleRematch(A.userId, A.socketId, {matchId: d1.id, accept: true});
		await ctx.manager.handleRematch(B.userId, B.socketId, {matchId: d1.id, accept: true});

		const d2 = ctx.last(A.socketId, BattleServerEvent.MATCHED);
		expect(d2).toMatchObject({isRematch: true, challenge: true, rated: false, preview: null});
		expect(ctx.manager.getMatch(d2.matchId)?.mode).toBe('challenge');
		await finishQuickly(ctx, d2.matchId);
		expect(ctx.persisted[1]).toMatchObject({isRematch: true, isChallenge: true, rated: false});
		expect(ctx.deps.countPairRatedMatches).not.toHaveBeenCalled();
	});

	it('cancels a duel left on the found screen without a queue cooldown', async () => {
		const ctx = setup();
		const d = await ctx.manager.createMatch(A, B, {mode: 'challenge'});
		await ctx.manager.handleGiveUp(B.userId, B.socketId, {matchId: d.id});
		expect(ctx.last(A.socketId, BattleServerEvent.CANCELLED)).toEqual({matchId: d.id, reason: 'left_before_start'});
		expect(await getQueueCooldownSec(ctx.store, B.userId)).toBe(0);
		expect(ctx.persisted).toHaveLength(0);
	});

	it('writes an interrupted duel VOID as a duel after a restart', async () => {
		const ctx = setup();
		await ctx.manager.createMatch(A, B, {mode: 'challenge'});
		await toFirstScramble(ctx);
		ctx.manager.stop();
		const persist = jest.fn(async (input: PersistMatchInput) => ({...planMatchPersistence(input, null, null).result, matchId: input.id as string}));
		await voidInterruptedMatches(ctx.store, persist, ctx.clock.now());
		expect(persist.mock.calls[0][0]).toMatchObject({status: 'VOID', isChallenge: true, rated: false});
	});
});

describe('server restart (design 4.6)', () => {
	it('writes interrupted matches VOID and tells a reconnecting client why', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await playRound(ctx, match.id, 1, FAST, SLOW);
		ctx.manager.stop();

		// New process: same Redis, empty memory.
		const persisted: PersistMatchInput[] = [];
		const n = await voidInterruptedMatches(
			ctx.store,
			async (input) => {
				persisted.push(input);
				return {...planMatchPersistence(input, null, null).result, matchId: input.id as string};
			},
			ctx.clock.now()
		);
		expect(n).toBe(1);
		expect(persisted[0]).toMatchObject({id: match.id, status: 'VOID', endReason: 'SERVER_RESTART', rated: false});
		expect(persisted[0].rounds).toHaveLength(1);
		expect(await ctx.store.get(matchKey(match.id))).toBeNull();

		const fresh = new BattleMatchManager(ctx.deps);
		await fresh.handleResume(A.userId, 'sock-new', {matchId: match.id});
		expect(ctx.last('sock-new', BattleServerEvent.CANCELLED)).toEqual({matchId: match.id, reason: 'server_restart'});
	});
});

describe('check 9: own history', () => {
	it('flags solves far faster than the player\'s own smart cube history, after the result', async () => {
		const history = Array.from({length: 40}, (_, i) => 30_000 + i * 100);
		const loadSolveHistoryMs = jest.fn(async (userId: string) => (userId === A.userId ? history : []));
		const ctx = setup({loadSolveHistoryMs});
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await playRound(ctx, match.id, 1, FAST, SLOW);
		await toNextScramble(ctx);
		await playRound(ctx, match.id, 2, FAST, SLOW);
		await toNextScramble(ctx);
		await playRound(ctx, match.id, 3, FAST, SLOW);
		await ctx.clock.advance(ROUND_RESULT_SEC * 1000);
		await ctx.manager.idle();

		expect(ctx.deps.appendBattleFlags).toHaveBeenCalledWith(match.id, {
			match: ['beats_own_history'],
			rounds: [
				{index: 1, side: 'A', flags: ['beats_own_history']},
				{index: 2, side: 'A', flags: ['beats_own_history']},
				{index: 3, side: 'A', flags: ['beats_own_history']},
			],
		});
	});

	it('needs at least 20 solves of history', () => {
		expect(historyCheck(Array(19).fill(30_000), [{round: 1, timeMs: 5000}])).toEqual({rounds: [], match: false});
		expect(historyCheck(Array(20).fill(10_000), [{round: 1, timeMs: 9_500}])).toEqual({rounds: [], match: false});
		expect(historyCheck(Array(20).fill(10_000), [{round: 1, timeMs: 8_000}])).toEqual({rounds: [1], match: true});
	});
});

// ── Queue join conditions (design 4.3) ───────────────────────────────────────

describe('joinQueue', () => {
	function joinSetup(over: Partial<JoinQueueDeps> = {}, eligibility: any = {}) {
		const clock = new FakeClock();
		const store = new MemoryStore(clock);
		const status: {value: 'live' | 'finished' | null} = {value: null};
		const deps: JoinQueueDeps = {
			store,
			now: () => clock.now(),
			getSiteConfig: async () => ({online_battle_enabled: false, feature_overrides: {}}),
			isOnlineBattleOpen,
			loadEligibility: async () => ({
				admin: false,
				email_verified: true,
				banned_forever: false,
				banned_until: null,
				...eligibility,
			}),
			getStoredRating: async () => ({rating: 1620, rd: 80}),
			matches: {matchStatusFor: () => status.value, leaveFinished: jest.fn(async () => undefined)},
			...over,
		};
		const join = (payload: any = {puzzle: '333', cube: {brand: 'gan', hasClock: true}}) =>
			joinQueue(deps, {userId: A.userId, socketId: A.socketId, ip: A.ip, payload});
		return {clock, store, deps, join, status};
	}

	it('refuses a user who is not on the list while the flag is off', async () => {
		const {join, store} = joinSetup();
		expect(await join()).toEqual({ok: false, error: {i18nKey: BATTLE_ERROR_KEYS.disabled}});
		expect(await getQueueEntry(store, A.userId)).toBeNull();
	});

	it('lets admins and listed users in while the flag is off, and everyone once it is on', async () => {
		expect((await joinSetup({}, {admin: true}).join()).ok).toBe(true);
		const listed = joinSetup({
			getSiteConfig: async () => ({
				online_battle_enabled: false,
				feature_overrides: {online_battle_enabled: {users: [{id: A.userId}]}},
			}),
		});
		expect((await listed.join()).ok).toBe(true);
		const open = joinSetup({getSiteConfig: async () => ({online_battle_enabled: true})});
		const res = await open.join();
		expect(res.ok).toBe(true);
		const entry = await getQueueEntry(open.store, A.userId);
		expect(entry).toMatchObject({rating: 1620, rd: 80, socketId: A.socketId, ip: A.ip});
		expect(await getBattleSession(open.store, A.userId)).toMatchObject({kind: 'queue', socketId: A.socketId});
	});

	const on = {getSiteConfig: async () => ({online_battle_enabled: true})};

	it('requires a verified email and no ban', async () => {
		expect(await joinSetup(on, {email_verified: false}).join()).toEqual({
			ok: false,
			error: {i18nKey: BATTLE_ERROR_KEYS.emailNotVerified},
		});
		const banned = joinSetup(on, {banned_until: new Date(Date.UTC(2030, 0, 1))});
		expect(await banned.join()).toEqual({ok: false, error: {i18nKey: BATTLE_ERROR_KEYS.banned}});
		expect((await joinSetup(on, {banned_until: new Date(Date.UTC(2020, 0, 1))}).join()).ok).toBe(true);
	});

	it('requires 3x3 and a cube with its own clock', async () => {
		const s = joinSetup(on);
		expect(await s.join({puzzle: '444', cube: {brand: 'gan', hasClock: true}})).toEqual({
			ok: false,
			error: {i18nKey: BATTLE_ERROR_KEYS.puzzleNotSupported},
		});
		expect(await s.join({puzzle: '333', cube: {brand: 'giiker', hasClock: false}})).toEqual({
			ok: false,
			error: {i18nKey: BATTLE_ERROR_KEYS.cubeNotSupported},
		});
	});

	it('refuses a friendly room member, a running match and a cooldown', async () => {
		const room = joinSetup(on);
		await room.store.set(battleKey(RedisNamespace.FRIENDLY_ROOM_SESSION, A.userId), '{"roomId":"r","socketId":"x"}');
		expect(await room.join()).toEqual({ok: false, error: {i18nKey: BATTLE_ERROR_KEYS.inFriendlyRoom}});

		const busy = joinSetup(on);
		busy.status.value = 'live';
		expect(await busy.join()).toEqual({ok: false, error: {i18nKey: BATTLE_ERROR_KEYS.alreadyInMatch}});

		const finished = joinSetup(on);
		finished.status.value = 'finished';
		expect((await finished.join()).ok).toBe(true);
		expect(finished.deps.matches.leaveFinished).toHaveBeenCalledWith(A.userId);

		const cooling = joinSetup(on);
		await cooling.store.set(battleKey(RedisNamespace.BATTLE_COOLDOWN, A.userId), '300', 300);
		expect(await cooling.join()).toEqual({ok: false, error: {i18nKey: BATTLE_ERROR_KEYS.queueCooldown, params: {seconds: 300}}});
	});

	it('keeps the waiting time when the same user rejoins from a new socket', async () => {
		const s = joinSetup(on);
		await s.join();
		const first = await getQueueEntry(s.store, A.userId);
		await s.clock.advance(12_000);
		await joinQueue(s.deps, {userId: A.userId, socketId: 'sock-a2', ip: null, payload: {puzzle: '333', cube: {brand: 'gan', hasClock: true}}});
		const second = await getQueueEntry(s.store, A.userId);
		expect(second?.joinedAt).toBe(first?.joinedAt);
		expect(second?.socketId).toBe('sock-a2');
	});

	it('refuses while the user waits on an open duel invite', async () => {
		const s = joinSetup({...on, challenges: {hostedCode: (userId) => (userId === A.userId ? 'k7m2xq9pza' : null)}});
		expect(await s.join()).toEqual({ok: false, error: {i18nKey: BATTLE_ERROR_KEYS.challengeOpen}});
		expect(await getQueueEntry(s.store, A.userId)).toBeNull();
	});

	it('drops a stale match session that has no match behind it', async () => {
		const s = joinSetup(on);
		await setBattleSession(s.store, A.userId, {kind: 'match', socketId: 'old', matchId: 'gone', since: 0});
		expect((await s.join()).ok).toBe(true);
		expect((await getBattleSession(s.store, A.userId))?.kind).toBe('queue');
	});
});

describe('Redis write failures', () => {
	/** Makes store.set throw for keys of one namespace, everything else works. */
	function failSetFor(ctx: Ctx, namespace: RedisNamespace) {
		const original = ctx.store.set.bind(ctx.store);
		jest.spyOn(ctx.store, 'set').mockImplementation(async (key: string, value: string, ttl?: number) => {
			if (key.startsWith(`${namespace}#`)) throw new Error('redis down');
			return original(key, value, ttl);
		});
	}

	it('does not leave a half created match holding both players', async () => {
		const ctx = setup();
		failSetFor(ctx, RedisNamespace.BATTLE_SESSION);
		await expect(ctx.manager.createMatch(A, B)).rejects.toThrow('redis down');
		expect(ctx.manager.matchStatusFor(A.userId)).toBeNull();
		expect(ctx.manager.matchStatusFor(B.userId)).toBeNull();
		expect(ctx.clock.pendingTimers()).toBe(0);
	});

	it('still sends the match result when the recent opponent write fails', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		await toFirstScramble(ctx);
		await playRound(ctx, match.id, 1, FAST, SLOW);
		await toNextScramble(ctx);
		await playRound(ctx, match.id, 2, FAST, SLOW);
		await toNextScramble(ctx);
		await playRound(ctx, match.id, 3, FAST, SLOW);
		failSetFor(ctx, RedisNamespace.BATTLE_RECENT_OPPONENT);
		await ctx.clock.advance(ROUND_RESULT_SEC * 1000);
		expect(ctx.last(A.socketId, BattleServerEvent.MATCH_RESULT)).toMatchObject({winner: 'A', rated: true});
		expect(ctx.last(B.socketId, BattleServerEvent.REMATCH_STATE)).toBeDefined();
	});

	it('still cancels when the abandon cooldown write fails', async () => {
		const ctx = setup();
		const match = await ctx.manager.createMatch(A, B);
		failSetFor(ctx, RedisNamespace.BATTLE_COOLDOWN);
		await ctx.manager.handleGiveUp(A.userId, A.socketId, {matchId: match.id});
		expect(ctx.last(B.socketId, BattleServerEvent.CANCELLED)).toMatchObject({reason: 'left_before_start'});
		expect(ctx.manager.getMatch(match.id)).toBeUndefined();
	});
});

it('flushAsync settles pending work', async () => {
	let done = false;
	void Promise.resolve().then(() => (done = true));
	await flushAsync(1);
	expect(done).toBe(true);
});
