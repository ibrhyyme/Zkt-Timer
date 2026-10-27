import 'reflect-metadata';

// `solve(id)` is open to anyone holding a solve id. An old solve created before every solve
// got a share code is filled in on read, and that write must only happen for its owner:
// a visitor (signed in or not) must not be able to write to someone else's solve.

const findUnique = jest.fn(async () => ({id: 'solve-1', user_id: 'owner-1', share_code: null, solve_views: []}));
const update = jest.fn(async () => ({}));

jest.mock('../../database', () => ({getPrisma: () => ({solve: {findUnique, update}})}));
jest.mock('../../services/rate_limit', () => ({checkRateLimit: jest.fn(async () => ({allowed: true}))}));
jest.mock('../../models/solve_view', () => ({
	createSolveView: jest.fn(async () => undefined),
	deleteSolveViewsBySolveId: jest.fn(async () => undefined),
}));
jest.mock('../../util/auth', () => ({checkLoggedIn: jest.fn()}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {queryActions} = require('../solve');

beforeEach(() => {
	jest.clearAllMocks();
});

describe('solve(id) share code on an old solve', () => {
	it('is filled in when the owner opens it', async () => {
		const solve = await queryActions.solve(null, {id: 'solve-1'}, {user: {id: 'owner-1'}});
		expect(solve.share_code).toMatch(/^\w{8}$/);
		expect(update).toHaveBeenCalledTimes(1);
	});

	it('is left alone for an anonymous visitor', async () => {
		const solve = await queryActions.solve(null, {id: 'solve-1'}, {user: null});
		expect(solve.share_code).toBeNull();
		expect(update).not.toHaveBeenCalled();
	});

	it('is left alone for another signed-in user', async () => {
		const solve = await queryActions.solve(null, {id: 'solve-1'}, {user: {id: 'someone-else'}});
		expect(solve.share_code).toBeNull();
		expect(update).not.toHaveBeenCalled();
	});
});
