import {Arg, Authorized, Ctx, Int, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getSiteConfig} from '../models/site_config';
import {
	getBattleLeaderboard,
	getBattleMatchDetail,
	getBattleMatchHistory,
	getFlaggedBattleMatches,
	getMyBattleRating,
	isBattlePuzzle,
	isOnlineBattleOpen,
	voidBattleMatch,
} from '../models/battle';
import {
	AdminBattleMatchPage,
	BattleLeaderboardPage,
	BattleMatchDetail,
	BattleMatchHistoryPage,
	MyBattleRating,
	VoidBattleMatchResult,
} from '../schemas/Battle.schema';
import {BATTLE_PUZZLE, LEADERBOARD_PAGE_SIZE} from '../../shared/battle/config';

const SEARCH_MAX_LENGTH = 50;
/** Deep enough for any real list, low enough that a page number cannot ask for a huge OFFSET. */
const MAX_PAGE = 1000;

function checkPuzzle(puzzle: string): string {
	const p = puzzle || BATTLE_PUZZLE;
	if (!isBattlePuzzle(p)) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Unknown battle puzzle');
	}
	return p;
}

function checkPage(page: number): number {
	const p = Math.floor(page || 0);
	if (p < 0 || p > MAX_PAGE) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid page');
	}
	return p;
}

/**
 * While online_battle_enabled is off the battle data is only for the people who can play
 * (admins and the flag's access list), the same rule the socket layer applies. Everyone
 * else gets an empty result, which is what the hidden Leaderboard page expects.
 */
async function battleOpenFor(ctx: GraphQLContext | undefined): Promise<boolean> {
	const config = await getSiteConfig();
	return isOnlineBattleOpen(config, ctx?.user);
}

/**
 * Online Battle reads and admin actions (design ranking-battle.md 4.12). Everything live
 * (queue, match, results) is Socket.IO in server/battle; this is what is read later.
 */
@Resolver()
export class BattleResolver {
	@Query(() => BattleLeaderboardPage)
	async battleLeaderboard(
		@Arg('puzzle', {nullable: true, defaultValue: BATTLE_PUZZLE}) puzzle: string,
		@Arg('page', () => Int, {nullable: true, defaultValue: 0}) page: number,
		@Arg('search', {nullable: true}) search: string,
		@Ctx() ctx: GraphQLContext
	): Promise<BattleLeaderboardPage> {
		const p = checkPuzzle(puzzle);
		const safePage = checkPage(page);
		const term = (search || '').trim().slice(0, SEARCH_MAX_LENGTH);
		if (!(await battleOpenFor(ctx))) {
			return {rows: [], total_count: 0, page: safePage, page_size: LEADERBOARD_PAGE_SIZE};
		}
		return (await getBattleLeaderboard(p, safePage, term)) as BattleLeaderboardPage;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => MyBattleRating, {nullable: true})
	async myBattleRating(
		@Arg('puzzle', {nullable: true, defaultValue: BATTLE_PUZZLE}) puzzle: string,
		@Ctx() ctx: GraphQLContext
	): Promise<MyBattleRating | null> {
		const p = checkPuzzle(puzzle);
		if (!(await battleOpenFor(ctx))) return null;
		return (await getMyBattleRating(ctx.user.id, p)) as MyBattleRating | null;
	}

	/**
	 * Any player's rating and leaderboard position, for the line on their public profile
	 * (ranking-battle 5.6, Q5: the leaderboard is public, so the profile line is too).
	 * A banned player has no leaderboard position and gets null, same as the list.
	 */
	@Query(() => MyBattleRating, {nullable: true})
	async userBattleRating(
		@Arg('userId') userId: string,
		@Arg('puzzle', {nullable: true, defaultValue: BATTLE_PUZZLE}) puzzle: string,
		@Ctx() ctx: GraphQLContext
	): Promise<MyBattleRating | null> {
		const p = checkPuzzle(puzzle);
		if (!userId || !(await battleOpenFor(ctx))) return null;
		const rating = await getMyBattleRating(userId, p);
		if (!rating || rating.rank == null) return null;
		return rating as MyBattleRating;
	}

	@Query(() => BattleMatchHistoryPage)
	async battleMatchHistory(
		@Arg('userId') userId: string,
		@Arg('page', () => Int, {nullable: true, defaultValue: 0}) page: number,
		@Ctx() ctx: GraphQLContext
	): Promise<BattleMatchHistoryPage> {
		const safePage = checkPage(page);
		if (!userId || !(await battleOpenFor(ctx))) {
			return {items: [], total: 0, hasMore: false};
		}
		return (await getBattleMatchHistory(userId, safePage)) as BattleMatchHistoryPage;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => BattleMatchDetail, {nullable: true})
	async battleMatch(@Arg('id') id: string, @Ctx() ctx: GraphQLContext): Promise<BattleMatchDetail | null> {
		// Null for "no such match" and "not yours" alike, so ids cannot be probed.
		if (!id) return null;
		return (await getBattleMatchDetail(id, ctx.user)) as BattleMatchDetail | null;
	}

	@Authorized([Role.MOD])
	@Query(() => AdminBattleMatchPage)
	async adminFlaggedBattleMatches(
		@Arg('page', () => Int, {nullable: true, defaultValue: 0}) page: number
	): Promise<AdminBattleMatchPage> {
		return (await getFlaggedBattleMatches(checkPage(page))) as AdminBattleMatchPage;
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => VoidBattleMatchResult)
	async adminVoidBattleMatch(@Arg('id') id: string, @Ctx() ctx: GraphQLContext): Promise<VoidBattleMatchResult> {
		const result = id ? await voidBattleMatch(id, ctx.user.id) : null;
		if (!result) {
			throw new GraphQLError(ErrorCode.NOT_FOUND);
		}
		return result;
	}
}
