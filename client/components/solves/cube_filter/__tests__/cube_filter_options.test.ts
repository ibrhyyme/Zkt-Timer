/**
 * Cube filter rules of the Solves and Stats pages (design magnet-cubes 8.2).
 */

import { LocalCube, CubeState } from '../../../../lib/cubes/active_cube';
import {
	countCubeFilterChoices,
	cubeFilterGroups,
	CubeFilterGroupOptions,
	cubeFitsPuzzle,
	resolveCubeFilter,
	searchCubeFilterGroups,
} from '../cube_filter_options';

function cube(id: string, extra: Partial<LocalCube> = {}): LocalCube {
	return {
		id,
		puzzle: '333',
		name: id,
		brand: null,
		is_smart: false,
		ble_device_id: null,
		ble_name: null,
		legacy_smart_device_ids: [],
		archived_at: null,
		created_at: 1,
		updated_at: 1,
		solve_count: 0,
		first_used_at: null,
		last_used_at: null,
		calibrations: [],
		...extra,
	};
}

const state: Pick<CubeState, 'cubes' | 'mains'> = {
	cubes: [
		cube('gan12', { name: 'GAN 12 UI', brand: 'GAN', last_used_at: 100 }),
		cube('rs3m', { name: 'MoYu RS3M', brand: 'MoYu', last_used_at: 300 }),
		cube('gan13', { name: 'GAN 13', brand: 'GAN', last_used_at: 200 }),
		cube('old333', { name: 'Old 3x3', archived_at: 50 }),
		cube('dusty333', { name: 'Dusty 3x3', archived_at: 60 }),
		cube('tengyun', { name: 'Tengyun', puzzle: '222', last_used_at: 10 }),
		cube('mgc7', { name: 'MGC 7', puzzle: '777' }),
	],
	mains: { '333': { cube_id: 'gan12', set_at: 1 } },
};

const LABELS: Record<string, string> = { '333': '3x3x3', '222': '2x2x2', '777': '7x7x7' };
const ORDER = ['333', '222', '444', '555', '666', '777'];

function options(extra: Partial<CubeFilterGroupOptions> = {}): CubeFilterGroupOptions {
	return {
		puzzle: '333',
		allMode: false,
		hasLocalSolves: (id) => id === 'old333',
		puzzleLabel: (key) => LABELS[key] || key,
		orderPuzzles: (keys) => [...keys].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)),
		archivedHeader: (n) => `Archive (${n})`,
		...extra,
	};
}

const ids = (groups: ReturnType<typeof cubeFilterGroups>) => groups.map((g) => [g.key, g.choices.map((c) => c.id)]);

describe('cubeFilterGroups', () => {
	it('offers only the cubes of the selected type puzzle, main first then last used', () => {
		const groups = cubeFilterGroups(state, options());
		expect(ids(groups)).toEqual([
			['333', ['gan12', 'rs3m', 'gan13']],
			['archived', ['old333']],
		]);
		expect(groups[0].header).toBeNull();
		expect(groups[0].choices[0].isMain).toBe(true);
		expect(groups[0].choices[1].isMain).toBe(false);
	});

	it('never offers a 3x3 cube under 7x7', () => {
		expect(ids(cubeFilterGroups(state, options({ puzzle: '777' })))).toEqual([['777', ['mgc7']]]);
	});

	it('offers nothing for a bucket without a physical puzzle', () => {
		expect(cubeFilterGroups(state, options({ puzzle: null }))).toEqual([]);
	});

	it('groups every puzzle under its header in "all" mode, archive last', () => {
		const groups = cubeFilterGroups(state, options({ puzzle: null, allMode: true }));
		expect(ids(groups)).toEqual([
			['333', ['gan12', 'rs3m', 'gan13']],
			['222', ['tengyun']],
			['777', ['mgc7']],
			['archived', ['old333']],
		]);
		expect(groups.map((g) => g.header)).toEqual(['3x3x3', '2x2x2', '7x7x7', 'Archive (1)']);
		expect(groups[3].archived).toBe(true);
	});

	it('leaves out archived cubes without solves on this device', () => {
		const groups = cubeFilterGroups(state, options({ hasLocalSolves: () => false }));
		expect(ids(groups)).toEqual([['333', ['gan12', 'rs3m', 'gan13']]]);
	});

	it('is empty without cubes', () => {
		expect(cubeFilterGroups({ cubes: [], mains: {} }, options({ allMode: true }))).toEqual([]);
	});
});

describe('searchCubeFilterGroups', () => {
	const groups = cubeFilterGroups(state, options({ puzzle: null, allMode: true }));

	it('matches name and brand, drops empty groups', () => {
		expect(ids(searchCubeFilterGroups(groups, 'gan'))).toEqual([['333', ['gan12', 'gan13']]]);
		expect(ids(searchCubeFilterGroups(groups, 'moyu'))).toEqual([['333', ['rs3m']]]);
		expect(searchCubeFilterGroups(groups, 'zzz')).toEqual([]);
	});

	it('keeps everything for an empty query', () => {
		expect(countCubeFilterChoices(searchCubeFilterGroups(groups, '  '))).toBe(countCubeFilterChoices(groups));
	});
});

describe('resolveCubeFilter', () => {
	it('ignores unknown and deleted ids', () => {
		expect(resolveCubeFilter(state, 'gone', '333', false)).toBeNull();
		expect(resolveCubeFilter(state, null, null, true)).toBeNull();
	});

	it('applies a cube of the selected puzzle only', () => {
		expect(resolveCubeFilter(state, 'rs3m', '333', false)?.id).toBe('rs3m');
		expect(resolveCubeFilter(state, 'rs3m', '777', false)).toBeNull();
		expect(resolveCubeFilter(state, 'rs3m', null, false)).toBeNull();
	});

	it('applies any cube in "all" mode, archived ones too (profile link)', () => {
		expect(resolveCubeFilter(state, 'mgc7', null, true)?.id).toBe('mgc7');
		expect(resolveCubeFilter(state, 'dusty333', null, true)?.id).toBe('dusty333');
	});
});

describe('cubeFitsPuzzle', () => {
	it('keeps the cube in "all" mode and on its own puzzle, drops it elsewhere', () => {
		const c = cube('x');
		expect(cubeFitsPuzzle(c, null, true)).toBe(true);
		expect(cubeFitsPuzzle(c, '333', false)).toBe(true);
		expect(cubeFitsPuzzle(c, '222', false)).toBe(false);
		expect(cubeFitsPuzzle(c, null, false)).toBe(false);
		expect(cubeFitsPuzzle(null, '333', false)).toBe(false);
	});
});
