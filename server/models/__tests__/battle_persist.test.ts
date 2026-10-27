// Online Battle persistence (design ranking-battle.md 4.4, 4.10, 4.12): the transaction,
// a drawn match, an unrated match, and the pure helpers around them.

const deleteKeyInRedis = jest.fn(async () => 1);
jest.mock('../../services/redis', () => ({
	RedisNamespace: {BATTLE_LEADERBOARD: 'cd:battle:leaderboard'},
	createRedisKey: (ns: string, hash: string) => ({key: `${ns}#${hash}`}),
	deleteKeyInRedis: (...a: any[]) => deleteKeyInRedis(...(a as [])),
	fetchDataFromCache: jest.fn(),
}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));

const tx = {
	battleRating: {findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), delete: jest.fn()},
	battleMatch: {create: jest.fn(), findUnique: jest.fn(), count: jest.fn(), aggregate: jest.fn(), update: jest.fn()},
};
jest.mock('../../database', () => ({
	getPrisma: () => ({
		$transaction: async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
	}),
}));

import {
	battleMatchAccess,
	escapeLike,
	isOnlineBattleOpen,
	persistMatch,
	PersistMatchInput,
	planMatchPersistence,
	planVoidSide,
	StoredBattleRating,
	toLeaderboardRow,
	toMatchSummary,
	voidBattleMatch,
} from '../battle';
import {initialRating, previewDeltas, rateMatch} from '../../../shared/battle/glicko2';
import {GlickoRating} from '../../../shared/battle/types';

const STARTED = new Date('2026-10-06T12:00:00Z');
const ENDED = new Date('2026-10-06T12:03:00Z');

function round(index: number, winner: 'A' | 'B' | 'DRAW') {
	return {
		index,
		scramble: "R U R' U'",
		winner,
		a: {timeMs: 11920, penalty: null, moves: [{t: 'R', c: 100, l: 5000}], flags: ['missing_cube_ts' as const]},
		b: {timeMs: 13400, penalty: null, moves: null, flags: []},
	};
}

function input(over: Partial<PersistMatchInput> = {}): PersistMatchInput {
	return {
		id: 'match-1',
		status: 'FINISHED',
		endReason: 'NORMAL',
		rated: true,
		a: {userId: 'user-a', prepared: initialRating()},
		b: {userId: 'user-b', prepared: initialRating()},
		winner: 'A',
		rounds: [round(1, 'A'), round(0, 'B'), round(2, 'A')],
		flags: ['same_ip', 'same_ip'],
		startedAt: STARTED,
		endedAt: ENDED,
		...over,
	};
}

function stored(r: GlickoRating, games: number, extra: Partial<StoredBattleRating> = {}): StoredBattleRating {
	return {
		...r,
		games,
		wins: Math.ceil(games / 2),
		losses: Math.floor(games / 2),
		draws: 0,
		peak_rating: r.rating,
		last_match_at: STARTED,
		...extra,
	};
}

describe('planMatchPersistence', () => {
	it('rated win: both rows created on a first match, numbers equal the preview', () => {
		const plan = planMatchPersistence(input(), null, null);
		const expected = rateMatch(initialRating(), initialRating(), 'A');
		const preview = previewDeltas(initialRating(), initialRating());

		expect(plan.rated).toBe(true);
		expect(plan.match.rounds_a).toBe(2);
		expect(plan.match.rounds_b).toBe(1);
		expect(plan.match.rating_a_after).toBeCloseTo(expected.a.rating, 9);
		expect(plan.match.rating_b_after).toBeCloseTo(expected.b.rating, 9);
		expect(plan.match.rd_a_before).toBe(350);
		expect(plan.match.vol_b_before).toBe(0.06);
		expect(plan.ratingWrites).toHaveLength(2);
		expect(plan.ratingWrites[0].create).toMatchObject({user_id: 'user-a', games: 1, wins: 1, losses: 0, draws: 0});
		expect(plan.ratingWrites[1].create).toMatchObject({user_id: 'user-b', games: 1, wins: 0, losses: 1, draws: 0});
		// The "+X / -Y" shown before the match is what the match writes.
		expect(plan.result.a.delta).toBe(preview.win);
		expect(plan.result.b.delta).toBe(preview.loss);
		expect(plan.result.a).toMatchObject({ratingBefore: 1500, games: 1, provisional: true});
		// Flags deduplicated.
		expect(plan.result.flags).toEqual(['same_ip']);
	});

	it('rounds are written in order, an absent move log stays NULL', () => {
		const plan = planMatchPersistence(input(), null, null);
		const rounds = (plan.match.rounds as any).create;
		expect(rounds.map((r: any) => r.index)).toEqual([0, 1, 2]);
		expect(rounds[0].a_moves).toEqual([{t: 'R', c: 100, l: 5000}]);
		expect('b_moves' in rounds[0]).toBe(false);
		expect(rounds[0].a_flags).toEqual(['missing_cube_ts']);
		expect(rounds[0].a_time_ms).toBe(11920);
	});

	it('drawn match: 0.5 for both, draws counted, draw preview matches', () => {
		const a = {rating: 1600, rd: 60, volatility: 0.06};
		const b = {rating: 1400, rd: 60, volatility: 0.06};
		const plan = planMatchPersistence(
			input({
				winner: 'DRAW',
				a: {userId: 'user-a', prepared: a},
				b: {userId: 'user-b', prepared: b},
				rounds: [round(0, 'A'), round(1, 'B'), round(2, 'DRAW'), round(3, 'DRAW'), round(4, 'DRAW')],
			}),
			stored(a, 30),
			stored(b, 30)
		);
		expect(plan.rated).toBe(true);
		expect(plan.match.winner).toBe('DRAW');
		expect(plan.ratingWrites[0].update).toMatchObject({draws: {increment: 1}, wins: {increment: 0}, losses: {increment: 0}});
		expect(plan.result.a.delta).toBe(previewDeltas(a, b).draw);
		expect(plan.result.b.delta).toBe(previewDeltas(b, a).draw);
		// The favourite loses rating on a draw, the underdog gains.
		expect(plan.result.a.delta).toBeLessThan(0);
		expect(plan.result.b.delta).toBeGreaterThan(0);
		expect(plan.result.a.games).toBe(31);
	});

	it('unrated match (pair limit reached): no rating writes, no rating columns', () => {
		const plan = planMatchPersistence(input({rated: false}), stored(initialRating(), 3), null);
		expect(plan.rated).toBe(false);
		expect(plan.match.rated).toBe(false);
		expect(plan.ratingWrites).toHaveLength(0);
		expect(plan.match.rating_a_before).toBeUndefined();
		expect(plan.match.rating_a_after).toBeUndefined();
		expect(plan.result.a).toMatchObject({delta: 0, ratingBefore: 1500, ratingAfter: 1500, games: 3});
		expect(plan.result.b.games).toBe(0);
		// The rounds are still kept for review.
		expect((plan.match.rounds as any).create).toHaveLength(3);
	});

	it('a duel is never rated, whatever the caller says, and is marked as one', () => {
		const plan = planMatchPersistence(input({rated: true, isChallenge: true}), stored(initialRating(), 3), null);
		expect(plan.rated).toBe(false);
		expect(plan.match).toMatchObject({rated: false, is_challenge: true});
		expect(plan.ratingWrites).toHaveLength(0);
		expect(plan.match.rating_a_before).toBeUndefined();
		expect(plan.result.a).toMatchObject({delta: 0, ratingBefore: 1500, ratingAfter: 1500});
		expect(planMatchPersistence(input(), null, null).match.is_challenge).toBe(false);
	});

	it('a void match is never rated, even when it was going to be', () => {
		const plan = planMatchPersistence(input({status: 'VOID', endReason: 'SERVER_RESTART', winner: null}), null, null);
		expect(plan.rated).toBe(false);
		expect(plan.match.status).toBe('VOID');
		expect(plan.match.winner).toBeNull();
		expect(plan.ratingWrites).toHaveLength(0);
	});

	it('existing rows: counters increment, peak keeps the higher value', () => {
		const a = {rating: 1700, rd: 80, volatility: 0.06};
		const b = {rating: 1650, rd: 80, volatility: 0.06};
		const plan = planMatchPersistence(
			input({winner: 'B', a: {userId: 'user-a', prepared: a}, b: {userId: 'user-b', prepared: b}}),
			stored(a, 20, {peak_rating: 1800}),
			stored(b, 20, {peak_rating: 1600})
		);
		expect(plan.ratingWrites[0].update).toMatchObject({games: {increment: 1}, losses: {increment: 1}, peak_rating: 1800});
		const bAfter = plan.match.rating_b_after as number;
		expect(bAfter).toBeGreaterThan(1650);
		expect(plan.ratingWrites[1].update).toMatchObject({wins: {increment: 1}, peak_rating: bAfter});
		expect(plan.ratingWrites[1].update.last_match_at).toEqual(ENDED);
	});

	it('flags provisional_jump when a new account gains over 300 (design 4.4 example)', () => {
		const strong = {rating: 2000, rd: 60, volatility: 0.06};
		const plan = planMatchPersistence(
			input({winner: 'A', a: {userId: 'new', prepared: initialRating()}, b: {userId: 'strong', prepared: strong}}),
			null,
			stored(strong, 200)
		);
		expect(plan.result.a.ratingAfter).toBe(2042);
		expect(plan.result.flags).toEqual(expect.arrayContaining(['same_ip', 'provisional_jump']));
	});
});

describe('persistMatch', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		tx.battleRating.findUnique.mockResolvedValue(null);
		tx.battleMatch.create.mockResolvedValue({id: 'match-1'});
		tx.battleRating.upsert.mockResolvedValue({});
	});

	it('writes the match and both ratings in one transaction, then drops the leaderboard cache', async () => {
		const res = await persistMatch(input());
		expect(res.matchId).toBe('match-1');
		expect(res.rated).toBe(true);
		expect(tx.battleMatch.create).toHaveBeenCalledTimes(1);
		expect(tx.battleMatch.create.mock.calls[0][0].data).toMatchObject({id: 'match-1', rated: true, status: 'FINISHED'});
		expect(tx.battleRating.upsert).toHaveBeenCalledTimes(2);
		expect(tx.battleRating.upsert.mock.calls[0][0].where).toEqual({user_id_puzzle: {user_id: 'user-a', puzzle: '333'}});
		expect(deleteKeyInRedis).toHaveBeenCalled();
	});

	it('an unrated match touches no rating row and keeps the cache', async () => {
		const res = await persistMatch(input({rated: false}));
		expect(res.rated).toBe(false);
		expect(tx.battleMatch.create).toHaveBeenCalledTimes(1);
		expect(tx.battleRating.upsert).not.toHaveBeenCalled();
		expect(deleteKeyInRedis).not.toHaveBeenCalled();
	});

	it('refuses a match against oneself', async () => {
		await expect(
			persistMatch(input({b: {userId: 'user-a', prepared: initialRating()}}))
		).rejects.toThrow();
		expect(tx.battleMatch.create).not.toHaveBeenCalled();
	});
});

describe('planVoidSide', () => {
	const match = {
		id: 'm',
		puzzle: '333',
		status: 'FINISHED',
		rated: true,
		winner: 'A',
		player_a_id: 'user-a',
		player_b_id: 'user-b',
		rating_a_before: 1500,
		rd_a_before: 120,
		vol_a_before: 0.059,
		rating_b_before: 1480,
		rd_b_before: 90,
		vol_b_before: 0.061,
		started_at: STARTED,
	};

	it('latest match: rating goes back to the entering state, counters drop', () => {
		const plan = planVoidSide(match, 'A', stored({rating: 1530, rd: 110, volatility: 0.06}, 5, {wins: 3, losses: 2}), false);
		expect(plan).toMatchObject({
			userId: 'user-a',
			revert: true,
			counters: {games: 4, wins: 2, losses: 2, draws: 0},
			ratingData: {rating: 1500, rd: 120, volatility: 0.059, last_match_at: STARTED},
		});
	});

	it('a later rated match exists: counters drop, rating stays', () => {
		const plan = planVoidSide(match, 'B', stored({rating: 1460, rd: 85, volatility: 0.06}, 5, {wins: 2, losses: 3}), true);
		expect(plan).toMatchObject({revert: false, ratingData: null, counters: {games: 4, wins: 2, losses: 2}});
	});

	it('the only rated match: games end at 0 so the row can go', () => {
		const plan = planVoidSide(match, 'A', stored({rating: 1662, rd: 290, volatility: 0.06}, 1, {wins: 1, losses: 0}), false);
		expect(plan?.gamesAfter).toBe(0);
		expect(plan?.revert).toBe(true);
	});

	it('nothing to undo on an unrated match or a deleted player', () => {
		expect(planVoidSide({...match, rated: false}, 'A', stored(initialRating(), 3), false)).toBeNull();
		expect(planVoidSide({...match, player_b_id: null}, 'B', stored(initialRating(), 3), false)).toBeNull();
	});
});

describe('voidBattleMatch', () => {
	// E-101: a player who started at 1500 and only went down from there. Voiding their
	// latest match puts them back to 1338, and the starting 1500 is still their peak.
	const match = {
		id: 'm',
		puzzle: '333',
		status: 'FINISHED',
		rated: true,
		winner: 'A',
		flags: [],
		player_a_id: 'user-a',
		player_b_id: 'user-b',
		rating_a_before: 1338,
		rd_a_before: 120,
		vol_a_before: 0.059,
		rating_b_before: 1338,
		rd_b_before: 120,
		vol_b_before: 0.059,
		started_at: STARTED,
		ended_at: ENDED,
	};

	beforeEach(() => {
		jest.clearAllMocks();
		tx.battleMatch.findUnique.mockResolvedValue(match);
		tx.battleMatch.count.mockResolvedValue(0);
		tx.battleMatch.update.mockResolvedValue({});
		tx.battleRating.update.mockResolvedValue({});
		tx.battleRating.findUnique.mockResolvedValue(
			stored({rating: 1380, rd: 110, volatility: 0.06}, 4, {wins: 1, losses: 3, peak_rating: 1500})
		);
		// Their other rated matches never ended above 1338
		tx.battleMatch.aggregate.mockImplementation(async (args: any) =>
			args._max.rating_a_after ? {_max: {rating_a_after: 1338}} : {_max: {rating_b_after: 1300}}
		);
	});

	it('keeps the starting rating as the peak when no remaining match went above it', async () => {
		const res = await voidBattleMatch('m', 'admin-1');
		expect(res).toMatchObject({changed: true, reverted_a: true, reverted_b: true});
		expect(tx.battleRating.update).toHaveBeenCalledTimes(2);
		for (const call of tx.battleRating.update.mock.calls) {
			expect(call[0].data).toMatchObject({rating: 1338, peak_rating: 1500});
		}
	});

	it('a remaining match above the start still sets the peak', async () => {
		tx.battleMatch.aggregate.mockImplementation(async (args: any) =>
			args._max.rating_a_after ? {_max: {rating_a_after: 1612}} : {_max: {rating_b_after: null}}
		);
		await voidBattleMatch('m', 'admin-1');
		expect(tx.battleRating.update.mock.calls[0][0].data.peak_rating).toBe(1612);
	});
});

describe('isOnlineBattleOpen', () => {
	const closed = {online_battle_enabled: false, feature_overrides: {online_battle_enabled: {mode: 'INCLUDE', users: [{id: 'tester'}]}}};

	it.each([
		['admin, flag off', closed, {id: 'x', admin: true}, true],
		['listed tester, flag off', closed, {id: 'tester'}, true],
		['other user, flag off', closed, {id: 'other'}, false],
		['anonymous, flag off', closed, null, false],
		['anyone, flag on', {online_battle_enabled: true}, {id: 'other'}, true],
		['flag missing (config cached before the column)', {}, {id: 'other'}, false],
		['no config', null, {id: 'other'}, false],
	])('%s', (_label, config, user, expected) => {
		expect(isOnlineBattleOpen(config as any, user as any)).toBe(expected);
	});
});

describe('row mappers', () => {
	it('leaderboard row: bigint rank, rounded rating, RD only as provisional', () => {
		const row = toLeaderboardRow({
			rank: BigInt(27),
			user_id: 'u',
			username: 'mert_s',
			pfp_image_url: null,
			rating: 1531.6,
			rd: 140,
			games: 12,
			wins: 7,
			losses: 5,
			draws: 0,
		});
		expect(row).toEqual({
			rank: 27,
			user_id: 'u',
			username: 'mert_s',
			pfp_image_url: null,
			rating: 1532,
			provisional: true,
			games: 12,
			wins: 7,
			losses: 5,
			draws: 0,
		});
		expect('rd' in row).toBe(false);
	});

	it('match summary is seen from the history owner side', () => {
		const summary = toMatchSummary(
			{
				id: 'm',
				puzzle: '333',
				status: 'FINISHED',
				end_reason: 'NORMAL',
				rated: true,
				is_rematch: false,
				is_challenge: false,
				player_a_id: 'a',
				player_b_id: 'b',
				winner: 'A',
				rounds_a: 2,
				rounds_b: 1,
				rating_a_before: 1500,
				rating_a_after: 1510.4,
				rating_b_before: 1532.2,
				rating_b_after: 1521.7,
				started_at: STARTED,
				ended_at: ENDED,
				player_a: {id: 'a', username: 'ayse_k', profile: {pfp_image: {storage_path: 'p/a.png'}}},
				player_b: null,
			},
			'b'
		);
		expect(summary).toMatchObject({
			result: 'LOSS',
			score_for: 1,
			score_against: 2,
			rating_before: 1532,
			rating_after: 1522,
			delta: -10,
			opponent: {id: 'a', username: 'ayse_k', pfp_image_url: 'p/a.png'},
		});
	});

	it('match access: players and staff; moves for admins only', () => {
		const m = {player_a_id: 'a', player_b_id: 'b'};
		expect(battleMatchAccess(m, {id: 'a'})).toEqual({canView: true, staff: false, moves: false, side: 'A'});
		expect(battleMatchAccess(m, {id: 'c'}).canView).toBe(false);
		expect(battleMatchAccess(m, null).canView).toBe(false);
		expect(battleMatchAccess(m, {id: 'm', mod: true})).toMatchObject({canView: true, staff: true, moves: false});
		expect(battleMatchAccess(m, {id: 'x', admin: true})).toMatchObject({canView: true, moves: true});
	});

	it('escapes LIKE wildcards in a search', () => {
		expect(escapeLike('a_b%c\\')).toBe('a\\_b\\%c\\\\');
	});
});
