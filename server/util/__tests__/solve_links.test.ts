// Cube links on the solve write paths (server/util/solve_links.ts, design magnet-cubes.md 3.3).
// solve.cube_id has no foreign key, so these rules are the only thing keeping it honest:
// unknown, foreign and wrong-puzzle ids are stored as null, never refused, and an older app's
// smart_device_id is turned into the cube that device was migrated into.

const warn = jest.fn();
jest.mock('../../services/logger', () => ({
	logger: {warn: (...a: any[]) => warn(...a), info: jest.fn(), error: jest.fn()},
}));

import {applyCubeLinks, OwnedCube, requestedCubeLookups, resolveOwnedLinks, SolveLinkRow} from '../solve_links';

const ME = 'user-me';

const MY_CUBES: OwnedCube[] = [
	{id: 'cube-gan', puzzle: '333', legacy_smart_device_ids: ['sd-gan', 'sd-gan-dup']},
	{id: 'cube-moyu', puzzle: '333', legacy_smart_device_ids: []},
	{id: 'cube-2x2', puzzle: '222', legacy_smart_device_ids: []},
	{id: 'cube-custom', puzzle: 'custom-type-uuid', legacy_smart_device_ids: []},
	// Created by the legacy addNewSmartDevice: its id is the device row id.
	{id: 'sd-legacy', puzzle: '333', legacy_smart_device_ids: ['sd-legacy']},
];

function row(id: string, fields: Partial<SolveLinkRow>): SolveLinkRow {
	return {id, cube_type: '333', ...fields};
}

beforeEach(() => warn.mockClear());

describe('applyCubeLinks', () => {
	it('keeps a link to one of my cubes of the same puzzle', () => {
		const r = row('s1', {cube_id: 'cube-gan'});
		const report = applyCubeLinks([r], MY_CUBES);
		expect(r.cube_id).toBe('cube-gan');
		expect(report.cleared).toEqual([]);
	});

	it('counts every bucket of the puzzle: wca 333, CFOP PLL subset, Roux', () => {
		const rows = [
			row('a', {cube_id: 'cube-gan', cube_type: 'wca', scramble_subset: '333'}),
			row('b', {cube_id: 'cube-gan', cube_type: '333cfop', scramble_subset: 'pll'}),
			row('c', {cube_id: 'cube-gan', cube_type: '333roux'}),
			row('d', {cube_id: 'cube-2x2', cube_type: 'wca', scramble_subset: '222'}),
			row('e', {cube_id: 'cube-custom', cube_type: 'custom-type-uuid'}),
		];
		applyCubeLinks(rows, MY_CUBES);
		expect(rows.map((r) => r.cube_id)).toEqual(['cube-gan', 'cube-gan', 'cube-gan', 'cube-2x2', 'cube-custom']);
	});

	it('clears an unknown id (a cube deleted while the solve sat in the offline queue)', () => {
		const r = row('s1', {cube_id: 'cube-gone'});
		const report = applyCubeLinks([r], MY_CUBES);
		expect(r.cube_id).toBeNull();
		expect(report.cleared).toEqual(['s1']);
	});

	it("clears another account's cube: `owned` holds only the caller's", () => {
		const r = row('s1', {cube_id: 'cube-of-someone-else'});
		applyCubeLinks([r], MY_CUBES);
		expect(r.cube_id).toBeNull();
	});

	it('clears a cube of another puzzle: a 3x3 cube is not linked to a 7x7 solve', () => {
		const rows = [
			row('a', {cube_id: 'cube-gan', cube_type: '777'}),
			row('b', {cube_id: 'cube-2x2', cube_type: 'wca', scramble_subset: '333'}),
			row('c', {cube_id: 'cube-gan', cube_type: 'other'}),
			row('d', {cube_id: 'cube-gan', cube_type: 'wca', scramble_subset: null}),
		];
		const report = applyCubeLinks(rows, MY_CUBES);
		expect(rows.map((r) => r.cube_id)).toEqual([null, null, null, null]);
		expect(report.cleared).toEqual(['a', 'b', 'c', 'd']);
	});

	it('never links a trainer drill (K-3)', () => {
		const r = row('t1', {cube_id: 'cube-gan', trainer_name: 'PLL'});
		applyCubeLinks([r], MY_CUBES);
		expect(r.cube_id).toBeNull();
	});

	it('stores an empty string as no link', () => {
		const r = row('s1', {cube_id: ''});
		applyCubeLinks([r], MY_CUBES);
		expect(r.cube_id).toBeNull();
	});

	it('leaves a row without the field alone (an update that does not touch it)', () => {
		const r = row('s1', {});
		applyCubeLinks([r], MY_CUBES);
		expect('cube_id' in r).toBe(false);
	});

	describe("an older app's smart_device_id", () => {
		it('becomes the cube that listed the device row among its migrated rows', () => {
			const rows = [row('a', {smart_device_id: 'sd-gan'}), row('b', {smart_device_id: 'sd-gan-dup'})];
			const report = applyCubeLinks(rows, MY_CUBES);
			expect(rows.map((r) => r.cube_id)).toEqual(['cube-gan', 'cube-gan']);
			expect(report.derived).toEqual(['a', 'b']);
		});

		it('becomes the cube whose id is the device row id', () => {
			const r = row('a', {smart_device_id: 'sd-legacy', cube_id: null});
			applyCubeLinks([r], MY_CUBES);
			expect(r.cube_id).toBe('sd-legacy');
		});

		it('follows the puzzle rule too', () => {
			const r = row('a', {smart_device_id: 'sd-gan', cube_type: '444'});
			applyCubeLinks([r], MY_CUBES);
			expect(r.cube_id).toBeUndefined();
		});

		it('never overrides a cube the solve names itself', () => {
			const r = row('a', {smart_device_id: 'sd-gan', cube_id: 'cube-moyu'});
			applyCubeLinks([r], MY_CUBES);
			expect(r.cube_id).toBe('cube-moyu');
		});

		it('is not used when derivation is off (an update that explicitly unlinks)', () => {
			const r = row('a', {smart_device_id: 'sd-gan', cube_id: null});
			applyCubeLinks([r], MY_CUBES, {deriveFromSmartDevice: false});
			expect(r.cube_id).toBeNull();
		});

		it('leaves the solve unlinked when no cube carries the device', () => {
			const r = row('a', {smart_device_id: 'sd-unknown'});
			applyCubeLinks([r], MY_CUBES);
			expect(r.cube_id).toBeUndefined();
		});
	});
});

describe('requestedCubeLookups', () => {
	it('asks for distinct cube ids, and device ids only where a cube is missing', () => {
		const rows = [
			row('a', {cube_id: 'cube-gan'}),
			row('b', {cube_id: 'cube-gan', smart_device_id: 'sd-1'}),
			row('c', {smart_device_id: 'sd-2'}),
			row('d', {smart_device_id: 'sd-2'}),
			row('e', {cube_id: 'cube-x', trainer_name: 'OLL'}),
			row('f', {cube_id: ''}),
		];
		expect(requestedCubeLookups(rows)).toEqual({cubeIds: ['cube-gan'], smartDeviceIds: ['sd-2']});
		expect(requestedCubeLookups(rows, {deriveFromSmartDevice: false}).smartDeviceIds).toEqual([]);
	});
});

describe('resolveOwnedLinks', () => {
	function makePrisma(cubes: (OwnedCube & {user_id: string})[], smartDevices: {id: string; device_id: string; user_id: string}[]) {
		const cubeFindMany = jest.fn(async (args: any) => {
			const {user_id, OR} = args.where;
			const ids: string[] = OR[0].id.in;
			const legacy: string[] = OR[1]?.legacy_smart_device_ids?.hasSome || [];
			return cubes
				.filter((c) => c.user_id === user_id)
				.filter((c) => ids.includes(c.id) || (c.legacy_smart_device_ids || []).some((l) => legacy.includes(l)))
				.map(({id, puzzle, legacy_smart_device_ids}) => ({id, puzzle, legacy_smart_device_ids}));
		});
		const smartDeviceFindMany = jest.fn(async (args: any) => {
			const {user_id, OR} = args.where;
			const ids: string[] = OR[0].id.in;
			const bleIds: string[] = OR[1].device_id.in;
			return smartDevices
				.filter((d) => d.user_id === user_id && (ids.includes(d.id) || bleIds.includes(d.device_id)))
				.map(({id, device_id}) => ({id, device_id, created_at: new Date('2025-01-01')}));
		});
		return {prisma: {cube: {findMany: cubeFindMany}, smartDevice: {findMany: smartDeviceFindMany}} as any, cubeFindMany};
	}

	const CUBES = [
		{id: 'cube-gan', puzzle: '333', legacy_smart_device_ids: ['sd-gan'], user_id: ME},
		{id: 'cube-other', puzzle: '333', legacy_smart_device_ids: ['sd-other'], user_id: 'user-other'},
	];
	const DEVICES = [
		{id: 'sd-gan', device_id: 'AA:BB', user_id: ME},
		{id: 'sd-other', device_id: 'CC:DD', user_id: 'user-other'},
	];

	it('turns an old offline smart solve (BLE id) into a device row and then into its cube', async () => {
		const {prisma, cubeFindMany} = makePrisma(CUBES, DEVICES);
		const rows = [row('a', {smart_device_id: 'AA:BB'}), row('b', {cube_id: 'cube-other'}), row('c', {cube_id: 'cube-gan'})];

		await resolveOwnedLinks(prisma, ME, rows, 'bulkCreateSolves');

		expect(rows[0]).toMatchObject({smart_device_id: 'sd-gan', cube_id: 'cube-gan'});
		expect(rows[1].cube_id).toBeNull();
		expect(rows[2].cube_id).toBe('cube-gan');
		// One cube query for the whole batch.
		expect(cubeFindMany).toHaveBeenCalledTimes(1);
		const repaired = warn.mock.calls.filter(([m]) => m === 'Solve cube link repaired');
		expect(repaired).toHaveLength(1);
		expect(repaired[0][1]).toMatchObject({userId: ME, source: 'bulkCreateSolves', clearedCount: 1, solveIds: ['b']});
	});

	it("does not hand out another account's cube through its device row", async () => {
		const {prisma} = makePrisma(CUBES, DEVICES);
		const r = row('a', {smart_device_id: 'sd-other'});
		await resolveOwnedLinks(prisma, ME, [r], 'createSolve');
		expect(r.smart_device_id).toBeNull();
		expect(r.cube_id).toBeUndefined();
	});

	it('asks nothing of the database for a plain timer solve', async () => {
		const {prisma, cubeFindMany} = makePrisma(CUBES, DEVICES);
		await resolveOwnedLinks(prisma, ME, [row('a', {})], 'createSolve');
		expect(cubeFindMany).not.toHaveBeenCalled();
		expect(prisma.smartDevice.findMany).not.toHaveBeenCalled();
	});

	it('stores the solve without a cube when the cube lookup fails, instead of failing it', async () => {
		const prisma: any = {
			smartDevice: {findMany: jest.fn(async () => [])},
			cube: {findMany: jest.fn(async () => { throw new Error('relation "cube" does not exist'); })},
		};
		const r = row('a', {cube_id: 'cube-gan'});
		await expect(resolveOwnedLinks(prisma, ME, [r], 'createSolve')).resolves.toBeDefined();
		expect(r.cube_id).toBeNull();
	});
});
