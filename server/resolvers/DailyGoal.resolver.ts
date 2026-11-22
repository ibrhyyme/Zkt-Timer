import { Resolver, Query, Mutation, Arg, Int, Ctx, Authorized } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import {
	DailyGoalType,
	SetDailyGoalInput,
	DailyGoalReminderResult,
	RoomSolveEntry,
	WarmupSolveInput,
	WarmupSolveEntry,
} from '../schemas/DailyGoal.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';
import { WARMUP_SOLVE_RETENTION_DAYS } from '../../shared/solve';

const DAY_MS = 24 * 60 * 60 * 1000;
// One flush of a device that was offline for a long warm-up session fits in easily.
const MAX_WARMUP_SOLVES_PER_CALL = 500;

@Resolver()
export class DailyGoalResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [DailyGoalType])
	async dailyGoals(@Ctx() context: GraphQLContext): Promise<DailyGoalType[]> {
		try {
			return await context.prisma.dailyGoal.findMany({
				where: { user_id: context.user.id },
			});
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch daily goals');
		}
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => DailyGoalReminderResult)
	async dailyGoalReminderStatus(@Ctx() context: GraphQLContext): Promise<DailyGoalReminderResult> {
		const user = await context.prisma.userAccount.findUnique({
			where: { id: context.user.id },
			select: {
				daily_goal_reminder: true,
				daily_goal_count_room_solves: true,
				daily_goal_count_warmup_solves: true,
			},
		});
		return {
			enabled: user?.daily_goal_reminder ?? false,
			count_room_solves: user?.daily_goal_count_room_solves ?? false,
			count_warmup_solves: user?.daily_goal_count_warmup_solves ?? false,
		};
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [RoomSolveEntry])
	async myRoomSolveEntries(
		@Arg('sinceDays', () => Int) sinceDays: number,
		@Ctx() context: GraphQLContext
	): Promise<RoomSolveEntry[]> {
		const since = new Date();
		since.setHours(0, 0, 0, 0);
		since.setDate(since.getDate() - (Math.max(1, sinceDays) - 1));

		const solves = await context.prisma.friendlyRoomSolve.findMany({
			where: {
				dnf: false,
				created_at: { gte: since },
				participant: { user_id: context.user.id },
			},
			select: {
				created_at: true,
				room: { select: { cube_type: true } },
			},
		});

		return solves.map((s) => ({
			created_at: s.created_at.getTime(),
			cube_type: s.room.cube_type,
		}));
	}

	/**
	 * The user's warm-up solves for the daily goal and the heatmap. READ follows the solve
	 * history rule (Pro when Pro is on, as Solve.resolver's reads): a Basic user's timer
	 * solves do not come back from the server either, and the warm-up ones must not be the
	 * only solves another device shows.
	 */
	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Query(() => [WarmupSolveEntry])
	async myWarmupSolveEntries(
		@Arg('sinceDays', () => Int) sinceDays: number,
		@Ctx() context: GraphQLContext
	): Promise<WarmupSolveEntry[]> {
		const days = Math.min(Math.max(1, sinceDays), WARMUP_SOLVE_RETENTION_DAYS);
		const since = BigInt(Date.now() - days * DAY_MS);

		const rows = await context.prisma.warmupSolve.findMany({
			where: { user_id: context.user.id, started_at: { gte: since } },
			select: { id: true, cube_type: true, scramble_subset: true, started_at: true },
		});

		return rows.map((r) => ({
			id: r.id,
			cube_type: r.cube_type,
			scramble_subset: r.scramble_subset ?? undefined,
			started_at: Number(r.started_at),
		}));
	}

	/** WRITE is every logged-in user's, as with solves (canWriteSync). Idempotent per id. */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async addWarmupSolves(
		@Arg('solves', () => [WarmupSolveInput]) solves: WarmupSolveInput[],
		@Ctx() context: GraphQLContext
	): Promise<boolean> {
		if (solves.length > MAX_WARMUP_SOLVES_PER_CALL) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Too many warm-up solves');
		}

		const now = Date.now();
		const oldest = now - WARMUP_SOLVE_RETENTION_DAYS * DAY_MS;
		const data = solves
			.filter(
				(s) =>
					!!s.id &&
					s.id.length <= 64 &&
					!!s.cube_type &&
					s.cube_type.length <= 64 &&
					(s.scramble_subset ?? '').length <= 64 &&
					Number.isFinite(s.started_at) &&
					s.started_at >= oldest &&
					s.started_at <= now + DAY_MS
			)
			.map((s) => ({
				id: s.id,
				user_id: context.user.id,
				cube_type: s.cube_type,
				scramble_subset: s.scramble_subset || null,
				started_at: BigInt(Math.round(s.started_at)),
			}));

		if (data.length) {
			// skipDuplicates: a retry after a lost answer finds its rows already there.
			await context.prisma.warmupSolve.createMany({ data, skipDuplicates: true });
		}
		return true;
	}

	/** A warm-up solve that was saved after all (or whose auto-save was undone the other way). */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async removeWarmupSolves(
		// validate: false as every [String] arg here: class-validator refuses a primitive array.
		@Arg('ids', () => [String], { validate: false }) ids: string[],
		@Ctx() context: GraphQLContext
	): Promise<boolean> {
		if (ids.length > MAX_WARMUP_SOLVES_PER_CALL) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Too many warm-up solves');
		}
		const valid = ids.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64);
		if (valid.length) {
			await context.prisma.warmupSolve.deleteMany({
				where: { user_id: context.user.id, id: { in: valid } },
			});
		}
		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => DailyGoalType)
	async setDailyGoal(
		@Arg('input') input: SetDailyGoalInput,
		@Ctx() context: GraphQLContext
	): Promise<DailyGoalType> {
		try {
			const subset = input.scramble_subset ?? '';
			return await context.prisma.dailyGoal.upsert({
				where: {
					user_id_cube_type_scramble_subset: {
						user_id: context.user.id,
						cube_type: input.cube_type,
						scramble_subset: subset,
					},
				},
				create: {
					user_id: context.user.id,
					cube_type: input.cube_type,
					scramble_subset: subset,
					target: input.target,
					enabled: input.enabled ?? true,
				},
				update: {
					target: input.target,
					enabled: input.enabled ?? undefined,
				},
			});
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to set daily goal');
		}
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => DailyGoalReminderResult)
	async setDailyGoalReminder(
		@Arg('enabled') enabled: boolean,
		@Ctx() context: GraphQLContext
	): Promise<DailyGoalReminderResult> {
		await context.prisma.userAccount.update({
			where: { id: context.user.id },
			data: { daily_goal_reminder: enabled },
		});
		return { enabled };
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => DailyGoalReminderResult)
	async setDailyGoalCountRoomSolves(
		@Arg('enabled') enabled: boolean,
		@Ctx() context: GraphQLContext
	): Promise<DailyGoalReminderResult> {
		await context.prisma.userAccount.update({
			where: { id: context.user.id },
			data: { daily_goal_count_room_solves: enabled },
		});
		return { enabled, count_room_solves: enabled };
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => DailyGoalReminderResult)
	async setDailyGoalCountWarmupSolves(
		@Arg('enabled') enabled: boolean,
		@Ctx() context: GraphQLContext
	): Promise<DailyGoalReminderResult> {
		await context.prisma.userAccount.update({
			where: { id: context.user.id },
			data: { daily_goal_count_warmup_solves: enabled },
		});
		return { enabled, count_warmup_solves: enabled };
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async removeDailyGoal(
		@Arg('cubeType') cubeType: string,
		@Ctx() context: GraphQLContext,
		@Arg('scrambleSubset', { nullable: true }) scrambleSubset?: string
	): Promise<boolean> {
		try {
			await context.prisma.dailyGoal.delete({
				where: {
					user_id_cube_type_scramble_subset: {
						user_id: context.user.id,
						cube_type: cubeType,
						scramble_subset: scrambleSubset ?? '',
					},
				},
			});
			return true;
		} catch (error) {
			// Kayit yoksa sessizce true don
			return true;
		}
	}
}
