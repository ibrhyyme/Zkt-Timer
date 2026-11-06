/**
 * Warm-up mode: while it is on, saveSolve writes nothing and counts nothing, for the timer page
 * only. The newest solve stays in memory for the Save button, which saves it once. A mode left on
 * ends by itself after WARMUP_IDLE_MS, but never under a running solve.
 */

const mockStore: Record<string, any> = {};

jest.mock('../../../../db/solves/update', () => ({ createSolveDb: jest.fn() }));
jest.mock('../../../../db/solves/query', () => ({
	buildBucketFilter: jest.fn(() => ({})),
	fetchLastSolve: jest.fn(() => null),
}));
jest.mock('../../../../db/settings/query', () => ({ getSetting: () => undefined }));
jest.mock('../../../../db/solves/stats/solves/single/single_pb', () => ({ getSinglePB: jest.fn(() => null) }));
jest.mock('../../../../db/sessions/active', () => ({ getActiveSessionId: () => 's1' }));
jest.mock('../../../../lib/cubes/store', () => ({ getCubeState: () => ({}), noteCubeSolve: jest.fn() }));
jest.mock('../../../../util/event_handler', () => ({ emitEvent: jest.fn() }));
jest.mock('../../../../util/native-plugins', () => ({ requestInAppReview: jest.fn(), hapticImpact: jest.fn() }));
jest.mock('../../../../util/hooks/useSmartCubeStore', () => ({ getSmartCubeStore: () => null }));
jest.mock('../../../../util/store/getTimer', () => ({ getTimerStore: (key: string) => mockStore[key] }));
jest.mock('../params', () => ({
	setTimerParam: jest.fn((key: string, value: any) => { mockStore[key] = value; }),
}));

import { createSolveDb } from '../../../../db/solves/update';
import { fetchLastSolve } from '../../../../db/solves/query';
import { getSinglePB } from '../../../../db/solves/stats/solves/single/single_pb';
import { noteCubeSolve } from '../../../../lib/cubes/store';
import { emitEvent } from '../../../../util/event_handler';
import { setTimerParam } from '../params';
import { saveSolve } from '../save';
import { saveLastWarmupSolve, sweepWarmup, toggleWarmup, warmupSolveBeatsPb } from '../warmup';
import {
	getWarmupState,
	isWarmupActive,
	stopWarmup,
	startWarmup,
	WARMUP_IDLE_MS,
} from '../../../../lib/warmup/store';

function context(overrides: Record<string, any> = {}): any {
	return {
		addTwoToSolve: false,
		dnfTime: false,
		cubeType: 'wca',
		scrambleSubset: '333',
		solvesFilter: { from_timer: true, session_id: 's1' },
		sessionSolveCount: 4,
		...overrides,
	};
}

function solveOnce(ctx = context(), time = 10_000, dnf = false) {
	saveSolve(ctx, time, 'R U', 1_000, 1_000 + time, dnf);
}

beforeEach(() => {
	stopWarmup();
	jest.clearAllMocks();
	Object.keys(mockStore).forEach((key) => delete mockStore[key]);
});

describe('saveSolve in warm-up mode', () => {
	it('saves as usual while the mode is off', () => {
		solveOnce();

		expect(createSolveDb).toHaveBeenCalledTimes(1);
		expect(setTimerParam).toHaveBeenCalledWith('sessionSolveCount', 5);
		expect(emitEvent).toHaveBeenCalledWith('solveSavedEvent', expect.anything());
	});

	it('writes nothing and counts nothing while it is on', () => {
		startWarmup();
		solveOnce();
		solveOnce();

		expect(createSolveDb).not.toHaveBeenCalled();
		expect(noteCubeSolve).not.toHaveBeenCalled();
		expect(emitEvent).not.toHaveBeenCalled();
		expect(setTimerParam).not.toHaveBeenCalledWith('sessionSolveCount', expect.anything());
		expect(getWarmupState().count).toBe(2);
	});

	it('leaves a room or battle solve alone', () => {
		startWarmup();
		const onSolve = jest.fn();
		solveOnce(context({ onSolve }));

		expect(onSolve).toHaveBeenCalledTimes(1);
		expect(getWarmupState().count).toBe(0);
	});

	it('leaves a timer in a modal alone', () => {
		startWarmup();
		solveOnce(context({ inModal: true }));

		expect(createSolveDb).toHaveBeenCalledTimes(1);
		expect(getWarmupState().count).toBe(0);
	});
});

describe('the Save button', () => {
	it('saves the newest solve only, with its own bucket, once', () => {
		startWarmup();
		solveOnce(context(), 12_000);
		solveOnce(context(), 9_000);

		saveLastWarmupSolve();
		saveLastWarmupSolve();

		expect(createSolveDb).toHaveBeenCalledTimes(1);
		const saved = (createSolveDb as jest.Mock).mock.calls[0][0];
		expect(saved.time).toBe(9);
		expect(saved.cube_type).toBe('wca');
		expect(saved.session_id).toBe('s1');
		expect(noteCubeSolve).toHaveBeenCalledTimes(1);
		expect(getWarmupState()).toMatchObject({ active: true, last: null, lastSaved: true });
	});

	it('is available again for the next solve', () => {
		startWarmup();
		solveOnce();
		saveLastWarmupSolve();
		solveOnce();

		expect(getWarmupState()).toMatchObject({ lastSaved: false, count: 2 });
		expect(getWarmupState().last).not.toBeNull();
	});

	it('does nothing before the first solve', () => {
		startWarmup();
		saveLastWarmupSolve();

		expect(createSolveDb).not.toHaveBeenCalled();
		expect(getWarmupState().lastSaved).toBe(false);
	});
});

describe('warmupSolveBeatsPb', () => {
	const solve = (fields: Record<string, any>): any => ({ cube_type: 'wca', scramble_subset: '333', dnf: false, time: 10, ...fields });

	beforeEach(() => {
		(getSinglePB as jest.Mock).mockReturnValue({ time: 10 });
	});

	afterEach(() => {
		(getSinglePB as jest.Mock).mockReturnValue(null);
	});

	it('is true for a faster time and for a tie, as for a saved solve', () => {
		expect(warmupSolveBeatsPb(solve({ time: 9.99 }))).toBe(true);
		expect(warmupSolveBeatsPb(solve({ time: 10 }))).toBe(true);
	});

	it('is false for a slower time', () => {
		expect(warmupSolveBeatsPb(solve({ time: 10.01 }))).toBe(false);
	});

	it('is false for a DNF and a time of zero', () => {
		expect(warmupSolveBeatsPb(solve({ dnf: true, time: -1 }))).toBe(false);
		expect(warmupSolveBeatsPb(solve({ time: 0 }))).toBe(false);
	});

	it('is false with no saved solve to beat', () => {
		(getSinglePB as jest.Mock).mockReturnValue(null);
		expect(warmupSolveBeatsPb(solve({ time: 1 }))).toBe(false);
	});

	it('looks in the bucket of the solve, the way the PB check does', () => {
		warmupSolveBeatsPb(solve({ cube_type: '222', scramble_subset: undefined }));
		expect(getSinglePB).toHaveBeenCalledWith({ cube_type: '222', scramble_subset: null, from_timer: true });
	});
});

describe('toggleWarmup', () => {
	it('turns the mode on and off', () => {
		expect(toggleWarmup()).toBe(true);
		expect(isWarmupActive()).toBe(true);
		expect(toggleWarmup()).toBe(true);
		expect(isWarmupActive()).toBe(false);
	});

	it.each(['timeStartedAt', 'inInspection', 'spaceTimerStarted', 'virtualArmed'])('refuses during %s', (key) => {
		mockStore[key] = 1;

		expect(toggleWarmup()).toBe(false);
		expect(isWarmupActive()).toBe(false);
	});

	it('starts each run from zero, without the old solve', () => {
		startWarmup();
		solveOnce();
		toggleWarmup();
		startWarmup();

		expect(getWarmupState()).toMatchObject({ count: 0, last: null, lastSaved: false });
	});

	it('puts the last saved time back on the digits after thrown-away solves', () => {
		(fetchLastSolve as jest.Mock).mockReturnValueOnce({ time: 15.5 });
		startWarmup();
		solveOnce();
		toggleWarmup();

		expect(setTimerParam).toHaveBeenCalledWith('finalTime', 15_500);
	});

	it('leaves the digits alone when nothing was thrown away', () => {
		startWarmup();
		toggleWarmup();

		expect(setTimerParam).not.toHaveBeenCalledWith('finalTime', expect.anything());
	});
});

describe('sweepWarmup', () => {
	const T0 = 1_000_000;

	it('keeps the mode just under the limit and ends it at the limit', () => {
		startWarmup(T0);

		sweepWarmup(T0 + WARMUP_IDLE_MS - 1);
		expect(isWarmupActive()).toBe(true);

		sweepWarmup(T0 + WARMUP_IDLE_MS);
		expect(isWarmupActive()).toBe(false);
	});

	it('counts from the latest solve', () => {
		const realNow = Date.now;
		startWarmup(T0);
		Date.now = () => T0 + WARMUP_IDLE_MS - 1;
		solveOnce();
		Date.now = realNow;

		sweepWarmup(T0 + WARMUP_IDLE_MS + 1);
		expect(isWarmupActive()).toBe(true);
	});

	it('waits for a running solve', () => {
		startWarmup(T0);
		mockStore.timeStartedAt = new Date(T0);

		sweepWarmup(T0 + WARMUP_IDLE_MS * 2);
		expect(isWarmupActive()).toBe(true);

		mockStore.timeStartedAt = null;
		sweepWarmup(T0 + WARMUP_IDLE_MS * 2);
		expect(isWarmupActive()).toBe(false);
	});
});
