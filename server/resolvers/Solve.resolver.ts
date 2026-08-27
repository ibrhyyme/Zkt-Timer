import { Arg, Authorized, Ctx, Mutation, Query, Resolver, Int } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import { Solve, SolveInput } from '../schemas/Solve.schema';
import { bulkCreateSolves, createSolve, updateSolve } from '../models/solve';
import { getSolveSteps } from '../util/solve/solve_method';
import { createSolveMethodSteps, deleteSolveMethodSteps } from '../models/solve_method_step';
import { generateUUID } from '../../shared/code';
import { logger } from '../services/logger';
import { updateUserAccountWithParams } from '../models/user_account';
import { GraphQLVoid } from 'graphql-scalars';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { parseSmartTurns } from '../../shared/smart_cube/parse_turns';
import { solveFingerprint } from '../../shared/solve';

function getSolvesByUserId(context: GraphQLContext, userId: string) {
	const { prisma } = context;

	return prisma.solve.findMany({
		where: {
			user_id: userId,
		},
	});
}

// Reject impossible solve times (negative / non-finite) before they reach the DB and
// corrupt stats aggregation. Only validates fields that are actually provided.
function assertValidSolveTimes(input: Partial<SolveInput>) {
	for (const field of ['time', 'raw_time'] as const) {
		const value = input[field];
		if (value != null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `Invalid solve ${field}`);
		}
	}
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
				phase_splits: true,
				solve_method_steps: true,
			},
			// Deterministic tie-break: created_at alone is not unique (a bulk import
			// writes thousands of rows within the same instant), so paging by it
			// would drop or repeat rows between pages.
			orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
			...(take ? { take } : {}),
			...(skip ? { skip } : {}),
		});
	}

	// Recovery read: returns the caller's OWN solves, gated [LOGGED_IN] (NOT Pro).
	// Basic users write to the server (canWriteSync) but READ is Pro-gated (`solves`),
	// so a wiped local IndexedDB shows empty even though the data is safe on the
	// server. This lets the client repopulate local from the server when it is empty
	// (see client init.ts recoverBasicDataFromServer). `solves` stays Pro-gated so
	// the live cross-device sync experience remains a Pro feature; this is the narrow
	// recovery door only.
	@Authorized([Role.LOGGED_IN])
	@Query(() => [Solve])
	async recoverMySolves(
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
				phase_splits: true,
				solve_method_steps: true,
			},
			// Deterministic tie-break: created_at alone is not unique (a bulk import
			// writes thousands of rows within the same instant), so paging by it
			// would drop or repeat rows between pages.
			orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
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
				phase_splits: true,
				solve_method_steps: true,
			},
		});
	}

	// Lightweight: returns only the user's solve IDs (no content) so the client can
	// compute the backfill diff (local IDs minus server IDs) without exposing solve data
	// to non-Pro users. READ of full solves stays Pro-gated.
	@Authorized([Role.LOGGED_IN])
	@Query(() => [String])
	async mySolveIds(@Ctx() context: GraphQLContext): Promise<string[]> {
		const { prisma, user } = context;
		const solves = await prisma.solve.findMany({
			where: { user_id: user.id },
			select: { id: true },
		});
		return solves.map((s) => s.id);
	}

	// Content fingerprints of the caller's own solves, used by the importer to skip
	// rows that are already stored. Import gives every parsed row a fresh id, so an
	// id-based check (mySolveIds above) cannot recognise a re-imported backup — that
	// blind spot is how an account ended up with 114k rows for 39k real solves.
	//
	// Deliberately not derived from `mySolveIds`: this returns no ids and no notes,
	// only the three fields the fingerprint needs, so a Basic user can run the check
	// without the Pro-gated read of full solve content being opened up.
	@Authorized([Role.LOGGED_IN])
	@Query(() => [String])
	async mySolveFingerprints(@Ctx() context: GraphQLContext): Promise<string[]> {
		const { prisma, user } = context;
		const solves = await prisma.solve.findMany({
			where: { user_id: user.id },
			select: { time: true, scramble: true, started_at: true },
		});
		return solves.map((s) => solveFingerprint(s));
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Solve)
	async createSolve(@Ctx() context: GraphQLContext, @Arg('input') input: SolveInput) {
		const { user } = context;

		assertValidSolveTimes(input);

		input.bulk = false;
		// cube_type='wca' requires subset (cube-subset-bucket rule) — defense in depth
		if (input.cube_type === 'wca' && !input.scramble_subset) {
			input.scramble_subset = '333';
		}
		let createdSolve;
		try {
			createdSolve = await createSolve(user, input);
		} catch (e: any) {
			// A queued solve that already landed on an earlier attempt comes back as a unique
			// violation. The row is there, so this is a success and not a failure. Reporting
			// it as an error is what made the client retry it and eventually throw away a
			// solve that had in fact been saved all along.
			if (e?.code === 'P2002' && input.id) {
				const existing = await context.prisma.solve.findFirst({
					where: { id: input.id, user_id: user.id },
				});
				if (existing) return existing;
			}
			throw e;
		}

		if (input.is_smart_cube && input.smart_turns) {
			// Pro gating: free user sends null smart_turns (client side).
			// Defensively check server too — prevent malicious bypass.
			const userIsPro = !!(user && ((user as any).is_pro || (user as any).is_premium));
			if (userIsPro) {
				try {
					const turns = parseSmartTurns(input.smart_turns);
					// Break the solve down with the method the user is actually solving
					// with. Unknown or missing values fall back to CFOP inside getMethod.
					const steps = getSolveSteps(turns, input.scramble, input.analysis_method as any);
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
					// Notify client of downgrade — otherwise client remains is_smart_cube=true
					(createdSolve as any).is_smart_cube = false;
					(createdSolve as any).solve_method_steps = [];
				}
			} else {
				// Free user accidentally sent smart_turns — don't write to DB, clear it
				await updateSolve(createdSolve.id, { smart_turns: null });
				(createdSolve as any).smart_turns = null;
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

		solves.forEach(assertValidSolveTimes);

		// Ids are assigned here rather than inside the model so the smart cube pass below
		// knows which rows it is writing steps for.
		solves.forEach((s) => {
			if (!s.id) s.id = generateUUID();
		});

		// Use existing model function
		await bulkCreateSolves(user, solves);

		// Smart cube solves arrive through this path too, not just manual imports: the app
		// migrates locally held solves to the server in chunks. Until this ran, those solves
		// kept their moves but never got an analysis, so cross time, turn count and the phase
		// breakdown came out empty on every device — and nothing in the logs said so, because
		// an empty step list is not an error anywhere in the chain.
		const userIsPro = !!(user && ((user as any).is_pro || (user as any).is_premium));
		if (userIsPro) {
			for (const input of solves) {
				if (!input.is_smart_cube || !input.smart_turns) continue;
				try {
					const turns = parseSmartTurns(input.smart_turns);
					if (!turns.length) continue;
					const steps = getSolveSteps(turns, input.scramble, (input as any).analysis_method);
					// Idempotent: re-importing the same solve must not stack duplicate steps.
					await deleteSolveMethodSteps({ id: input.id });
					await createSolveMethodSteps({ id: input.id }, steps);
				} catch (e) {
					// One unreadable solve must not cost the caller the whole chunk.
					logger.warn('Failed to create solve method steps during bulk import', {
						solveId: input.id,
						error: e,
					});
				}
			}
		}

		// Update user's last solve timestamp
		await updateUserAccountWithParams(user.id, {
			last_solve_at: new Date(),
		});
	}
}
