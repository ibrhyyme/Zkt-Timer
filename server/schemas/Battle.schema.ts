import {Field, Int, ObjectType} from 'type-graphql';
import PaginatedResponse from './Pagination.schema';

/**
 * Online Battle GraphQL types (design ranking-battle.md 4.12). Ratings go out rounded
 * and RD never leaves the server: players see a number and a "provisional" mark.
 * Rows are built by server/models/battle.ts, never a raw Prisma row.
 */

@ObjectType()
export class BattlePlayer {
	/** Null for a deleted account. */
	@Field({nullable: true})
	id?: string;

	@Field({nullable: true})
	username?: string;

	/** Storage path of the profile picture (client: getStorageURL). */
	@Field({nullable: true})
	pfp_image_url?: string;
}

@ObjectType()
export class BattleLeaderboardRow {
	@Field(() => Int)
	rank: number;

	@Field()
	user_id: string;

	@Field({nullable: true})
	username?: string;

	@Field({nullable: true})
	pfp_image_url?: string;

	@Field(() => Int)
	rating: number;

	@Field()
	provisional: boolean;

	@Field(() => Int)
	games: number;

	@Field(() => Int)
	wins: number;

	@Field(() => Int)
	losses: number;

	@Field(() => Int)
	draws: number;
}

@ObjectType()
export class BattleLeaderboardPage {
	@Field(() => [BattleLeaderboardRow])
	rows: BattleLeaderboardRow[];

	@Field(() => Int)
	total_count: number;

	@Field(() => Int)
	page: number;

	@Field(() => Int)
	page_size: number;
}

@ObjectType()
export class MyBattleRating {
	@Field()
	puzzle: string;

	@Field(() => Int)
	rating: number;

	@Field()
	provisional: boolean;

	@Field(() => Int)
	games: number;

	@Field(() => Int)
	wins: number;

	@Field(() => Int)
	losses: number;

	@Field(() => Int)
	draws: number;

	@Field(() => Int)
	peak_rating: number;

	/** Same rank as the leaderboard; null while the player is not listed (a running ban). */
	@Field(() => Int, {nullable: true})
	rank?: number;
}

@ObjectType()
export class BattleMatchSummary {
	@Field()
	id: string;

	@Field()
	puzzle: string;

	@Field()
	ended_at: Date;

	/** WIN | LOSS | DRAW from the history owner's side. */
	@Field()
	result: string;

	@Field(() => Int)
	score_for: number;

	@Field(() => Int)
	score_against: number;

	@Field()
	rated: boolean;

	@Field()
	is_rematch: boolean;

	/** NORMAL | FORFEIT | DISCONNECT | ABANDON | SERVER_RESTART */
	@Field()
	end_reason: string;

	@Field(() => Int, {nullable: true})
	rating_before?: number;

	@Field(() => Int, {nullable: true})
	rating_after?: number;

	@Field(() => Int, {nullable: true})
	delta?: number;

	@Field(() => BattlePlayer)
	opponent: BattlePlayer;
}

@ObjectType()
export class BattleMatchHistoryPage extends PaginatedResponse(BattleMatchSummary) {}

@ObjectType()
export class BattleRoundDetail {
	@Field(() => Int)
	index: number;

	@Field()
	scramble: string;

	/** A | B | DRAW */
	@Field()
	winner: string;

	@Field(() => Int, {nullable: true})
	a_time_ms?: number;

	/** PLUS_TWO | PLUS_FOUR | DNF */
	@Field({nullable: true})
	a_penalty?: string;

	@Field(() => Int, {nullable: true})
	b_time_ms?: number;

	@Field({nullable: true})
	b_penalty?: string;

	/** Staff only; empty for players. */
	@Field(() => [String])
	a_flags: string[];

	@Field(() => [String])
	b_flags: string[];

	/** Move log as JSON ([{t, c, l}]), admins only. */
	@Field({nullable: true})
	a_moves?: string;

	@Field({nullable: true})
	b_moves?: string;
}

@ObjectType()
export class BattleMatchDetail {
	@Field()
	id: string;

	@Field()
	puzzle: string;

	/** FINISHED | VOID */
	@Field()
	status: string;

	@Field()
	end_reason: string;

	@Field()
	rated: boolean;

	@Field()
	is_rematch: boolean;

	@Field({nullable: true})
	winner?: string;

	@Field(() => Int)
	rounds_a: number;

	@Field(() => Int)
	rounds_b: number;

	@Field(() => Int, {nullable: true})
	rating_a_before?: number;

	@Field(() => Int, {nullable: true})
	rating_a_after?: number;

	@Field(() => Int, {nullable: true})
	rating_b_before?: number;

	@Field(() => Int, {nullable: true})
	rating_b_after?: number;

	@Field()
	started_at: Date;

	@Field()
	ended_at: Date;

	@Field({nullable: true})
	voided_at?: Date;

	/** Staff only; empty for players. */
	@Field(() => [String])
	flags: string[];

	/** A | B when the viewer played this match. */
	@Field({nullable: true})
	viewer_side?: string;

	@Field(() => BattlePlayer)
	player_a: BattlePlayer;

	@Field(() => BattlePlayer)
	player_b: BattlePlayer;

	@Field(() => [BattleRoundDetail])
	rounds: BattleRoundDetail[];
}

@ObjectType()
export class AdminBattleMatchRow {
	@Field()
	id: string;

	@Field()
	puzzle: string;

	@Field()
	status: string;

	@Field()
	end_reason: string;

	@Field()
	rated: boolean;

	@Field({nullable: true})
	winner?: string;

	@Field(() => Int)
	rounds_a: number;

	@Field(() => Int)
	rounds_b: number;

	@Field()
	ended_at: Date;

	@Field({nullable: true})
	voided_at?: Date;

	/** Match flags and every round flag, without duplicates. */
	@Field(() => [String])
	flags: string[];

	@Field(() => BattlePlayer)
	player_a: BattlePlayer;

	@Field(() => BattlePlayer)
	player_b: BattlePlayer;
}

@ObjectType()
export class AdminBattleMatchPage extends PaginatedResponse(AdminBattleMatchRow) {}

@ObjectType()
export class VoidBattleMatchResult {
	@Field()
	match_id: string;

	/** False when the match was already void. */
	@Field()
	changed: boolean;

	/** Whether player A's rating went back to its value before the match. */
	@Field()
	reverted_a: boolean;

	@Field()
	reverted_b: boolean;
}
