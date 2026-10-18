import { CubeState, LocalCube } from '../../../../lib/cubes/active_cube';
import { cubeSelectView, CubeSelectInput, timerCubeLabel, timerPuzzle } from '../cube_select_state';

function cube(id: string, puzzle: string, extra: Partial<LocalCube> = {}): LocalCube {
	return {
		id,
		puzzle,
		name: id.toUpperCase(),
		brand: null,
		is_smart: false,
		ble_device_id: null,
		ble_name: null,
		legacy_smart_device_ids: [],
		archived_at: null,
		created_at: null,
		updated_at: null,
		solve_count: 0,
		first_used_at: null,
		last_used_at: null,
		calibrations: [],
		...extra,
	};
}

const state: Pick<CubeState, 'cubes' | 'mains'> = {
	cubes: [
		cube('gan', '333', { last_used_at: 10 }),
		cube('moyu', '333', { last_used_at: 20 }),
		cube('old', '333', { archived_at: 5 }),
		cube('smart', '333', { is_smart: true, ble_device_id: 'ble-1' }),
		cube('yj', '222'),
	],
	mains: { '333': { cube_id: 'gan', set_at: 1 } },
};

function input(extra: Partial<CubeSelectInput> = {}): CubeSelectInput {
	return {
		signedIn: true,
		timerType: 'keyboard',
		magnetOwnsInput: false,
		cubeType: '333',
		scrambleSubset: null,
		state,
		smartBleDeviceId: null,
		...extra,
	};
}

describe('timerPuzzle', () => {
	it('reads the bucket the way saveSolve stores it', () => {
		expect(timerPuzzle('wca', null)).toBe('333');
		expect(timerPuzzle('wca', '444')).toBe('444');
		expect(timerPuzzle('333', 'pll')).toBe('333');
		expect(timerPuzzle('other', null)).toBeNull();
	});
});

describe('cubeSelectView', () => {
	it('lists the puzzle cubes main first, without archived ones, with "no cube"', () => {
		const view = cubeSelectView(input());
		expect(view.kind).toBe('select');
		if (view.kind !== 'select') return;
		expect(view.cubes.map((c) => c.id)).toEqual(['gan', 'moyu', 'smart']);
		expect(view.mainId).toBe('gan');
		expect(view.allowNone).toBe(true);
	});

	it('counts every bucket of the puzzle, subsets and WCA included (K-3)', () => {
		const pll = cubeSelectView(input({ cubeType: '333', scrambleSubset: 'pll' }));
		const wca = cubeSelectView(input({ cubeType: 'wca', scrambleSubset: '333' }));
		expect(pll.kind === 'select' && pll.mainId).toBe('gan');
		expect(wca.kind === 'select' && wca.mainId).toBe('gan');
	});

	it('never shows a cube of another puzzle (S-3)', () => {
		const view = cubeSelectView(input({ cubeType: '222' }));
		expect(view.kind === 'select' && view.cubes.map((c) => c.id)).toEqual(['yj']);
		expect(view.kind === 'select' && view.mainId).toBeNull();
	});

	it('does not offer "no cube" in the Magnet Timer', () => {
		const view = cubeSelectView(input({ timerType: 'magnet', magnetOwnsInput: true }));
		expect(view.kind === 'select' && view.allowNone).toBe(false);
	});

	it('hides the row without cubes, except in the Magnet Timer which points to adding one', () => {
		expect(cubeSelectView(input({ cubeType: '444' })).kind).toBe('hidden');
		expect(cubeSelectView(input({ cubeType: '444', timerType: 'magnet', magnetOwnsInput: true }))).toEqual({
			kind: 'empty',
			puzzle: '444',
		});
	});

	it('treats a Magnet selection running as the touch timer like any other input', () => {
		expect(cubeSelectView(input({ cubeType: '444', timerType: 'magnet', magnetOwnsInput: false })).kind).toBe('hidden');
	});

	it('hides the row for visitors, the virtual cube and buckets without a puzzle', () => {
		expect(cubeSelectView(input({ signedIn: false })).kind).toBe('hidden');
		expect(cubeSelectView(input({ timerType: 'virtual' })).kind).toBe('hidden');
		expect(cubeSelectView(input({ cubeType: 'other' })).kind).toBe('hidden');
	});

	it('shows the connected smart cube read only, and nothing when it is unknown or of another puzzle', () => {
		const smart = cubeSelectView(input({ timerType: 'smart', smartBleDeviceId: 'ble-1' }));
		expect(smart.kind).toBe('smart');
		expect(smart.kind === 'smart' && smart.cube.id).toBe('smart');
		expect(cubeSelectView(input({ timerType: 'smart', smartBleDeviceId: 'ble-x' })).kind).toBe('hidden');
		expect(cubeSelectView(input({ timerType: 'smart', smartBleDeviceId: null })).kind).toBe('hidden');
		expect(cubeSelectView(input({ timerType: 'smart', smartBleDeviceId: 'ble-1', cubeType: '222' })).kind).toBe('hidden');
	});
});

describe('timerCubeLabel', () => {
	it('names the main cube, and nothing without one', () => {
		expect(timerCubeLabel(cubeSelectView(input()))?.id).toBe('gan');
		expect(timerCubeLabel(cubeSelectView(input({ cubeType: '222' })))).toBeNull();
		expect(timerCubeLabel(cubeSelectView(input({ timerType: 'smart', smartBleDeviceId: 'ble-1' })))).toBeNull();
	});
});
