/**
 * Which cube a new timer solve is stamped with (design magnet-cubes 4.3, K-3, S-3), and that
 * saveSolve applies it: rooms never get one, an explicit cube_id wins, the cube's local
 * "last used" moves forward.
 */

const mockCreateSolveDb = jest.fn();
const mockNoteCubeSolve = jest.fn();
let mockCubeState: any = { userId: 'u', cubes: [], mains: {}, pendingCalibrations: [] };
let mockBleId: string | undefined = undefined;

jest.mock('../../../../db/solves/update', () => ({ createSolveDb: (...args: any[]) => mockCreateSolveDb(...args) }));
jest.mock('../../../../util/event_handler', () => ({ emitEvent: jest.fn() }));
jest.mock('../params', () => ({ setTimerParam: jest.fn() }));
jest.mock('../../../../util/native-plugins', () => ({ requestInAppReview: jest.fn() }));
jest.mock('../../../../lib/cubes/store', () => ({
	getCubeState: () => mockCubeState,
	noteCubeSolve: (...args: any[]) => mockNoteCubeSolve(...args),
}));
jest.mock('../../../../util/hooks/useSmartCubeStore', () => ({
	getSmartCubeStore: (key: string) => (key === 'smartBleDeviceId' ? mockBleId : undefined),
}));

import { cubeIdForSolve } from '../cube_stamp';
import { saveSolve } from '../save';

function cube(id: string, puzzle: string, extra: Record<string, any> = {}): any {
	return {
		id, puzzle, name: id, brand: null, is_smart: false, ble_device_id: null, ble_name: null,
		legacy_smart_device_ids: [], archived_at: null, created_at: null, updated_at: null,
		solve_count: 0, first_used_at: null, last_used_at: null, calibrations: [], ...extra,
	};
}

const STATE = {
	cubes: [
		cube('gan12', '333'),
		cube('moyu', '333'),
		cube('smart', '333', { is_smart: true, ble_device_id: 'ble-1' }),
		cube('yj2', '222'),
		cube('old', '444', { archived_at: 1 }),
	],
	mains: {
		'333': { cube_id: 'gan12', set_at: 10 },
		'222': { cube_id: 'yj2', set_at: 10 },
		'444': { cube_id: 'old', set_at: 10 },
	},
};

describe('cubeIdForSolve', () => {
	it('uses the main of the bucket puzzle, subsets and methods included (K-3)', () => {
		expect(cubeIdForSolve({ cube_type: '333' }, STATE, null)).toBe('gan12');
		expect(cubeIdForSolve({ cube_type: 'wca', scramble_subset: '333' }, STATE, null)).toBe('gan12');
		expect(cubeIdForSolve({ cube_type: '333cfop', scramble_subset: 'pll' }, STATE, null)).toBe('gan12');
		expect(cubeIdForSolve({ cube_type: 'wca', scramble_subset: '222' }, STATE, null)).toBe('yj2');
	});

	it('stamps nothing without a main, for an archived main, and for "other"', () => {
		expect(cubeIdForSolve({ cube_type: '555' }, STATE, null)).toBeNull();
		expect(cubeIdForSolve({ cube_type: '444' }, STATE, null)).toBeNull();
		expect(cubeIdForSolve({ cube_type: 'other' }, STATE, null)).toBeNull();
	});

	it('stamps the connected smart cube, not the main', () => {
		expect(cubeIdForSolve({ cube_type: '333', is_smart_cube: true }, STATE, 'ble-1')).toBe('smart');
	});

	it('stamps nothing for a smart cube My Cubes does not know (offline first connect)', () => {
		expect(cubeIdForSolve({ cube_type: '333', is_smart_cube: true }, STATE, 'ble-unknown')).toBeNull();
		expect(cubeIdForSolve({ cube_type: '333', is_smart_cube: true }, STATE, '')).toBeNull();
	});

	it('never puts a 3x3 smart cube on another puzzle (S-3)', () => {
		expect(cubeIdForSolve({ cube_type: '222', is_smart_cube: true }, STATE, 'ble-1')).toBeNull();
	});

	it('stamps nothing for the virtual cube', () => {
		expect(cubeIdForSolve({ cube_type: '333', is_virtual_cube: true }, STATE, null)).toBeNull();
	});
});

describe('saveSolve stamping', () => {
	function context(overrides: Record<string, any> = {}): any {
		return {
			addTwoToSolve: false,
			dnfTime: false,
			cubeType: '333',
			scrambleSubset: null,
			solvesFilter: { from_timer: true },
			sessionSolveCount: 0,
			...overrides,
		};
	}

	beforeEach(() => {
		mockCreateSolveDb.mockReset();
		mockNoteCubeSolve.mockReset();
		mockCubeState = { userId: 'u', pendingCalibrations: [], ...STATE };
		mockBleId = undefined;
	});

	it('writes the main cube and moves its last use forward', () => {
		saveSolve(context(), 10_000, 'R U', 1_000, 11_000);

		const solve = mockCreateSolveDb.mock.calls[0][0];
		expect(solve.cube_id).toBe('gan12');
		expect(mockNoteCubeSolve).toHaveBeenCalledWith('gan12');
	});

	it('writes the connected smart cube for a smart solve, and no smart_device_id', () => {
		mockBleId = 'ble-1';
		saveSolve(context(), 10_000, 'R U', 1_000, 11_000, false, false, { is_smart_cube: true });

		const solve = mockCreateSolveDb.mock.calls[0][0];
		expect(solve.cube_id).toBe('smart');
		expect(solve.smart_device_id).toBeUndefined();
	});

	it('writes null when there is no cube to stamp', () => {
		saveSolve(context({ cubeType: '777' }), 10_000, 'R U', 1_000, 11_000);
		expect(mockCreateSolveDb.mock.calls[0][0].cube_id).toBeNull();
	});

	it('keeps a cube the caller chose', () => {
		saveSolve(context(), 10_000, 'R U', 1_000, 11_000, false, false, { cube_id: 'moyu' });
		expect(mockCreateSolveDb.mock.calls[0][0].cube_id).toBe('moyu');
	});

	it('leaves room solves without a cube (K-3)', () => {
		const onSolve = jest.fn();
		saveSolve(context({ onSolve }), 10_000, 'R U', 1_000, 11_000);

		expect(onSolve.mock.calls[0][0].cube_id).toBeUndefined();
		expect(mockNoteCubeSolve).not.toHaveBeenCalled();
	});
});
