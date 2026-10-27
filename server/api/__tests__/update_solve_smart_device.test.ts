// The legacy updateSolve (server/api/solve.js) writes smart_device_id too: an edit that
// carries the BLE identifier a cube connected offline records, or another account's device,
// must be corrected the same way createSolve corrects it, never fail on the foreign key.

const getBasicSolve = jest.fn();
const updateSolveModel = jest.fn();

jest.mock('../../models/solve', () => ({
	getBasicSolve: (...a: any[]) => getBasicSolve(...a),
	updateSolve: (...a: any[]) => updateSolveModel(...a),
}));
jest.mock('../../util/auth', () => ({
	checkLoggedIn: (user: any) => {
		if (!user) throw new Error('not logged in');
	},
}));
jest.mock('../../models/top_solve', () => ({}));
jest.mock('../../models/solve_method_step', () => ({deleteSolveMethodSteps: jest.fn()}));
jest.mock('../../models/solve_view', () => ({}));
jest.mock('../../services/rate_limit', () => ({checkRateLimit: jest.fn(async () => ({allowed: true}))}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

const smartDeviceFindMany = jest.fn();
jest.mock('../../database', () => ({
	getPrisma: () => ({
		session: {findFirst: jest.fn(async () => ({id: 'session-1'}))},
		smartDevice: {findMany: (...a: any[]) => smartDeviceFindMany(...a)},
	}),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {mutateActions} = require('../solve');

const ME = {id: 'user-me'};
const STORED = {
	id: 's-1',
	user_id: 'user-me',
	session_id: 'session-1',
	time: 10,
	raw_time: 10,
	bulk: false,
	from_timer: true,
	smart_device_id: 'row-gan',
};

beforeEach(() => {
	getBasicSolve.mockReset();
	updateSolveModel.mockReset();
	smartDeviceFindMany.mockReset();
	getBasicSolve.mockResolvedValue({...STORED});
	updateSolveModel.mockImplementation(async (id: string, data: any) => ({...data, id}));
	smartDeviceFindMany.mockImplementation(async (args: any) => {
		const {user_id, OR} = args.where;
		const devices = [
			{id: 'row-gan', device_id: 'AA:BB:CC:DD:EE:01', created_at: new Date('2025-01-01'), user_id: 'user-me'},
			{id: 'row-foreign', device_id: 'CC:CC:CC:CC:CC:CC', created_at: new Date('2025-01-01'), user_id: 'user-other'},
		];
		return devices
			.filter((d) => d.user_id === user_id && (OR[0].id.in.includes(d.id) || OR[1].device_id.in.includes(d.device_id)))
			.map(({id, device_id, created_at}) => ({id, device_id, created_at}));
	});
});

describe('legacy updateSolve: smart_device_id', () => {
	it('maps a BLE identifier to the caller device row', async () => {
		await mutateActions.updateSolve(null, {id: 's-1', input: {smart_device_id: 'AA:BB:CC:DD:EE:01'}}, {user: ME});
		expect(updateSolveModel.mock.calls[0][1].smart_device_id).toBe('row-gan');
	});

	it("clears another account's device", async () => {
		await mutateActions.updateSolve(null, {id: 's-1', input: {smart_device_id: 'row-foreign'}}, {user: ME});
		expect(updateSolveModel.mock.calls[0][1].smart_device_id).toBeNull();
	});

	it('leaves the stored link alone when the edit does not carry one (a +2 toggle)', async () => {
		await mutateActions.updateSolve(null, {id: 's-1', input: {plus_two: true, time: 12}}, {user: ME});
		expect(updateSolveModel.mock.calls[0][1].smart_device_id).toBe('row-gan');
		expect(smartDeviceFindMany).not.toHaveBeenCalled();
	});
});
