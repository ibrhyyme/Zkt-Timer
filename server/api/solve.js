import {
	bulkCreateSolves,
	deleteAllSolves,
	deleteAllTrainingSolves,
	deleteAllSolvesByCubeType,
	deleteSolve,
	deleteTrainingSolves,
	getSolve,
	updateSolve,
	updateSolveLiteral,
	getSolveByShareCode,
	getFilteredSolveList,
	getBasicSolve,
} from '../models/solve';
import GraphQLError from '../util/graphql_error';
import {checkLoggedIn} from '../util/auth';
import {deleteAllTopAverages, deleteAllTopSolves, deleteTopAverage, deleteTopSolveById} from '../models/top_solve';
import {deleteSolveMethodSteps} from '../models/solve_method_step';
import {generateRandomString} from '../../shared/code';
import {createSolveView, deleteSolveViewsBySolveId} from '../models/solve_view';
import {invalidSolveTimeFields, SOLVE_SESSION_MISSING_I18N_KEY} from '../../shared/solve';
import {getPrisma} from '../database';
import {ErrorCode} from '../constants/errors';
import {checkRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';
import {resolveOwnedLinks} from '../util/solve_links';

export const gqlType = `
	enum SolvesSortBy {
		CREATED_AT_DESC
		CREATED_AT_ASC
		TIME_DESC
		TIME_ASC
	}
	
	enum SolvesFilter {
		PLUS_TWO
		NOT_PLUS_TWO
		DNF
		NOT_DNF
		IMPORTED
		NOT_IMPORTED
		SMART
		NOT_SMART
	}
`;

export const gqlQuery = `
	solve(id: String): Solve
	solveList(cubeType: String, filters: [SolvesFilter], sortBy: SolvesSortBy, page: Int, includeAll: Boolean): SolveList
	solveByShareCode(shareCode: String): Solve
`;

export const gqlMutation = `
	deleteSolve(id: String): Solve!
	updateSolve(id: String, input: SolveInput): Solve!
	deleteTrainingSolves(id: String): Void
	deleteSolvesByCubeType(cubeType: String): Void
	deleteAllTrainingSolves: Void
	deleteAllSolves: Void
	recordSolveView(shareCode: String!): Boolean!
`;

const filterMap = {
	PLUS_TWO: {plus_two: true},
	NOT_PLUS_TWO: {plus_two: false},
	DNF: {dnf: true},
	NOT_DNF: {dnf: false},
	IMPORTED: {bulk: true},
	NOT_IMPORTED: {bulk: false},
	SMART: {is_smart_cube: true},
	NOT_SMART: {is_smart_cube: false},
};

const orderByMap = {
	CREATED_AT_DESC: {created_at: 'desc'},
	CREATED_AT_ASC: {created_at: 'asc'},
	TIME_DESC: {time: 'desc'},
	TIME_ASC: {time: 'asc'},
};

// Both solve reads are open to anyone holding an id or share code. `solve_views` lists
// who opened the solve and when (viewer_id per row); that is the owner's business, not
// the next visitor's. The client never selects it, so non-owners get an empty list.
function hideSolveViewsFromOthers(solve, user) {
	if (solve && (!user || user.id !== solve.user_id)) {
		solve.solve_views = [];
	}
	return solve;
}

export const queryActions = {
	solve: async (_, {id}, context) => {
		const solve = await getSolve(id);

		if (!solve) {
			throw new GraphQLError(ErrorCode.NOT_FOUND);
		}

		// Every solve gets a code when it is created; only rows from before that lack one.
		// Only the owner fills it in: this query is open to anyone holding an id, and a
		// visitor must not be able to write to someone else's solve.
		if (!solve.share_code && context?.user?.id && context.user.id === solve.user_id) {
			const shareCode = generateRandomString(8);
			solve.share_code = shareCode;

			await updateSolveLiteral(solve.id, {
				share_code: shareCode,
			});
		}

		return hideSolveViewsFromOthers(solve, context?.user);
	},

	solveByShareCode: async (_, {shareCode}, {user, req}) => {
		// Defense in depth: share_code is a strong capability token (36^8), but throttle
		// per IP to deter enumeration attempts on the public route.
		const ip = req ? extractIp(req) : null;
		if (ip) {
			const limit = await checkRateLimit(`solve_share:ip:${ip}`, 60, 60);
			if (!limit.allowed) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla istek. Lutfen biraz bekleyin.');
			}
		}

		const solve = await getSolveByShareCode(shareCode);

		if (!solve) {
			throw new GraphQLError(ErrorCode.NOT_FOUND);
		}

		// No view is recorded here (see recordSolveView): this query also serves the SSR
		// prefetch, which reaches the API without the visitor's cookie.
		return hideSolveViewsFromOthers(solve, user);
	},

	solveList: async (_, {cubeType, filters, sortBy, page, includeAll}, {user}) => {
		checkLoggedIn(user);

		const pageSize = 25;
		const pageOffset = pageSize * page;

		const whereFilter = filters.map((filter) => filterMap[filter]);
		whereFilter.push({cube_type: cubeType});

		const [totalCount, solves] = await getFilteredSolveList(
			user,
			whereFilter,
			orderByMap[sortBy],
			pageOffset,
			pageSize + 1
		);

		let moreResults = false;
		if (solves.length > pageSize) {
			solves.pop();
			moreResults = true;
		}

		return {
			solves,
			total_count: totalCount,
			more_results: moreResults,
		};
	},
};

export const mutateActions = {
	// The shared solve page calls this once it has mounted, with the visitor's own session.
	// Counting inside solveByShareCode recorded the SSR prefetch, which carries no cookie: the
	// owner opening their own link was counted as an anonymous visitor, and so was every link
	// preview bot. Over the limit the view is skipped, never an error the page would show.
	recordSolveView: async (_, {shareCode}, {user, req}) => {
		const ip = req ? extractIp(req) : null;
		if (ip) {
			const limit = await checkRateLimit(`solve_view:ip:${ip}`, 60, 60);
			if (!limit.allowed) {
				return false;
			}
		}

		const solve = await getPrisma().solve.findUnique({
			where: {share_code: shareCode},
			select: {id: true, user_id: true},
		});
		if (!solve || user?.id === solve.user_id) {
			return false;
		}

		await createSolveView(user, solve);
		return true;
	},

	deleteSolve: async (_, {id}, {user}) => {
		checkLoggedIn(user);

		const solve = await getSolve(id);

		// Ownership check MUST run before the cascade deletes below. getSolve() has no
		// owner filter, so checking ownership later would let any logged-in user wipe
		// another user's top_solve / method_steps / solve_views by passing their id
		// (the id leaks via the public share payload).
		if (!solve || solve.user_id !== user.id) {
			throw new GraphQLError(ErrorCode.NOT_FOUND);
		}

		if (solve?.top_solve?.length) {
			for (const top of solve.top_solve) {
				await deleteTopSolveById(top.id);
			}
		}

		if (
			solve?.top_average_1?.length ||
			solve?.top_average_2?.length ||
			solve?.top_average_3?.length ||
			solve?.top_average_4?.length ||
			solve?.top_average_5?.length
		) {
			await deleteTopAverage(solve.cube_type, user);
		}

		if (solve.solve_method_steps) {
			await deleteSolveMethodSteps(solve);
		}

		if (solve.solve_views) {
			await deleteSolveViewsBySolveId(solve.id);
		}

		return await deleteSolve(solve);
	},

	deleteTrainingSolves: async (_, {id}, {user}) => {
		checkLoggedIn(user);

		if (!id) {
			throw new GraphQLError(ErrorCode.NOT_FOUND);
		}

		await deleteTrainingSolves(id, user);
	},

	deleteAllTrainingSolves: async (_, params, {user}) => {
		checkLoggedIn(user);

		await deleteAllTrainingSolves(user);
	},

	deleteAllSolves: async (_, params, {user}) => {
		checkLoggedIn(user);

		await deleteAllTopSolves(user);
		await deleteAllTopAverages(user);

		await deleteAllSolves(user);
	},

	updateSolve: async (_, {id, input}, {user}) => {
		checkLoggedIn(user);

		const solve = await getBasicSolve(id);
		if (!solve || solve.user_id !== user.id) {
			throw new GraphQLError(ErrorCode.NOT_FOUND);
		}

		// Same rule the type-graphql layer enforces on create. Solve mutations are split
		// across two resolver layers, and validation that lands on only one of them is how
		// this pair drifted apart before: create refused the DNF sentinel while update let
		// it through, so which write path a solve took decided whether it was storable.
		const invalidTimes = invalidSolveTimeFields(input);
		if (invalidTimes.length) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `Invalid solve ${invalidTimes[0]}`);
		}

		// Moving a solve is only allowed into one of the caller's own sessions. Nothing checked
		// this, so a solve could be pointed at another account's session (or at one that does
		// not exist, which surfaced as an opaque foreign key failure).
		if (input.session_id && input.session_id !== solve.session_id) {
			const ownsSession = await getPrisma().session.findFirst({
				where: {id: input.session_id, user_id: user.id},
				select: {id: true},
			});
			if (!ownsSession) {
				throw new GraphQLError(ErrorCode.NOT_FOUND, 'Session not found', {
					i18nKey: SOLVE_SESSION_MISSING_I18N_KEY,
				});
			}
		}

		// The device link follows the same rule as on create (Solve.resolver.ts): one of the
		// caller's own devices, by row id or by BLE identifier, or nothing. Corrected, never
		// refused, so an edit cannot fail on the foreign key or point at another account's device.
		// The cube link (cube_id, no foreign key) is checked in the same pass against the bucket
		// the solve will have after this edit: the caller's own cube of that puzzle, or null. A
		// request that does not name a cube may get one from its device link (an older app);
		// an explicit null unlinks (server/util/solve_links.ts).
		const bucketChanges = input.cube_type !== undefined || input.scramble_subset !== undefined;
		if (input.smart_device_id !== undefined || input.cube_id !== undefined || (bucketChanges && solve.cube_id)) {
			const link = {
				id,
				smart_device_id: input.smart_device_id !== undefined ? input.smart_device_id : solve.smart_device_id,
				cube_id: input.cube_id !== undefined ? input.cube_id : solve.cube_id,
				cube_type: input.cube_type !== undefined ? input.cube_type : solve.cube_type,
				scramble_subset: input.scramble_subset !== undefined ? input.scramble_subset : solve.scramble_subset,
				trainer_name: input.trainer_name !== undefined ? input.trainer_name : solve.trainer_name,
			};
			await resolveOwnedLinks(getPrisma(), user.id, [link], 'updateSolve', {
				deriveFromSmartDevice: input.cube_id === undefined && !solve.cube_id,
			});
			if (input.smart_device_id !== undefined) input.smart_device_id = link.smart_device_id;
			if (input.cube_id !== undefined || link.cube_id !== solve.cube_id) input.cube_id = link.cube_id;
		}

		// These fields can't be updated by the user. The gyro ones are written once, at create,
		// behind the Pro and size checks there (Solve.resolver.ts gateGyroFields).
		input.bulk = solve.bulk;
		input.from_timer = solve.from_timer;
		delete input.smart_rotations;
		delete input.smart_gyro;

		return await updateSolve(id, {
			...solve,
			...input,
		});
	},

	deleteSolvesByCubeType: async (_, {cubeType}, {user}) => {
		checkLoggedIn(user);

		await deleteAllSolvesByCubeType(cubeType, user);
	},
};
