/**
 * Online Battle data layer (design ranking-battle.md 4.4, 4.10, 4.12; task B2).
 *
 * What lives here:
 * - persistMatch: one transaction writes battle_match + battle_round rows and both
 *   battle_rating updates. The rating math is shared/battle/glicko2.ts, fed with the
 *   prepared states the match was paired with, so the "+12 / -9" preview and the
 *   written delta are the same number.
 * - Leaderboard and "my rating" queries, ordered by the conservative rating
 *   (rating - 2 * RD, design 4.4 / Q3), banned users left out, pages cached 60 s.
 * - Match history, match detail, the admin flagged list and the admin void.
 * - Head-to-head of two players (duel result screen and profile).
 * - Small reads the realtime layer (server/battle, B3) needs: a player's stored rating,
 *   the pair's rated match count for the daily limit, the site flag check, reports.
 *
 * The planning steps are pure functions (planMatchPersistence, planVoid, the row
 * mappers) so they are unit tested without a database.
 */

import {Prisma} from '@prisma/client';
import {getPrisma} from '../database';
import {logger} from '../services/logger';
import {createRedisKey, deleteKeyInRedis, fetchDataFromCache, RedisNamespace} from '../services/redis';
import {
	BATTLE_PUZZLE,
	BATTLE_PUZZLES,
	HEAD_TO_HEAD_SCOPE,
	INITIAL_RATING,
	LEADERBOARD_PAGE_SIZE,
	LEADERBOARD_RD_FACTOR,
} from '../../shared/battle/config';
import {
	BattleEndReason,
	BattleFlag,
	BattleHeadToHead,
	BattleMatchStatus,
	BattleMove,
	BattlePenalty,
	BattleSide,
	BattleWinner,
	GlickoRating,
} from '../../shared/battle/types';
import {
	displayDelta,
	displayRating,
	isProvisional,
	isProvisionalJump,
	rateMatch,
	scoreFor,
} from '../../shared/battle/glicko2';
import {headToHeadFrom} from '../../shared/battle/challenge';

// ── Site flag ────────────────────────────────────────────────────────────────

export const ONLINE_BATTLE_FEATURE = 'online_battle_enabled';

interface FlagConfig {
	online_battle_enabled?: boolean | null;
	feature_overrides?: Record<string, {mode?: string; users?: Array<{id?: string} | null>} | null> | null;
}

interface FlagUser {
	id?: string | null;
	admin?: boolean | null;
}

/**
 * Whether a user may use Online Battle right now. Mirrors FeatureGuard on the client
 * one to one: admins always, everyone when the flag is on, otherwise only the users on
 * the flag's access list. The client guard alone is not enough: a socket event can be
 * sent from the browser console with the page hidden.
 */
export function isOnlineBattleOpen(config: FlagConfig | null | undefined, user: FlagUser | null | undefined): boolean {
	if (user?.admin) return true;
	if (!config) return false;
	if (config.online_battle_enabled) return true;
	if (!user?.id) return false;
	const override = config.feature_overrides?.[ONLINE_BATTLE_FEATURE];
	return !!override?.users?.some((u) => u?.id === user.id);
}

export function isBattlePuzzle(puzzle: string): boolean {
	return (BATTLE_PUZZLES as readonly string[]).includes(puzzle);
}

// ── Stored rating ────────────────────────────────────────────────────────────

export interface StoredBattleRating {
	rating: number;
	rd: number;
	volatility: number;
	games: number;
	wins: number;
	losses: number;
	draws: number;
	peak_rating: number;
	last_match_at: Date | null;
}

const storedRatingSelect = {
	rating: true,
	rd: true,
	volatility: true,
	games: true,
	wins: true,
	losses: true,
	draws: true,
	peak_rating: true,
	last_match_at: true,
} as const;

/**
 * The stored Glicko state of a player, or null before their first rated match. B3 feeds
 * this to prepareForMatch at pairing time.
 */
export async function getStoredBattleRating(
	userId: string,
	puzzle: string = BATTLE_PUZZLE
): Promise<StoredBattleRating | null> {
	return getPrisma().battleRating.findUnique({
		where: {user_id_puzzle: {user_id: userId, puzzle}},
		select: storedRatingSelect,
	});
}

/**
 * Rated, finished matches between two players since `since` (queue and rematch together),
 * for the daily pair limit (rules.isPairRated, design 4.5).
 */
export async function countPairRatedMatches(userIdA: string, userIdB: string, since: Date): Promise<number> {
	return getPrisma().battleMatch.count({
		where: {
			rated: true,
			status: 'FINISHED',
			ended_at: {gte: since},
			OR: [
				{player_a_id: userIdA, player_b_id: userIdB},
				{player_a_id: userIdB, player_b_id: userIdA},
			],
		},
	});
}

/**
 * Matches between two players from `userId`'s side: finished, not voided, and under
 * HEAD_TO_HEAD_SCOPE either every match or duels only ("7-4 against Ahmet").
 */
export async function getBattleHeadToHead(
	userId: string,
	opponentId: string,
	puzzle: string = BATTLE_PUZZLE
): Promise<BattleHeadToHead> {
	const rows = await getPrisma().battleMatch.groupBy({
		by: ['player_a_id', 'winner'],
		where: {
			puzzle,
			status: 'FINISHED',
			...(HEAD_TO_HEAD_SCOPE === 'challenge' ? {is_challenge: true} : {}),
			OR: [
				{player_a_id: userId, player_b_id: opponentId},
				{player_a_id: opponentId, player_b_id: userId},
			],
		},
		_count: {_all: true},
	});
	return headToHeadFrom(
		rows.map((r) => ({player_a_id: r.player_a_id, winner: r.winner, count: r._count._all})),
		userId
	);
}

// ── Persisting a match ───────────────────────────────────────────────────────

export interface PersistPlayerInput {
	userId: string;
	/**
	 * The state the player entered the match with: prepareForMatch(stored, last_match_at,
	 * startedAt). The same object the preview was computed from.
	 */
	prepared: GlickoRating;
}

export interface PersistRoundSideInput {
	timeMs: number | null;
	penalty: BattlePenalty | null;
	moves?: BattleMove[] | null;
	flags?: BattleFlag[] | null;
}

export interface PersistRoundInput {
	index: number;
	scramble: string;
	winner: BattleWinner;
	a: PersistRoundSideInput;
	b: PersistRoundSideInput;
}

export interface PersistMatchInput {
	/** Match id the realtime layer used; kept as the row id so logs and reports line up. */
	id?: string;
	puzzle?: string;
	status: BattleMatchStatus;
	endReason: BattleEndReason;
	/** Whether the match counts (pair limit not reached). A VOID match is never rated. */
	rated: boolean;
	isRematch?: boolean;
	/** A duel: written unrated whatever `rated` says. */
	isChallenge?: boolean;
	a: PersistPlayerInput;
	b: PersistPlayerInput;
	/** Null only for a VOID match without a result. */
	winner: BattleWinner | null;
	rounds: PersistRoundInput[];
	/** Match level flags known at the end (same_ip ...). provisional_jump is added here. */
	flags?: BattleFlag[] | null;
	/** Pairing time, the moment prepareForMatch inflated RD to. */
	startedAt: Date;
	endedAt?: Date;
}

export interface PersistSideResult {
	/** Rounded, as shown. */
	ratingBefore: number;
	ratingAfter: number;
	delta: number;
	provisional: boolean;
	/** Rated games after this match. */
	games: number;
}

export interface PersistMatchResult {
	matchId: string;
	rated: boolean;
	winner: BattleWinner | null;
	flags: string[];
	a: PersistSideResult;
	b: PersistSideResult;
}

interface RatingWrite {
	userId: string;
	create: Prisma.BattleRatingUncheckedCreateInput;
	update: Prisma.BattleRatingUncheckedUpdateInput;
}

export interface MatchPersistencePlan {
	rated: boolean;
	match: Prisma.BattleMatchUncheckedCreateInput;
	ratingWrites: RatingWrite[];
	result: Omit<PersistMatchResult, 'matchId'>;
}

function uniqueFlags(flags: Array<string | null | undefined>): string[] {
	return Array.from(new Set(flags.filter((f): f is string => !!f)));
}

function sideRoundData(side: PersistRoundSideInput, prefix: 'a' | 'b') {
	const data: Record<string, unknown> = {
		[`${prefix}_time_ms`]: side.timeMs == null ? null : Math.round(side.timeMs),
		[`${prefix}_penalty`]: side.penalty ?? null,
		[`${prefix}_flags`]: uniqueFlags(side.flags || []),
	};
	// A nullable Json column takes Prisma.DbNull, not null; leaving it out stores NULL.
	if (side.moves) data[`${prefix}_moves`] = side.moves as unknown as Prisma.InputJsonValue;
	return data;
}

/**
 * Everything persistMatch writes, computed from the input and both stored rating rows
 * (null before a player's first rated match). Pure.
 */
export function planMatchPersistence(
	input: PersistMatchInput,
	storedA: StoredBattleRating | null,
	storedB: StoredBattleRating | null
): MatchPersistencePlan {
	const puzzle = input.puzzle || BATTLE_PUZZLE;
	const endedAt = input.endedAt || new Date();
	const rated = !!input.rated && !input.isChallenge && input.status === 'FINISHED' && !!input.winner;

	let roundsA = 0;
	let roundsB = 0;
	for (const r of input.rounds) {
		if (r.winner === 'A') roundsA++;
		else if (r.winner === 'B') roundsB++;
	}

	const flags = uniqueFlags(input.flags || []);
	const ratingWrites: RatingWrite[] = [];

	const unratedSide = (prepared: GlickoRating, stored: StoredBattleRating | null): PersistSideResult => ({
		ratingBefore: displayRating(prepared.rating),
		ratingAfter: displayRating(prepared.rating),
		delta: 0,
		provisional: isProvisional(prepared.rd),
		games: stored?.games ?? 0,
	});

	let sideA = unratedSide(input.a.prepared, storedA);
	let sideB = unratedSide(input.b.prepared, storedB);

	const match: Prisma.BattleMatchUncheckedCreateInput = {
		...(input.id ? {id: input.id} : {}),
		puzzle,
		status: input.status,
		end_reason: input.endReason,
		rated,
		is_rematch: !!input.isRematch,
		is_challenge: !!input.isChallenge,
		player_a_id: input.a.userId,
		player_b_id: input.b.userId,
		winner: input.winner,
		rounds_a: roundsA,
		rounds_b: roundsB,
		started_at: input.startedAt,
		ended_at: endedAt,
		rounds: {
			create: [...input.rounds]
				.sort((x, y) => x.index - y.index)
				.map((r) => ({
					index: r.index,
					scramble: r.scramble,
					winner: r.winner,
					...sideRoundData(r.a, 'a'),
					...sideRoundData(r.b, 'b'),
				})) as Prisma.BattleRoundCreateWithoutMatchInput[],
		},
	};

	if (rated) {
		const winner = input.winner as BattleWinner;
		const next = rateMatch(input.a.prepared, input.b.prepared, winner);

		const sides: Array<{side: BattleSide; player: PersistPlayerInput; stored: StoredBattleRating | null; after: GlickoRating}> = [
			{side: 'A', player: input.a, stored: storedA, after: next.a},
			{side: 'B', player: input.b, stored: storedB, after: next.b},
		];

		for (const s of sides) {
			const score = scoreFor(winner, s.side);
			const win = score === 1 ? 1 : 0;
			const loss = score === 0 ? 1 : 0;
			const draw = score === 0.5 ? 1 : 0;
			const gamesBefore = s.stored?.games ?? 0;
			const peakBefore = s.stored?.peak_rating ?? Math.max(INITIAL_RATING, s.player.prepared.rating);

			ratingWrites.push({
				userId: s.player.userId,
				create: {
					user_id: s.player.userId,
					puzzle,
					rating: s.after.rating,
					rd: s.after.rd,
					volatility: s.after.volatility,
					games: 1,
					wins: win,
					losses: loss,
					draws: draw,
					peak_rating: Math.max(peakBefore, s.after.rating),
					last_match_at: endedAt,
				},
				update: {
					rating: s.after.rating,
					rd: s.after.rd,
					volatility: s.after.volatility,
					games: {increment: 1},
					wins: {increment: win},
					losses: {increment: loss},
					draws: {increment: draw},
					peak_rating: Math.max(peakBefore, s.after.rating),
					last_match_at: endedAt,
				},
			});

			if (isProvisionalJump(gamesBefore, s.player.prepared.rating, s.after.rating)) {
				flags.push('provisional_jump');
			}

			const result: PersistSideResult = {
				ratingBefore: displayRating(s.player.prepared.rating),
				ratingAfter: displayRating(s.after.rating),
				delta: displayDelta(s.player.prepared.rating, s.after.rating),
				provisional: isProvisional(s.after.rd),
				games: gamesBefore + 1,
			};
			if (s.side === 'A') sideA = result;
			else sideB = result;
		}

		match.rating_a_before = input.a.prepared.rating;
		match.rating_a_after = next.a.rating;
		match.rd_a_before = input.a.prepared.rd;
		match.vol_a_before = input.a.prepared.volatility;
		match.rating_b_before = input.b.prepared.rating;
		match.rating_b_after = next.b.rating;
		match.rd_b_before = input.b.prepared.rd;
		match.vol_b_before = input.b.prepared.volatility;
	}

	const finalFlags = uniqueFlags(flags);
	match.flags = finalFlags;

	return {
		rated,
		match,
		ratingWrites,
		result: {rated, winner: input.winner, flags: finalFlags, a: sideA, b: sideB},
	};
}

/**
 * Write a finished or voided match in one transaction: the match, its rounds and, when
 * rated, both rating rows (created on a player's first rated match, design 3.0-g).
 * A player is in at most one match at a time (design 4.3), so no two transactions race
 * on the same rating row.
 */
export async function persistMatch(input: PersistMatchInput): Promise<PersistMatchResult> {
	if (input.a.userId === input.b.userId) {
		throw new Error('persistMatch: a player cannot play against themselves');
	}
	const puzzle = input.puzzle || BATTLE_PUZZLE;

	const result = await getPrisma().$transaction(async (tx) => {
		const [storedA, storedB] = await Promise.all([
			tx.battleRating.findUnique({
				where: {user_id_puzzle: {user_id: input.a.userId, puzzle}},
				select: storedRatingSelect,
			}),
			tx.battleRating.findUnique({
				where: {user_id_puzzle: {user_id: input.b.userId, puzzle}},
				select: storedRatingSelect,
			}),
		]);

		const plan = planMatchPersistence(input, storedA, storedB);
		const created = await tx.battleMatch.create({data: plan.match, select: {id: true}});

		for (const w of plan.ratingWrites) {
			await tx.battleRating.upsert({
				where: {user_id_puzzle: {user_id: w.userId, puzzle}},
				create: w.create,
				update: w.update,
			});
		}

		return {...plan.result, matchId: created.id};
	});

	if (result.rated) {
		await invalidateBattleLeaderboardCache(puzzle);
	}
	return result;
}

/**
 * Add flags to a stored match after the fact (check 9 runs after the match ends and does
 * not hold up the result, design 8 B3). Duplicates are dropped.
 */
export async function appendBattleFlags(
	matchId: string,
	add: {match?: BattleFlag[]; rounds?: Array<{index: number; side: BattleSide; flags: BattleFlag[]}>}
): Promise<void> {
	const prisma = getPrisma();
	await prisma.$transaction(async (tx) => {
		if (add.match?.length) {
			const m = await tx.battleMatch.findUnique({where: {id: matchId}, select: {flags: true}});
			if (m) {
				await tx.battleMatch.update({
					where: {id: matchId},
					data: {flags: uniqueFlags([...m.flags, ...add.match])},
				});
			}
		}
		for (const r of add.rounds || []) {
			if (!r.flags.length) continue;
			const round = await tx.battleRound.findUnique({
				where: {match_id_index: {match_id: matchId, index: r.index}},
				select: {id: true, a_flags: true, b_flags: true},
			});
			if (!round) continue;
			const data =
				r.side === 'A'
					? {a_flags: uniqueFlags([...round.a_flags, ...r.flags])}
					: {b_flags: uniqueFlags([...round.b_flags, ...r.flags])};
			await tx.battleRound.update({where: {id: round.id}, data});
		}
	});
}

// ── Leaderboard ──────────────────────────────────────────────────────────────

const LEADERBOARD_CACHE_SEC = 60;
/** Pages whose cache is dropped after a rated match; deeper pages expire on their own in 60 s. */
const LEADERBOARD_INVALIDATE_PAGES = 10;
const SEARCH_LIMIT = 20;

export interface BattleLeaderboardRowData {
	rank: number;
	user_id: string;
	username: string | null;
	pfp_image_url: string | null;
	rating: number;
	provisional: boolean;
	games: number;
	wins: number;
	losses: number;
	draws: number;
}

export interface BattleLeaderboardPageData {
	rows: BattleLeaderboardRowData[];
	total_count: number;
	page: number;
	page_size: number;
}

interface RawRankedRow {
	rank: bigint | number;
	user_id: string;
	username: string | null;
	pfp_image_url: string | null;
	rating: number;
	rd: number;
	games: number;
	wins: number;
	losses: number;
	draws: number;
	peak_rating?: number;
}

/** Raw SQL row to the shape the API returns: rounded rating, RD reduced to "provisional". */
export function toLeaderboardRow(raw: RawRankedRow): BattleLeaderboardRowData {
	return {
		rank: Number(raw.rank),
		user_id: raw.user_id,
		username: raw.username ?? null,
		pfp_image_url: raw.pfp_image_url ?? null,
		rating: displayRating(Number(raw.rating)),
		provisional: isProvisional(Number(raw.rd)),
		games: Number(raw.games),
		wins: Number(raw.wins),
		losses: Number(raw.losses),
		draws: Number(raw.draws),
	};
}

/**
 * Every listed player with their rank. Order: conservative rating (rating - 2 * RD) high
 * to low, then more games, then user id so the order is stable. Banned users are left
 * out (permanent, or a temporary ban still running).
 */
function rankedCte(puzzle: string): Prisma.Sql {
	return Prisma.sql`
		WITH ranked AS (
			SELECT
				br.user_id,
				br.rating,
				br.rd,
				br.games,
				br.wins,
				br.losses,
				br.draws,
				br.peak_rating,
				ua.username,
				img.storage_path AS pfp_image_url,
				ROW_NUMBER() OVER (
					ORDER BY (br.rating - ${LEADERBOARD_RD_FACTOR}::float8 * br.rd) DESC, br.games DESC, br.user_id ASC
				) AS rank
			FROM battle_rating br
			JOIN user_account ua ON ua.id = br.user_id
			LEFT JOIN profile pr ON pr.user_id = ua.id
			LEFT JOIN image img ON img.id = pr.pfp_image_id
			WHERE br.puzzle = ${puzzle}
				AND br.games > 0
				AND ua.banned_forever = false
				AND (ua.banned_until IS NULL OR ua.banned_until < NOW())
		)
	`;
}

function leaderboardCacheKey(puzzle: string, page: number) {
	return createRedisKey(RedisNamespace.BATTLE_LEADERBOARD, `${puzzle}:${page}`);
}

async function queryLeaderboardPage(puzzle: string, page: number): Promise<BattleLeaderboardPageData> {
	const prisma = getPrisma();
	const cte = rankedCte(puzzle);
	const [rows, count] = await Promise.all([
		prisma.$queryRaw<RawRankedRow[]>`${cte} SELECT * FROM ranked ORDER BY rank LIMIT ${LEADERBOARD_PAGE_SIZE}::int OFFSET ${
			page * LEADERBOARD_PAGE_SIZE
		}::int`,
		prisma.$queryRaw<Array<{count: bigint}>>`${cte} SELECT COUNT(*)::bigint AS count FROM ranked`,
	]);
	return {
		rows: rows.map(toLeaderboardRow),
		total_count: Number(count[0]?.count ?? 0),
		page,
		page_size: LEADERBOARD_PAGE_SIZE,
	};
}

/** Escape LIKE wildcards so a search for "a_b" matches the literal underscore. */
export function escapeLike(term: string): string {
	return term.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * One page of the leaderboard (50 rows), or up to 20 username matches when `search` is
 * set. Search results keep their real rank. Pages are cached 60 s; a search is not.
 */
export async function getBattleLeaderboard(
	puzzle: string,
	page: number,
	search?: string | null
): Promise<BattleLeaderboardPageData> {
	const term = (search || '').trim();
	if (term) {
		const rows = await getPrisma().$queryRaw<RawRankedRow[]>`${rankedCte(puzzle)}
			SELECT * FROM ranked WHERE username ILIKE ${`%${escapeLike(term)}%`} ORDER BY rank LIMIT ${SEARCH_LIMIT}::int`;
		return {rows: rows.map(toLeaderboardRow), total_count: rows.length, page: 0, page_size: SEARCH_LIMIT};
	}

	const safePage = Math.max(0, Math.floor(page || 0));
	try {
		return await fetchDataFromCache(
			leaderboardCacheKey(puzzle, safePage),
			() => queryLeaderboardPage(puzzle, safePage),
			LEADERBOARD_CACHE_SEC
		);
	} catch (err: any) {
		// Redis down must not take the page with it.
		logger.warn('[Battle] Leaderboard cache unavailable, querying directly', {error: err?.message});
		return queryLeaderboardPage(puzzle, safePage);
	}
}

export async function invalidateBattleLeaderboardCache(puzzle: string = BATTLE_PUZZLE): Promise<void> {
	try {
		await Promise.all(
			Array.from({length: LEADERBOARD_INVALIDATE_PAGES}, (_, page) => deleteKeyInRedis(leaderboardCacheKey(puzzle, page)))
		);
	} catch (err: any) {
		logger.warn('[Battle] Leaderboard cache invalidation failed', {error: err?.message});
	}
}

export interface MyBattleRatingData {
	puzzle: string;
	rating: number;
	provisional: boolean;
	games: number;
	wins: number;
	losses: number;
	draws: number;
	peak_rating: number;
	/** Null when the player is not listed (a running ban). */
	rank: number | null;
}

/** The viewer's own rating card, with the same rank the leaderboard shows. Null before the first rated match. */
export async function getMyBattleRating(userId: string, puzzle: string): Promise<MyBattleRatingData | null> {
	const prisma = getPrisma();
	const stored = await prisma.battleRating.findUnique({
		where: {user_id_puzzle: {user_id: userId, puzzle}},
		select: storedRatingSelect,
	});
	if (!stored || stored.games <= 0) return null;

	const ranked = await prisma.$queryRaw<RawRankedRow[]>`${rankedCte(puzzle)}
		SELECT * FROM ranked WHERE user_id = ${userId}`;

	return {
		puzzle,
		rating: displayRating(stored.rating),
		provisional: isProvisional(stored.rd),
		games: stored.games,
		wins: stored.wins,
		losses: stored.losses,
		draws: stored.draws,
		peak_rating: displayRating(stored.peak_rating),
		rank: ranked[0] ? Number(ranked[0].rank) : null,
	};
}

// ── Match history and detail ─────────────────────────────────────────────────

export const MATCH_HISTORY_PAGE_SIZE = 20;

const playerSelect = {
	select: {
		id: true,
		username: true,
		profile: {select: {pfp_image: {select: {storage_path: true}}}},
	},
} as const;

interface PlayerRow {
	id: string;
	username: string | null;
	profile?: {pfp_image?: {storage_path: string | null} | null} | null;
}

export interface BattlePlayerData {
	/** Null for a deleted account. */
	id: string | null;
	username: string | null;
	pfp_image_url: string | null;
}

export function toBattlePlayer(user: PlayerRow | null | undefined): BattlePlayerData {
	if (!user) return {id: null, username: null, pfp_image_url: null};
	return {
		id: user.id,
		username: user.username ?? null,
		pfp_image_url: user.profile?.pfp_image?.storage_path ?? null,
	};
}

interface MatchRowForSummary {
	id: string;
	puzzle: string;
	status: string;
	end_reason: string;
	rated: boolean;
	is_rematch: boolean;
	is_challenge: boolean;
	player_a_id: string | null;
	player_b_id: string | null;
	winner: string | null;
	rounds_a: number;
	rounds_b: number;
	rating_a_before: number | null;
	rating_a_after: number | null;
	rating_b_before: number | null;
	rating_b_after: number | null;
	started_at: Date;
	ended_at: Date;
	player_a?: PlayerRow | null;
	player_b?: PlayerRow | null;
}

export interface BattleMatchSummaryData {
	id: string;
	puzzle: string;
	ended_at: Date;
	/** WIN | LOSS | DRAW, from the history owner's side. */
	result: string;
	score_for: number;
	score_against: number;
	rated: boolean;
	is_rematch: boolean;
	is_challenge: boolean;
	end_reason: string;
	rating_before: number | null;
	rating_after: number | null;
	delta: number | null;
	opponent: BattlePlayerData;
}

/** A match row seen from one player's side. */
export function toMatchSummary(match: MatchRowForSummary, userId: string): BattleMatchSummaryData {
	const side: BattleSide = match.player_a_id === userId ? 'A' : 'B';
	const mine = side === 'A';
	const before = mine ? match.rating_a_before : match.rating_b_before;
	const after = mine ? match.rating_a_after : match.rating_b_after;
	let result = 'DRAW';
	if (match.winner === side) result = 'WIN';
	else if (match.winner === 'A' || match.winner === 'B') result = 'LOSS';
	return {
		id: match.id,
		puzzle: match.puzzle,
		ended_at: match.ended_at,
		result,
		score_for: mine ? match.rounds_a : match.rounds_b,
		score_against: mine ? match.rounds_b : match.rounds_a,
		rated: match.rated,
		is_rematch: match.is_rematch,
		is_challenge: !!match.is_challenge,
		end_reason: match.end_reason,
		rating_before: before == null ? null : displayRating(before),
		rating_after: after == null ? null : displayRating(after),
		delta: before == null || after == null ? null : displayDelta(before, after),
		opponent: toBattlePlayer(mine ? match.player_b : match.player_a),
	};
}

/**
 * A player's finished matches, newest first (profile and own history): the rated ones and
 * the duels (is_challenge, labelled "Duel" and without a rating change). Unrated queue
 * matches past the daily pair limit stay out, as before.
 */
export async function getBattleMatchHistory(
	userId: string,
	page: number,
	puzzle: string = BATTLE_PUZZLE
): Promise<{items: BattleMatchSummaryData[]; total: number; hasMore: boolean}> {
	const prisma = getPrisma();
	const safePage = Math.max(0, Math.floor(page || 0));
	const where: Prisma.BattleMatchWhereInput = {
		puzzle,
		status: 'FINISHED',
		AND: [{OR: [{player_a_id: userId}, {player_b_id: userId}]}, {OR: [{rated: true}, {is_challenge: true}]}],
	};
	const [rows, total] = await Promise.all([
		prisma.battleMatch.findMany({
			where,
			orderBy: {ended_at: 'desc'},
			skip: safePage * MATCH_HISTORY_PAGE_SIZE,
			take: MATCH_HISTORY_PAGE_SIZE,
			include: {player_a: playerSelect, player_b: playerSelect},
		}),
		prisma.battleMatch.count({where}),
	]);
	return {
		items: rows.map((m) => toMatchSummary(m as MatchRowForSummary, userId)),
		total,
		hasMore: (safePage + 1) * MATCH_HISTORY_PAGE_SIZE < total,
	};
}

export interface BattleViewer {
	id?: string | null;
	admin?: boolean | null;
	mod?: boolean | null;
}

export interface BattleRoundDetailData {
	index: number;
	scramble: string;
	winner: string;
	a_time_ms: number | null;
	a_penalty: string | null;
	b_time_ms: number | null;
	b_penalty: string | null;
	a_flags: string[];
	b_flags: string[];
	/** JSON of the move log, admins only. */
	a_moves: string | null;
	b_moves: string | null;
}

export interface BattleMatchDetailData {
	id: string;
	puzzle: string;
	status: string;
	end_reason: string;
	rated: boolean;
	is_rematch: boolean;
	is_challenge: boolean;
	winner: string | null;
	rounds_a: number;
	rounds_b: number;
	rating_a_before: number | null;
	rating_a_after: number | null;
	rating_b_before: number | null;
	rating_b_after: number | null;
	started_at: Date;
	ended_at: Date;
	voided_at: Date | null;
	/** Anti-cheat flags, staff only (empty for players). */
	flags: string[];
	/** A | B when the viewer played this match. */
	viewer_side: string | null;
	player_a: BattlePlayerData;
	player_b: BattlePlayerData;
	rounds: BattleRoundDetailData[];
}

function roundedOrNull(n: number | null): number | null {
	return n == null ? null : displayRating(n);
}

/**
 * Whether `viewer` may open a match: its two players and staff. Admins also see the move
 * logs; flags are for admins and moderators (they work the flagged list).
 */
export function battleMatchAccess(
	match: {player_a_id: string | null; player_b_id: string | null},
	viewer: BattleViewer | null | undefined
): {canView: boolean; staff: boolean; moves: boolean; side: BattleSide | null} {
	const side: BattleSide | null =
		viewer?.id && match.player_a_id === viewer.id ? 'A' : viewer?.id && match.player_b_id === viewer.id ? 'B' : null;
	const staff = !!(viewer?.admin || viewer?.mod);
	return {canView: !!side || staff, staff, moves: !!viewer?.admin, side};
}

/** One match with its rounds, or null when it does not exist or the viewer may not see it. */
export async function getBattleMatchDetail(id: string, viewer: BattleViewer | null): Promise<BattleMatchDetailData | null> {
	const match = await getPrisma().battleMatch.findUnique({
		where: {id},
		include: {
			player_a: playerSelect,
			player_b: playerSelect,
			rounds: {orderBy: {index: 'asc'}},
		},
	});
	if (!match) return null;
	const access = battleMatchAccess(match, viewer);
	if (!access.canView) return null;

	return {
		id: match.id,
		puzzle: match.puzzle,
		status: match.status,
		end_reason: match.end_reason,
		rated: match.rated,
		is_rematch: match.is_rematch,
		is_challenge: match.is_challenge,
		winner: match.winner,
		rounds_a: match.rounds_a,
		rounds_b: match.rounds_b,
		rating_a_before: roundedOrNull(match.rating_a_before),
		rating_a_after: roundedOrNull(match.rating_a_after),
		rating_b_before: roundedOrNull(match.rating_b_before),
		rating_b_after: roundedOrNull(match.rating_b_after),
		started_at: match.started_at,
		ended_at: match.ended_at,
		voided_at: match.voided_at,
		flags: access.staff ? match.flags : [],
		viewer_side: access.side,
		player_a: toBattlePlayer(match.player_a as PlayerRow | null),
		player_b: toBattlePlayer(match.player_b as PlayerRow | null),
		rounds: match.rounds.map((r) => ({
			index: r.index,
			scramble: r.scramble,
			winner: r.winner,
			a_time_ms: r.a_time_ms,
			a_penalty: r.a_penalty,
			b_time_ms: r.b_time_ms,
			b_penalty: r.b_penalty,
			a_flags: access.staff ? r.a_flags : [],
			b_flags: access.staff ? r.b_flags : [],
			a_moves: access.moves && r.a_moves != null ? JSON.stringify(r.a_moves) : null,
			b_moves: access.moves && r.b_moves != null ? JSON.stringify(r.b_moves) : null,
		})),
	};
}

// ── Admin: flagged matches, void ─────────────────────────────────────────────

export const ADMIN_MATCH_PAGE_SIZE = 25;

export interface AdminBattleMatchRowData {
	id: string;
	puzzle: string;
	status: string;
	end_reason: string;
	rated: boolean;
	is_challenge: boolean;
	winner: string | null;
	rounds_a: number;
	rounds_b: number;
	ended_at: Date;
	voided_at: Date | null;
	/** Match flags and every round flag, without duplicates. */
	flags: string[];
	player_a: BattlePlayerData;
	player_b: BattlePlayerData;
}

const flaggedWhere: Prisma.BattleMatchWhereInput = {
	OR: [
		{flags: {isEmpty: false}},
		{rounds: {some: {OR: [{a_flags: {isEmpty: false}}, {b_flags: {isEmpty: false}}]}}},
	],
};

/** Matches with at least one flag on the match or a round, newest first. */
export async function getFlaggedBattleMatches(
	page: number
): Promise<{items: AdminBattleMatchRowData[]; total: number; hasMore: boolean}> {
	const prisma = getPrisma();
	const safePage = Math.max(0, Math.floor(page || 0));
	const [rows, total] = await Promise.all([
		prisma.battleMatch.findMany({
			where: flaggedWhere,
			orderBy: {ended_at: 'desc'},
			skip: safePage * ADMIN_MATCH_PAGE_SIZE,
			take: ADMIN_MATCH_PAGE_SIZE,
			include: {
				player_a: playerSelect,
				player_b: playerSelect,
				rounds: {select: {a_flags: true, b_flags: true}},
			},
		}),
		prisma.battleMatch.count({where: flaggedWhere}),
	]);
	return {
		items: rows.map((m) => ({
			id: m.id,
			puzzle: m.puzzle,
			status: m.status,
			end_reason: m.end_reason,
			rated: m.rated,
			is_challenge: m.is_challenge,
			winner: m.winner,
			rounds_a: m.rounds_a,
			rounds_b: m.rounds_b,
			ended_at: m.ended_at,
			voided_at: m.voided_at,
			flags: uniqueFlags([...m.flags, ...m.rounds.flatMap((r) => [...r.a_flags, ...r.b_flags])]),
			player_a: toBattlePlayer(m.player_a as PlayerRow | null),
			player_b: toBattlePlayer(m.player_b as PlayerRow | null),
		})),
		total,
		hasMore: (safePage + 1) * ADMIN_MATCH_PAGE_SIZE < total,
	};
}

/** Admin flag left on a voided match whose rating change could not be undone for a player. */
export const VOID_RATING_KEPT_FLAG = 'void_rating_kept';

interface VoidMatchRow {
	id: string;
	puzzle: string;
	status: string;
	rated: boolean;
	winner: string | null;
	player_a_id: string | null;
	player_b_id: string | null;
	rating_a_before: number | null;
	rd_a_before: number | null;
	vol_a_before: number | null;
	rating_b_before: number | null;
	rd_b_before: number | null;
	vol_b_before: number | null;
	started_at: Date;
}

export interface VoidSidePlan {
	userId: string;
	/** Undo the rating itself (only when this was the player's latest rated match). */
	revert: boolean;
	/** Game count after removing this match; 0 with revert removes the rating row. */
	gamesAfter: number;
	counters: {games: number; wins: number; losses: number; draws: number};
	ratingData: {rating: number; rd: number; volatility: number | null; last_match_at: Date} | null;
}

/**
 * What voiding one side of a rated match does to that player's rating row (design 4.12,
 * 7.3). The counters always drop by this match. The rating goes back to what the player
 * entered the match with only if no rated match of theirs came after it; otherwise later
 * matches were rated from the current number and it stays (flagged instead). Restoring
 * RD to the entering value together with last_match_at = started_at reproduces the idle
 * growth exactly, because the growth adds in quadrature.
 */
export function planVoidSide(
	match: VoidMatchRow,
	side: BattleSide,
	stored: StoredBattleRating | null,
	hasLaterRatedMatch: boolean
): VoidSidePlan | null {
	const userId = side === 'A' ? match.player_a_id : match.player_b_id;
	if (!userId || !stored || !match.rated || !match.winner) return null;
	const score = scoreFor(match.winner as BattleWinner, side);
	const counters = {
		games: Math.max(0, stored.games - 1),
		wins: Math.max(0, stored.wins - (score === 1 ? 1 : 0)),
		losses: Math.max(0, stored.losses - (score === 0 ? 1 : 0)),
		draws: Math.max(0, stored.draws - (score === 0.5 ? 1 : 0)),
	};
	const before = side === 'A' ? match.rating_a_before : match.rating_b_before;
	const rdBefore = side === 'A' ? match.rd_a_before : match.rd_b_before;
	const volBefore = side === 'A' ? match.vol_a_before : match.vol_b_before;
	const revert = !hasLaterRatedMatch && before != null && rdBefore != null;
	return {
		userId,
		revert,
		gamesAfter: counters.games,
		counters,
		ratingData: revert
			? {rating: before as number, rd: rdBefore as number, volatility: volBefore, last_match_at: match.started_at}
			: null,
	};
}

export interface VoidBattleMatchResult {
	match_id: string;
	/** False when the match was already void. */
	changed: boolean;
	reverted_a: boolean;
	reverted_b: boolean;
}

/**
 * Admin "void this match": marks it VOID, removes it from both players' counts and, where
 * possible, puts their ratings back (planVoidSide). Unrated matches are only marked.
 */
export async function voidBattleMatch(id: string, adminId: string): Promise<VoidBattleMatchResult | null> {
	const prisma = getPrisma();
	const outcome = await prisma.$transaction(async (tx) => {
		const match = await tx.battleMatch.findUnique({where: {id}});
		if (!match) return null;
		if (match.status === 'VOID') {
			return {match_id: id, changed: false, reverted_a: false, reverted_b: false, puzzle: match.puzzle, rated: false};
		}

		const reverted: Record<BattleSide, boolean> = {A: false, B: false};
		const extraFlags: string[] = [];

		if (match.rated && match.winner) {
			for (const side of ['A', 'B'] as BattleSide[]) {
				const userId = side === 'A' ? match.player_a_id : match.player_b_id;
				if (!userId) continue;
				const stored = await tx.battleRating.findUnique({
					where: {user_id_puzzle: {user_id: userId, puzzle: match.puzzle}},
					select: storedRatingSelect,
				});
				const later = await tx.battleMatch.count({
					where: {
						id: {not: match.id},
						puzzle: match.puzzle,
						status: 'FINISHED',
						rated: true,
						ended_at: {gt: match.ended_at},
						OR: [{player_a_id: userId}, {player_b_id: userId}],
					},
				});
				const plan = planVoidSide(match, side, stored, later > 0);
				if (!plan) continue;

				if (plan.revert && plan.gamesAfter === 0) {
					// Their only rated match: they leave the leaderboard, as before it.
					await tx.battleRating.delete({where: {user_id_puzzle: {user_id: userId, puzzle: match.puzzle}}});
				} else if (plan.revert && plan.ratingData) {
					const peak = await remainingPeak(tx, userId, match.puzzle, match.id, plan.ratingData.rating);
					await tx.battleRating.update({
						where: {user_id_puzzle: {user_id: userId, puzzle: match.puzzle}},
						data: {
							...plan.counters,
							rating: plan.ratingData.rating,
							rd: plan.ratingData.rd,
							...(plan.ratingData.volatility != null ? {volatility: plan.ratingData.volatility} : {}),
							last_match_at: plan.ratingData.last_match_at,
							peak_rating: peak,
						},
					});
				} else {
					await tx.battleRating.update({
						where: {user_id_puzzle: {user_id: userId, puzzle: match.puzzle}},
						data: plan.counters,
					});
					extraFlags.push(VOID_RATING_KEPT_FLAG);
				}
				reverted[side] = plan.revert;
			}
		}

		await tx.battleMatch.update({
			where: {id},
			data: {
				status: 'VOID',
				voided_at: new Date(),
				voided_by_id: adminId,
				flags: uniqueFlags([...match.flags, ...extraFlags]),
			},
		});

		return {
			match_id: id,
			changed: true,
			reverted_a: reverted.A,
			reverted_b: reverted.B,
			puzzle: match.puzzle,
			rated: match.rated,
		};
	});

	if (!outcome) return null;
	if (outcome.changed && outcome.rated) await invalidateBattleLeaderboardCache(outcome.puzzle);
	logger.info('[Battle] Match voided', {matchId: id, adminId, outcome});
	return {
		match_id: outcome.match_id,
		changed: outcome.changed,
		reverted_a: outcome.reverted_a,
		reverted_b: outcome.reverted_b,
	};
}

/**
 * Highest rating a player held in their other rated matches, at least `floor` and the
 * starting rating: every row begins with INITIAL_RATING as its peak (planMatchPersistence).
 */
async function remainingPeak(
	tx: Prisma.TransactionClient,
	userId: string,
	puzzle: string,
	excludeMatchId: string,
	floor: number
): Promise<number> {
	const base: Prisma.BattleMatchWhereInput = {
		id: {not: excludeMatchId},
		puzzle,
		status: 'FINISHED',
		rated: true,
	};
	const [asA, asB] = await Promise.all([
		tx.battleMatch.aggregate({where: {...base, player_a_id: userId}, _max: {rating_a_after: true}}),
		tx.battleMatch.aggregate({where: {...base, player_b_id: userId}, _max: {rating_b_after: true}}),
	]);
	return Math.max(INITIAL_RATING, floor, asA._max.rating_a_after ?? floor, asB._max.rating_b_after ?? floor);
}

// ── Reports ──────────────────────────────────────────────────────────────────

export const BATTLE_REPORT_REASON_MAX = 500;

/**
 * "Report opponent" from the result screen (design 4.7). Only a player of the match can
 * report, the reported user is always the other player, one report per reporter per
 * match. Returns false when nothing was written.
 */
export async function createBattleReport(matchId: string, reporterId: string, reason?: string | null): Promise<boolean> {
	const prisma = getPrisma();
	const match = await prisma.battleMatch.findUnique({
		where: {id: matchId},
		select: {player_a_id: true, player_b_id: true},
	});
	if (!match) return false;
	const opponentId =
		match.player_a_id === reporterId ? match.player_b_id : match.player_b_id === reporterId ? match.player_a_id : null;
	if (!opponentId) return false;

	const existing = await prisma.report.count({where: {battle_match_id: matchId, created_by_id: reporterId}});
	if (existing > 0) return false;

	await prisma.report.create({
		data: {
			created_by_id: reporterId,
			reported_user_id: opponentId,
			battle_match_id: matchId,
			reason: (reason || '').trim().slice(0, BATTLE_REPORT_REASON_MAX) || null,
		},
	});
	return true;
}
