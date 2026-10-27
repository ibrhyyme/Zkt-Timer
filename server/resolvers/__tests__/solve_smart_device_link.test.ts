import 'reflect-metadata';

// The write paths of Solve.resolver against a stand-in database that enforces the one rule
// this suite is about: solve.smart_device_id must name an existing smart_device row
// (solve_smart_device_id_fkey). Postgres checks existence only, not the owner; ownership is
// the resolver's job.

const createSolveModel = jest.fn();
const bulkCreateSolvesModel = jest.fn();
const warn = jest.fn();

jest.mock('../../models/solve', () => ({
	createSolve: (...a: any[]) => createSolveModel(...a),
	bulkCreateSolves: (...a: any[]) => bulkCreateSolvesModel(...a),
	updateSolve: jest.fn(async () => undefined),
}));
jest.mock('../../models/solve_method_step', () => ({
	createSolveMethodSteps: jest.fn(async () => []),
	replaceSolveMethodSteps: jest.fn(async () => undefined),
}));
jest.mock('../../models/user_account', () => ({updateUserAccountWithParams: jest.fn(async () => undefined)}));
jest.mock('../../services/logger', () => ({
	logger: {warn: (...a: any[]) => warn(...a), info: jest.fn(), error: jest.fn()},
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {SolveResolver} = require('../Solve.resolver');

const ME = 'user-me';
const SESSION = 'session-1';

// Registered while online: `device_id` is what the app sent as the BLE identifier.
const SMART_DEVICES = [
	{id: 'row-gan', device_id: 'AA:BB:CC:DD:EE:01', created_at: new Date('2025-01-01'), user_id: ME},
	{id: 'row-foreign', device_id: 'CC:CC:CC:CC:CC:CC', created_at: new Date('2025-01-01'), user_id: 'user-other'},
];
const EXISTING_ROW_IDS = new Set(SMART_DEVICES.map((d) => d.id));

function fkViolation() {
	const error: any = new Error(
		'Invalid `prisma.solve.create()` invocation: Foreign key constraint failed on the field: `solve_smart_device_id_fkey (index)`'
	);
	error.code = 'P2003';
	return error;
}

function violatesFk(row: any): boolean {
	return row.smart_device_id !== undefined && row.smart_device_id !== null && !EXISTING_ROW_IDS.has(row.smart_device_id);
}

function makeContext() {
	const smartDeviceFindMany = jest.fn(async (args: any) => {
		const {user_id, OR} = args.where;
		const ids: string[] = OR[0].id.in;
		const bleIds: string[] = OR[1].device_id.in;
		return SMART_DEVICES.filter(
			(d) => d.user_id === user_id && (ids.includes(d.id) || bleIds.includes(d.device_id))
		).map(({id, device_id, created_at}) => ({id, device_id, created_at}));
	});

	const prisma = {
		session: {
			findFirst: jest.fn(async () => ({id: SESSION})),
			findMany: jest.fn(async () => [{id: SESSION}]),
		},
		smartDevice: {findMany: smartDeviceFindMany},
		// No cubes: the cube pass (server/util/solve_links.ts) finds nothing to link.
		cube: {findMany: jest.fn(async () => [])},
		solve: {
			findFirst: jest.fn(async () => null),
			findMany: jest.fn(async (args: any) => args.where.id.in.map((id: string) => ({id}))),
		},
	};

	return {context: {user: {id: ME}, prisma} as any, smartDeviceFindMany};
}

function solveInput(id: string, smartDeviceId?: string | null): any {
	const input: any = {
		id,
		time: 12.34,
		raw_time: 12.34,
		cube_type: '333',
		scramble: "R U R' U'",
		session_id: SESSION,
		started_at: 1_700_000_000_000,
		ended_at: 1_700_000_012_340,
		dnf: false,
		plus_two: false,
		from_timer: true,
		is_smart_cube: true,
	};
	if (smartDeviceId !== undefined) input.smart_device_id = smartDeviceId;
	return input;
}

beforeEach(() => {
	warn.mockClear();
	createSolveModel.mockReset();
	bulkCreateSolvesModel.mockReset();
	// Stand-ins for prisma.solve.create / createMany with the foreign key enforced. createMany
	// is one INSERT, so a single bad row fails the whole batch, as it does in Postgres.
	createSolveModel.mockImplementation(async (_user: any, input: any) => {
		if (violatesFk(input)) throw fkViolation();
		return {...input};
	});
	bulkCreateSolvesModel.mockImplementation(async (_user: any, rows: any[]) => {
		if (rows.some(violatesFk)) throw fkViolation();
		return {count: rows.length};
	});
});

describe('createSolve: smart_device_id', () => {
	it('stores a solve timed with a cube connected offline, linked to the device row (E-a)', async () => {
		const {context} = makeContext();
		// What the app records when the device lookup could not run: the BLE identifier.
		const created = await new SolveResolver().createSolve(context, solveInput('s-offline', 'AA:BB:CC:DD:EE:01'));

		expect(created.smart_device_id).toBe('row-gan');
		expect(createSolveModel.mock.calls[0][1].smart_device_id).toBe('row-gan');
	});

	it('stores a solve of a cube never registered online, without a link, instead of failing for ever', async () => {
		const {context} = makeContext();
		const created = await new SolveResolver().createSolve(context, solveInput('s-new-cube', '11:22:33:44:55:66'));

		expect(created.smart_device_id).toBeNull();
	});

	it("does not hang a solve on another account's device (E-b)", async () => {
		const {context} = makeContext();
		// The foreign key alone would accept this: the row exists, it just is not the caller's.
		const created = await new SolveResolver().createSolve(context, solveInput('s-foreign', 'row-foreign'));

		expect(created.smart_device_id).toBeNull();
	});

	it("does not resolve another account's BLE identifier either", async () => {
		const {context} = makeContext();
		const created = await new SolveResolver().createSolve(context, solveInput('s-foreign-ble', 'CC:CC:CC:CC:CC:CC'));

		expect(created.smart_device_id).toBeNull();
	});

	it('clears the empty value a disconnected cube leaves in the store', async () => {
		const {context, smartDeviceFindMany} = makeContext();
		const created = await new SolveResolver().createSolve(context, solveInput('s-empty', ''));

		expect(created.smart_device_id).toBeNull();
		expect(smartDeviceFindMany).not.toHaveBeenCalled();
	});

	it('keeps a correct link and stays quiet about it', async () => {
		const {context} = makeContext();
		const created = await new SolveResolver().createSolve(context, solveInput('s-online', 'row-gan'));

		expect(created.smart_device_id).toBe('row-gan');
		expect(warn).not.toHaveBeenCalled();
	});

	it('costs no lookup for a solve without a device', async () => {
		const {context, smartDeviceFindMany} = makeContext();
		const created = await new SolveResolver().createSolve(context, solveInput('s-keyboard'));

		expect(created.smart_device_id).toBeUndefined();
		expect(smartDeviceFindMany).not.toHaveBeenCalled();
	});
});

describe('bulkCreateSolves: smart_device_id', () => {
	function chunkWithOneOfflineSolve(): any[] {
		// A launch backfill chunk as the app sends it: 100 rows, most of them plain timer solves,
		// a few smart solves linked correctly, and one timed while the cube had connected offline.
		const rows: any[] = [];
		for (let i = 0; i < 100; i++) {
			rows.push(solveInput(`s-${i}`, i % 10 === 0 ? 'row-gan' : undefined));
		}
		rows[57] = solveInput('s-57', 'AA:BB:CC:DD:EE:01');
		rows[58] = solveInput('s-58', 'unknown-cube');
		rows[59] = solveInput('s-59', 'row-foreign');
		rows[60] = solveInput('s-60', '');
		return rows;
	}

	it('the stand-in database really refuses such a chunk as sent (the bug this guards)', async () => {
		await expect(bulkCreateSolvesModel({id: ME}, chunkWithOneOfflineSolve())).rejects.toMatchObject({code: 'P2003'});
	});

	it('stores every row of the chunk, with the bad links corrected', async () => {
		const {context, smartDeviceFindMany} = makeContext();

		await new SolveResolver().bulkCreateSolves(context, chunkWithOneOfflineSolve());

		expect(bulkCreateSolvesModel).toHaveBeenCalledTimes(1);
		const stored: any[] = bulkCreateSolvesModel.mock.calls[0][1];
		expect(stored).toHaveLength(100);
		expect(stored.find((r) => r.id === 's-57').smart_device_id).toBe('row-gan');
		expect(stored.find((r) => r.id === 's-58').smart_device_id).toBeNull();
		expect(stored.find((r) => r.id === 's-59').smart_device_id).toBeNull();
		expect(stored.find((r) => r.id === 's-60').smart_device_id).toBeNull();
		expect(stored.find((r) => r.id === 's-10').smart_device_id).toBe('row-gan');
		expect(stored.find((r) => r.id === 's-11').smart_device_id).toBeUndefined();
		// One lookup for the whole batch, never one per row.
		expect(smartDeviceFindMany).toHaveBeenCalledTimes(1);
	});

	it('reports the repair once per request, by solve id', async () => {
		const {context} = makeContext();

		await new SolveResolver().bulkCreateSolves(context, chunkWithOneOfflineSolve());

		const repaired = warn.mock.calls.filter(([message]) => message === 'Solve smart device link repaired');
		expect(repaired).toHaveLength(1);
		expect(repaired[0][1]).toMatchObject({
			userId: ME,
			source: 'bulkCreateSolves',
			relinkedCount: 1,
			clearedCount: 3,
			solveIds: ['s-57', 's-58', 's-59', 's-60'],
		});
	});
});
