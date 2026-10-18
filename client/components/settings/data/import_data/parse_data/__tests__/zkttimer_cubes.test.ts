jest.mock('../../../../../../db/sessions/query', () => ({ fetchSessions: () => [] }));

import {
	ExportedCube,
	exportCubeList,
	linkSolvesToCubes,
	planCubeImport,
	readExportedCubes,
} from '../zkttimer_cubes';
import { parseZktTimerData } from '../zkttimer';

const wca = (subset: string) => ({ cube_type: 'wca', scramble_subset: subset });

function fileCube(id: string, puzzle: string, name: string, extra: Partial<ExportedCube> = {}): ExportedCube {
	return { id, puzzle, name, brand: null, is_smart: false, ...extra };
}

function target(id: string, puzzle: string, name: string, archived = false) {
	return { id, puzzle, name, brand: null, is_smart: false, archived_at: archived ? 1 : null };
}

describe('exportCubeList', () => {
	it('writes the design fields and marks archived cubes', () => {
		const out = exportCubeList([
			{ ...target('a', '333', 'RS3M'), brand: 'MoYu', is_smart: false },
			{ ...target('b', '222', 'Old', true), brand: '' },
		]);
		expect(out).toEqual([
			{ id: 'a', puzzle: '333', name: 'RS3M', brand: 'MoYu', is_smart: false },
			{ id: 'b', puzzle: '222', name: 'Old', brand: null, is_smart: false, archived: true },
		]);
	});
});

describe('readExportedCubes', () => {
	it('returns nothing for a missing or malformed list', () => {
		expect(readExportedCubes(undefined)).toEqual([]);
		expect(readExportedCubes('cubes')).toEqual([]);
		expect(readExportedCubes({})).toEqual([]);
	});

	it('drops malformed rows, duplicate ids, and bounds the text', () => {
		const long = 'x'.repeat(60);
		const out = readExportedCubes([
			null,
			{ id: '', puzzle: '333', name: 'No id' },
			{ id: 'a', puzzle: '333', name: '   ' },
			{ id: 'b', puzzle: '333', name: '  Gan   12  ', brand: long, is_smart: 'yes', archived: true },
			{ id: 'b', puzzle: '222', name: 'Twin' },
			{ id: 'c', puzzle: '', name: 'No puzzle' },
			{ id: 'd', puzzle: '444', name: long, is_smart: true },
		]);
		expect(out).toEqual([
			{ id: 'b', puzzle: '333', name: 'Gan 12', brand: 'x'.repeat(30), is_smart: false, archived: true },
			{ id: 'd', puzzle: '444', name: 'x'.repeat(40), brand: null, is_smart: true },
		]);
	});
});

describe('planCubeImport', () => {
	it('reuses a cube with the same id (backup restored to its own account, renamed since)', () => {
		const plan = planCubeImport([fileCube('a', '333', 'Old name')], [], [target('a', '333', 'New name')]);
		expect(plan.matched).toEqual({ a: 'a' });
		expect(plan.toCreate).toEqual([]);
	});

	it('matches by puzzle and name, ignoring case and spacing, active cubes first', () => {
		const plan = planCubeImport(
			[fileCube('f1', '333', '  rs3m  2020 ')],
			[],
			[target('archived', '333', 'RS3M 2020', true), target('active', '333', 'RS3M 2020')]
		);
		expect(plan.matched).toEqual({ f1: 'active' });
	});

	it('does not match a cube of another puzzle with the same name', () => {
		const plan = planCubeImport([fileCube('f1', '222', 'Main')], [], [target('t', '333', 'Main')]);
		expect(plan.matched).toEqual({});
		expect(plan.toCreate).toHaveLength(1);
		expect(plan.toCreate[0]).toMatchObject({ puzzle: '222', name: 'Main', archive: false, fileIds: ['f1'] });
	});

	it('creates one cube for two file cubes with the same puzzle and name', () => {
		const plan = planCubeImport([fileCube('f1', '333', 'Gan'), fileCube('f2', '333', 'GAN')], [], []);
		expect(plan.toCreate).toHaveLength(1);
		expect(plan.toCreate[0].fileIds).toEqual(['f1', 'f2']);
	});

	it('skips a puzzle this account does not have', () => {
		const custom = 'custom-uuid';
		const without = planCubeImport([fileCube('f1', custom, 'Mirror')], [], []);
		expect(without.toCreate).toEqual([]);
		expect(without.skipped).toBe(1);
		const withType = planCubeImport([fileCube('f1', custom, 'Mirror')], [], [], new Set([custom]));
		expect(withType.toCreate).toHaveLength(1);
	});

	it('brings back an archived cube only when a solve of its puzzle uses it, then archives it', () => {
		const cubes = [fileCube('used', '333', 'Used', { archived: true }), fileCube('idle', '333', 'Idle', { archived: true })];
		const solves = [
			{ ...wca('333'), cube_id: 'used' },
			// Wrong puzzle and trainer solves do not count as use.
			{ ...wca('222'), cube_id: 'idle' },
			{ ...wca('333'), cube_id: 'idle', trainer_name: 'PLL' },
		];
		const plan = planCubeImport(cubes, solves, []);
		expect(plan.toCreate.map((c) => [c.name, c.archive])).toEqual([['Used', true]]);
		expect(plan.skipped).toBe(1);
	});

	it('keeps a merged cube active when one of its file twins is active', () => {
		const plan = planCubeImport(
			[fileCube('f1', '333', 'Gan', { archived: true }), fileCube('f2', '333', 'Gan')],
			[{ ...wca('333'), cube_id: 'f1' }],
			[]
		);
		expect(plan.toCreate).toHaveLength(1);
		expect(plan.toCreate[0].archive).toBe(false);
	});

	it('does nothing without file cubes', () => {
		expect(planCubeImport([], [{ ...wca('333'), cube_id: 'x' }], [target('x', '333', 'A')])).toEqual({
			matched: {},
			toCreate: [],
			skipped: 0,
		});
	});
});

describe('linkSolvesToCubes', () => {
	const idMap = { f333: { id: 't333', puzzle: '333' }, f222: { id: 't222', puzzle: '222' } };

	it('replaces file ids with the target ids when the puzzle fits', () => {
		const solves = [
			{ ...wca('333'), cube_id: 'f333' },
			{ cube_type: '333cfop', scramble_subset: 'pll', cube_id: 'f333' },
			{ ...wca('222'), cube_id: 'f222' },
		];
		expect(linkSolvesToCubes(solves, idMap).map((s) => s.cube_id)).toEqual(['t333', 't333', 't222']);
	});

	it('nulls unmapped ids, wrong puzzles, trainer solves and solves without a puzzle', () => {
		const solves: { cube_type: string; scramble_subset: string | null; cube_id?: string; trainer_name?: string }[] = [
			{ ...wca('333'), cube_id: 'unknown' },
			{ ...wca('444'), cube_id: 'f333' },
			{ ...wca('333'), cube_id: 'f333', trainer_name: 'OLL' },
			{ cube_type: 'other', scramble_subset: null, cube_id: 'f333' },
			{ ...wca('333') },
		];
		expect(linkSolvesToCubes(solves, idMap).map((s) => s.cube_id)).toEqual([null, null, null, null, null]);
	});

	it('leaves the input list untouched', () => {
		const solves = [{ ...wca('333'), cube_id: 'f333' }];
		const out = linkSolvesToCubes(solves, idMap);
		expect(solves[0].cube_id).toBe('f333');
		expect(out[0]).not.toBe(solves[0]);
	});
});

describe('parseZktTimerData with cubes', () => {
	const context = {} as any;

	function file(extra: Record<string, unknown> = {}) {
		return JSON.stringify({
			sessions: [{ id: 's1', name: 'Main', order: 0 }],
			solves: [
				{ session_id: 's1', time: 9.1, cube_type: 'wca', scramble_subset: '333', cube_id: 'c1', smart_device_id: 'x' },
				{ session_id: 's1', time: 9.2, cube_type: 'wca', scramble_subset: '333', cube_id: 'stray' },
				{ session_id: 's1', time: 9.3, cube_type: 'wca', scramble_subset: '333', cube_id: null },
			],
			...extra,
		});
	}

	it('reads the cube list and keeps only cube ids the file describes', () => {
		const data = parseZktTimerData(file({ cubes: [{ id: 'c1', puzzle: '333', name: 'RS3M', brand: null, is_smart: false }] }), context);
		expect(data.fileCubes).toEqual([{ id: 'c1', puzzle: '333', name: 'RS3M', brand: null, is_smart: false }]);
		expect(data.solves.map((s) => s.cube_id)).toEqual(['c1', undefined, undefined]);
		expect(data.solves.every((s) => !('smart_device_id' in s))).toBe(true);
	});

	it('drops every cube id from a file without cubes', () => {
		const data = parseZktTimerData(file(), context);
		expect(data.fileCubes).toBeUndefined();
		expect(data.solves.every((s) => !('cube_id' in s))).toBe(true);
	});
});
