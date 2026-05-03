import { Arg, Authorized, Ctx, Mutation, Query, Resolver, Int } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import { Solve, SolveInput } from '../schemas/Solve.schema';
import { bulkCreateSolves, createSolve, updateSolve } from '../models/solve';
import { getSolveSteps } from '../util/solve/solve_method';
import { createSolveMethodSteps } from '../models/solve_method_step';
import { logger } from '../services/logger';
import { updateUserAccountWithParams } from '../models/user_account';
import { GraphQLVoid } from 'graphql-scalars';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { parseSmartTurns } from '../../shared/smart_cube/parse_turns';

function getSolvesByUserId(context: GraphQLContext, userId: string) {
	const { prisma } = context;

	return prisma.solve.findMany({
		where: {
			user_id: userId,
		},
	});
}

@Resolver()
export class SolveResolver {
	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Query(() => [Solve])
	async solves(
		@Ctx() context: GraphQLContext,
		@Arg('take', () => Int, { nullable: true }) take?: number,
		@Arg('skip', () => Int, { nullable: true }) skip?: number
	) {
		const { prisma } = context;

		return prisma.solve.findMany({
			where: {
				user_id: context.user.id,
			},
			select: {
				id: true,
				time: true,
				raw_time: true,
				cube_type: true,
				scramble_subset: true,
				session_id: true,
				trainer_name: true,
				bulk: true,
				from_timer: true,
				training_session_id: true,
				dnf: true,
				plus_two: true,
				scramble: true,
				is_smart_cube: true,
				created_at: true,
				started_at: true,
				ended_at: true,
				solve_method_steps: true,
			},
			orderBy: {
				created_at: 'desc',
			},
			...(take ? { take } : {}),
			...(skip ? { skip } : {}),
		});
	}




	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Query(() => [Solve])
	async solvesByIds(
		@Ctx() context: GraphQLContext,
		@Arg('ids', () => [String], { validate: false }) ids: string[]
	) {
		const { prisma } = context;

		if (!ids?.length) return [];

		return prisma.solve.findMany({
			where: {
				user_id: context.user.id,
				id: { in: ids },
			},
			select: {
				id: true,
				time: true,
				raw_time: true,
				cube_type: true,
				scramble_subset: true,
				session_id: true,
				trainer_name: true,
				bulk: true,
				from_timer: true,
				training_session_id: true,
				dnf: true,
				plus_two: true,
				scramble: true,
				is_smart_cube: true,
				created_at: true,
				started_at: true,
				ended_at: true,
				solve_method_steps: true,
			},
		});
	}

	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Mutation(() => Solve)
	async createSolve(@Ctx() context: GraphQLContext, @Arg('input') input: SolveInput) {
		const { user } = context;

		input.bulk = false;
		const createdSolve = await createSolve(user, input);

		if (input.is_smart_cube && input.smart_turns) {
			// Pro gating: free user smart_turns null gonderiyor (client tarafinda).
			// Defensive olarak server'da da kontrol et — malicious bypass'i engelle.
			const userIsPro = !!(user && ((user as any).is_pro || (user as any).is_premium));
			if (userIsPro) {
				try {
					const turns = parseSmartTurns(input.smart_turns);
					const steps = getSolveSteps(turns);
					const methodStepsData = await createSolveMethodSteps(createdSolve, steps);
					(createdSolve as any).solve_method_steps = methodStepsData.map((s) => ({
						...s,
						created_at: new Date(),
					}));
				} catch (e) {
					logger.warn('Failed to create solve method steps', {
						error: e,
					});
					await updateSolve(createdSolve.id, {
						is_smart_cube: false,
					});
					// Client'a downgrade'i bildir — yoksa client is_smart_cube=true olarak kalir
					(createdSolve as any).is_smart_cube = false;
					(createdSolve as any).solve_method_steps = [];
				}
			} else {
				// Free user yanlislikla smart_turns gonderdiyse DB'ye yazma — sil
				await updateSolve(createdSolve.id, { smart_turns: null });
				(createdSolve as any).smart_turns = null;
			}
		}

		await updateUserAccountWithParams(user.id, {
			last_solve_at: new Date(),
		});

		return createdSolve;
	}

	@Authorized([Role.LOGGED_IN, Role.PRO])
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

	@Authorized([Role.LOGGED_IN, Role.PRO])
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

	@Authorized([Role.LOGGED_IN, Role.PRO])
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
