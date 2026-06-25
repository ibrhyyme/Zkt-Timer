import { Resolver, Query, Mutation, Arg, Int, Ctx, Authorized } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { DailyGoalType, SetDailyGoalInput, DailyGoalReminderResult, RoomSolveEntry } from '../schemas/DailyGoal.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';

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
			select: { daily_goal_reminder: true, daily_goal_count_room_solves: true },
		});
		return {
			enabled: user?.daily_goal_reminder ?? false,
			count_room_solves: user?.daily_goal_count_room_solves ?? false,
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
