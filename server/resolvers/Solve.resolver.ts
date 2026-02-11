import { Arg, Authorized, Ctx, Mutation, Query, Resolver, Int } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import { Solve, SolveInput } from '../schemas/Solve.schema';
import { getMatchById } from '../models/match';
import { bulkCreateSolves, createSolve, updateSolve } from '../models/solve';
import { getSolveSteps } from '../util/solve/solve_method';
import { createSolveMethodSteps } from '../models/solve_method_step';
import { logger } from '../services/logger';
import { updateUserAccountWithParams } from '../models/user_account';
import { GraphQLVoid } from 'graphql-scalars';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';

function getSolvesByUserId(context: GraphQLContext, userId: string) {
	const { prisma } = context;

	return prisma.solve.findMany({
		where: {
			user_id: userId,
			game_session_id: null,
		},
	});
}

@Resolver()
export class SolveResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [Solve])
	async solves(
		@Ctx() context: GraphQLContext,
		@Arg('take', () => Int, { nullable: true }) take?: number
	) {
		const { prisma } = context;

		return prisma.solve.findMany({
			where: {
				user_id: context.user.id,
				game_session_id: null,
			},
			orderBy: {
				created_at: 'desc',
			},
			...(take ? { take } : {}),
		});
	}



	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Solve)
	async createSolve(@Ctx() context: GraphQLContext, @Arg('input') input: SolveInput) {
		const { user } = context;

		if (input.match_id) {
			const match = await getMatchById(input.match_id);
			for (const part of match.participants) {
				if (part.user_id === user.id) {
					input.match_participant_id = part.id;
					break;
				}
			}
		}

		input.bulk = false;
		const createdSolve = await createSolve(user, input);

		if (input.is_smart_cube) {
			try {
				const turns = JSON.parse(input.smart_turns);
				const steps = getSolveSteps(turns);
				await createSolveMethodSteps(createdSolve, steps);
			} catch (e) {
				logger.warn('Failed to create solve method steps', {
					error: e,
				});
				await updateSolve(createdSolve.id, {
					is_smart_cube: false,
				});
			}
		}

		await updateUserAccountWithParams(user.id, {
			last_solve_at: new Date(),
		});

		return createdSolve;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => GraphQLVoid)
	async deleteAllSolvesInSession(@Ctx() context: GraphQLContext, @Arg('sessionId') sessionId: string) {
		const { prisma, user } = context;

		const session = await prisma.session.findFirst({
			where: {
				id: sessionId,
				user_id: user.id,
			},
		});

		if (!session) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Session not found');
		}

		await prisma.solve.deleteMany({
			where: {
				session_id: sessionId,
				user_id: user.id,
			},
		});

		await updateUserAccountWithParams(user.id, {
			last_solve_at: new Date(),
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteSolves(@Ctx() context: GraphQLContext, @Arg('ids', () => [String], { validate: false }) ids: string[]) {
		const { prisma, user } = context;

		await prisma.solve.deleteMany({
			where: {
				id: {
					in: ids,
				},
				user_id: user.id,
			},
		});

		await updateUserAccountWithParams(user.id, {
			last_solve_at: new Date(),
		});

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => GraphQLVoid)
	async bulkCreateSolves(@Ctx() context: GraphQLContext, @Arg('solves', () => [SolveInput]) solves: SolveInput[]) {
		const { user } = context;

		// Validation
		if (!solves || !solves.length) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Must include at least one solve');
		}

		if (solves.length > 500) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cannot import more than 500 solves per request');
		}

		// Use existing model function
		await bulkCreateSolves(user, solves);

		// Update user's last solve timestamp
		await updateUserAccountWithParams(user.id, {
			last_solve_at: new Date(),
		});
	}
}
