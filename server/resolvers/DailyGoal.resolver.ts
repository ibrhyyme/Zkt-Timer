import { Resolver, Query, Mutation, Arg, Ctx, Authorized } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { DailyGoalType, SetDailyGoalInput, DailyGoalReminderResult } from '../schemas/DailyGoal.schema';
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
			select: { daily_goal_reminder: true },
		});
		return { enabled: user?.daily_goal_reminder ?? false };
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
