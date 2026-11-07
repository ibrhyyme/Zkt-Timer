/**
 * Warm-up mode: while it is on, saveSolve writes nothing and counts nothing, for the timer page
 * only. The newest solve stays in memory for the Save button, which saves it once. A mode left on
 * ends by itself after WARMUP_IDLE_MS, but never under a running solve. With auto-save on, a
 * solve that would be a new single PB is saved by itself and can be undone until the next solve.
 */

const mockStore: Record<string, any> = {};
const mockSettings: Record<string, any> = {};

jest.mock('../../../../db/solves/update', () => ({ createSolveDb: jest.fn(), deleteSolveDb: jest.fn() }));
jest.mock('../../../../db/solves/query', () => ({
	buildBucketFilter: jest.fn(() => ({})),
	fetchLastSolve: jest.fn(() => null),
}));
jest.mock('../../../../db/settings/query', () => ({ getSetting: (key: string) => mockSettings[key] }));
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

import { createSolveDb, deleteSolveDb } from '../../../../db/solves/update';
import { fetchLastSolve } from '../../../../db/solves/query';
import { getSinglePB } from '../../../../db/solves/stats/solves/single/single_pb';
import { noteCubeSolve } from '../../../../lib/cubes/store';
import { emitEvent } from '../../../../util/event_handler';
import { setTimerParam } from '../params';
import { saveSolve } from '../save';
import { saveLastWarmupSolve, sweepWarmup, toggleWarmup, undoWarmupAutoSave, warmupSolveBeatsPb } from '../warmup';
import {
	getWarmupState,
	isWarmupActive,
	stopWarmup,
	startWarmup,
	WARMUP_IDLE_MS,
	warmupLocksSolve,
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
	Object.keys(mockSettings).forEach((key) => delete mockSettings[key]);
	(getSinglePB as jest.Mock).mockReturnValue(null);
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
		expect(getWarmupState()).toMatchObject({ active: true, last: null, saved, autoSaved: null });
	});

	it('is available again for the next solve', () => {
		startWarmup();
		solveOnce();
		saveLastWarmupSolve();
		solveOnce();

		expect(getWarmupState()).toMatchObject({ saved: null, count: 2 });
		expect(getWarmupState().last).not.toBeNull();
	});

	it('does nothing before the first solve', () => {
		startWarmup();
		saveLastWarmupSolve();

		expect(createSolveDb).not.toHaveBeenCalled();
		expect(getWarmupState().saved).toBeNull();
	});
});

describe('auto-save', () => {
	beforeEach(() => {
		mockSettings.warmup_auto_save = 'pb';
		(getSinglePB as jest.Mock).mockReturnValue({ time: 10 });
		startWarmup();
	});

	it('saves a solve that would be a new PB, once, and offers Undo', () => {
		solveOnce(context(), 9_500);

		expect(createSolveDb).toHaveBeenCalledTimes(1);
		const saved = (createSolveDb as jest.Mock).mock.calls[0][0];
		expect(saved.time).toBe(9.5);
		expect(noteCubeSolve).toHaveBeenCalledTimes(1);
		expect(getWarmupState()).toMatchObject({ count: 1, last: null, saved, autoSaved: 'pb' });

		// The Save button has nothing left to save.
		saveLastWarmupSolve();
		expect(createSolveDb).toHaveBeenCalledTimes(1);
	});

	it('leaves a slower solve and a DNF to the Save button', () => {
		solveOnce(context(), 10_500);
		solveOnce(context(), 8_000, true);

		expect(createSolveDb).not.toHaveBeenCalled();
		expect(getWarmupState().autoSaved).toBeNull();
	});

	it('does nothing while the setting is off', () => {
		mockSettings.warmup_auto_save = 'off';
		solveOnce(context(), 9_000);

		expect(createSolveDb).not.toHaveBeenCalled();
		expect(getWarmupState().last).not.toBeNull();
	});

	it('Undo deletes the solve without asking and hands it back to the Save button', () => {
		solveOnce(context(), 9_500);
		const saved = (createSolveDb as jest.Mock).mock.calls[0][0];

		undoWarmupAutoSave();
		undoWarmupAutoSave();

		expect(deleteSolveDb).toHaveBeenCalledTimes(1);
		expect(deleteSolveDb).toHaveBeenCalledWith(saved, true);
		expect(getWarmupState()).toMatchObject({ last: saved, saved: null, autoSaved: null });
	});

	it('Undo is gone after the next solve', () => {
		solveOnce(context(), 9_500);
		solveOnce(context(), 11_000);

		undoWarmupAutoSave();
		expect(deleteSolveDb).not.toHaveBeenCalled();
	});

	it('Undo never deletes a solve saved with the button', () => {
		mockSettings.warmup_auto_save = 'off';
		solveOnce(context(), 9_500);
		saveLastWarmupSolve();

		undoWarmupAutoSave();
		expect(deleteSolveDb).not.toHaveBeenCalled();
	});
});

describe('auto-save under a threshold', () => {
	beforeEach(() => {
		mockSettings.warmup_auto_save = 'threshold';
		// The bucket saveSolve writes for cubeType 'wca' + subset '333'.
		mockSettings.warmup_auto_save_thresholds = { 'wca::333': 12.99 };
		(getSinglePB as jest.Mock).mockReturnValue({ time: 9 });
		startWarmup();
	});

	it('saves a time at or under the threshold, not over it', () => {
		solveOnce(context(), 13_000);
		expect(createSolveDb).not.toHaveBeenCalled();

		solveOnce(context(), 12_990);
		expect(createSolveDb).toHaveBeenCalledTimes(1);
		expect(getWarmupState().autoSaved).toBe('threshold');
	});

	it('still saves a PB above the threshold, and says PB', () => {
		mockSettings.warmup_auto_save_thresholds = { 'wca::333': 5 };
		solveOnce(context(), 8_000);

		expect(createSolveDb).toHaveBeenCalledTimes(1);
		expect(getWarmupState().autoSaved).toBe('pb');
	});

	it('counts the +2 in the time it compares', () => {
		solveOnce(context({ addTwoToSolve: true }), 11_500);
		expect(createSolveDb).not.toHaveBeenCalled();
	});

	it('uses the threshold of the solve bucket only', () => {
		(getSinglePB as jest.Mock).mockReturnValue(null);
		solveOnce(context({ cubeType: '222', scrambleSubset: null }), 3_000);
		expect(createSolveDb).not.toHaveBeenCalled();
	});

	it('can be undone like a PB', () => {
		solveOnce(context(), 12_000);
		undoWarmupAutoSave();

		expect(deleteSolveDb).toHaveBeenCalledTimes(1);
		expect(getWarmupState()).toMatchObject({ saved: null, autoSaved: null });
	});
});

describe('warmupLocksSolve', () => {
	it('locks every solve in warm-up but the one just saved from it', () => {
		startWarmup();
		solveOnce();
		const id = getWarmupState().last!.id;
		expect(warmupLocksSolve(getWarmupState(), id)).toBe(true);

		saveLastWarmupSolve();
		expect(warmupLocksSolve(getWarmupState(), id)).toBe(false);
		expect(warmupLocksSolve(getWarmupState(), 'older')).toBe(true);
		expect(warmupLocksSolve(getWarmupState(), undefined)).toBe(true);
	});

	it('locks nothing outside warm-up', () => {
		expect(warmupLocksSolve(getWarmupState(), 'any')).toBe(false);
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

		expect(getWarmupState()).toMatchObject({ count: 0, last: null, saved: null });
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
