import 'reflect-metadata';

// E-d (design magnet-cubes.md 1.7): the three sync reads answer with a Prisma `select`, which
// returns only what it names, and GraphQL answers a nullable field it did not get with null.
// smart_device_id once went missing from all three; cube_id must not. Every sync read is run
// here against a stand-in database and its select is checked.

jest.mock('../../models/solve', () => ({
	createSolve: jest.fn(),
	bulkCreateSolves: jest.fn(),
	updateSolve: jest.fn(),
}));
jest.mock('../../models/solve_method_step', () => ({
	createSolveMethodSteps: jest.fn(),
	replaceSolveMethodSteps: jest.fn(),
}));
jest.mock('../../models/user_account', () => ({updateUserAccountWithParams: jest.fn()}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {SolveResolver} = require('../Solve.resolver');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {SYNC_SOLVE_SCALARS} = require('../../util/solve/sync_select');

function makeContext(user: any = {id: 'user-me', is_pro: true}) {
	const findMany = jest.fn(async (_args: any): Promise<any[]> => []);
	return {context: {user, prisma: {solve: {findMany}}} as any, findMany};
}

describe('sync reads select cube_id', () => {
	it('the shared select names it', () => {
		expect(SYNC_SOLVE_SCALARS.cube_id).toBe(true);
	});

	it('solves (Pro cross-device sync)', async () => {
		const {context, findMany} = makeContext();
		await new SolveResolver().solves(context, 100, 0);
		expect(findMany.mock.calls[0][0].select.cube_id).toBe(true);
	});

	it('recoverMySolves (Basic restore), with and without the Pro step breakdown', async () => {
		for (const user of [{id: 'user-me', is_pro: true}, {id: 'user-me', is_pro: false}]) {
			const {context, findMany} = makeContext(user);
			await new SolveResolver().recoverMySolves(context, 100, 0);
			expect(findMany.mock.calls[0][0].select.cube_id).toBe(true);
		}
	});

	it('solvesByIds (delta fetch)', async () => {
		const {context, findMany} = makeContext();
		await new SolveResolver().solvesByIds(context, ['s-1']);
		expect(findMany.mock.calls[0][0].select.cube_id).toBe(true);
	});

	it('still carries the smart device link next to it', async () => {
		const {context, findMany} = makeContext();
		await new SolveResolver().solvesByIds(context, ['s-1']);
		expect(findMany.mock.calls[0][0].select.smart_device_id).toBe(true);
	});
});
