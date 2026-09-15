/**
 * The smart cube time offset ("İlave süre"): a fixed amount added to every smart cube
 * solve. The time frozen on screen at the stop, the time saved and the time in every
 * list have to be the same number, and +2 / DNF keep working on top of it.
 */

const mockStore: Record<string, any> = {};
const mockSettings: Record<string, any> = {};

jest.mock('react-dom', () => ({ unstable_batchedUpdates: (fn: () => void) => fn() }));
jest.mock('../params', () => ({
	setTimerParams: jest.fn((params: Record<string, any>) => Object.assign(mockStore, params)),
	setTimerParam: jest.fn((key: string, value: any) => { mockStore[key] = value; }),
}));
jest.mock('../timers', () => ({
	setTimer: jest.fn(),
	stopTimer: jest.fn(),
	clearInspectionTimers: jest.fn(),
	START_TIMEOUT: 'start',
	INSPECTION_TIMEOUT: 'inspection',
	INSPECTION_INTERVAL: 'inspection_interval',
}));
jest.mock('../save', () => ({ saveSolve: jest.fn() }));
jest.mock('../scramble', () => ({
	resetScramble: jest.fn(),
	preGenerateScramble: jest.fn(),
	consumePreGeneratedScramble: jest.fn(() => null),
}));
jest.mock('../../../../util/event_handler', () => ({ emitEvent: jest.fn() }));
jest.mock('../../../../db/settings/query', () => ({
	getSettings: () => mockSettings,
	getSetting: (key: string) => mockSettings[key],
}));
jest.mock('../../../../util/store/getTimer', () => ({
	getTimerStore: (key: string) => mockStore[key],
}));
jest.mock('../../../../util/storage', () => ({ resourceUri: (path: string) => path }));
jest.mock('../../../../util/native-audio', () => ({ playNativeSound: () => false }));
jest.mock('../../../../util/native-plugins', () => ({ hapticImpact: jest.fn() }));
jest.mock('../../../store', () => ({
	getStore: () => ({ getState: () => ({ account: { me: null } }) }),
}));
jest.mock('../../../../lib/pro', () => ({ isPro: () => false }));

import {
	applySmartCubeTimeOffset,
	getSmartCubeTimeOffset,
	normalizeSmartCubeTimeOffset,
	smartCubeTimeOffsetMs,
} from '../smart_time_offset';
import { endTimer, getTimerEndFinalTime } from '../events';
import { saveSolve } from '../save';
import { setTimerParams } from '../params';

describe('normalizeSmartCubeTimeOffset', () => {
	it('keeps a value in range, in hundredths', () => {
		expect(normalizeSmartCubeTimeOffset(0.35)).toBe(0.35);
		expect(normalizeSmartCubeTimeOffset(1)).toBe(1);
		expect(normalizeSmartCubeTimeOffset(0.125)).toBe(0.13);
		expect(normalizeSmartCubeTimeOffset(0.004)).toBe(0);
	});

	it('clamps to 0 to 5 s', () => {
		expect(normalizeSmartCubeTimeOffset(-1)).toBe(0);
		expect(normalizeSmartCubeTimeOffset(5)).toBe(5);
		expect(normalizeSmartCubeTimeOffset(12)).toBe(5);
	});

	it('reads typed text, with a comma as the decimal separator too', () => {
		expect(normalizeSmartCubeTimeOffset('0.35')).toBe(0.35);
		expect(normalizeSmartCubeTimeOffset(' 1,5 ')).toBe(1.5);
	});

	it('treats anything unusable as no offset', () => {
		expect(normalizeSmartCubeTimeOffset(undefined)).toBe(0);
		expect(normalizeSmartCubeTimeOffset(null)).toBe(0);
		expect(normalizeSmartCubeTimeOffset('')).toBe(0);
		expect(normalizeSmartCubeTimeOffset('abc')).toBe(0);
		expect(normalizeSmartCubeTimeOffset(NaN)).toBe(0);
		expect(normalizeSmartCubeTimeOffset(Infinity)).toBe(0);
	});
});

describe('applySmartCubeTimeOffset', () => {
	it('adds the offset in whole milliseconds', () => {
		expect(smartCubeTimeOffsetMs(0.35)).toBe(350);
		expect(applySmartCubeTimeOffset(10_000, 0.35)).toBe(10_350);
		expect(applySmartCubeTimeOffset(8_123, 1)).toBe(9_123);
	});

	it('leaves the time alone with no offset', () => {
		expect(applySmartCubeTimeOffset(10_000, 0)).toBe(10_000);
		expect(applySmartCubeTimeOffset(10_000, undefined)).toBe(10_000);
	});

	it('never touches a zero time, which is what locks an aborted-solve DNF', () => {
		expect(applySmartCubeTimeOffset(0, 1)).toBe(0);
		expect(applySmartCubeTimeOffset(-1, 1)).toBe(-1);
	});
});

describe('getSmartCubeTimeOffset', () => {
	it('reads the setting normalized', () => {
		mockSettings.smart_cube_time_offset = 0.35;
		expect(getSmartCubeTimeOffset()).toBe(0.35);
		mockSettings.smart_cube_time_offset = 'nonsense';
		expect(getSmartCubeTimeOffset()).toBe(0);
		delete mockSettings.smart_cube_time_offset;
		expect(getSmartCubeTimeOffset()).toBe(0);
	});
});

describe('endTimer with a smart cube time offset', () => {
	const STARTED_AT = 10_000;
	const STOPPED_AT = 20_000;

	function timerContext(): any {
		return {
			cubeType: '333',
			scrambleSubset: null,
			scramble: "R U R' U'",
			timeStartedAt: new Date(STARTED_AT),
			smartDeviceId: 'cube-1',
			solvesFilter: {},
		};
	}

	let deferred: Array<() => void> = [];
	let dateNowSpy: jest.SpyInstance;

	function stop(...args: Parameters<typeof endTimer>) {
		const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
			deferred.push(fn);
			return 0;
		}) as any);
		try {
			endTimer(...args);
		} finally {
			spy.mockRestore();
		}
	}

	function runDeferredSave() {
		const queued = deferred;
		deferred = [];
		queued.forEach((fn) => fn());
	}

	beforeAll(() => {
		(global as any).window = { dispatchEvent: jest.fn() };
		(global as any).CustomEvent = class {
			type: string;
			constructor(type: string) {
				this.type = type;
			}
		};
	});

	afterAll(() => {
		delete (global as any).window;
		delete (global as any).CustomEvent;
	});

	beforeEach(() => {
		jest.clearAllMocks();
		dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(STOPPED_AT);
		for (const key of Object.keys(mockStore)) delete mockStore[key];
		Object.assign(mockStore, { timeStartedAt: new Date(STARTED_AT), phaseSplits: [], smartTurns: [] });
		for (const key of Object.keys(mockSettings)) delete mockSettings[key];
		Object.assign(mockSettings, {
			timer_type: 'smart',
			use_space_with_smart_cube: false,
			scramble_top_color: null,
			multi_phase_count: 1,
			smart_cube_time_offset: 0.35,
		});
	});

	afterEach(() => {
		runDeferredSave();
		dateNowSpy.mockRestore();
	});

	it('freezes the display, sets the final time and saves the same offset time', () => {
		// The engine measured 9.00 s with 36 turns
		stop(timerContext(), 9_000, { is_smart_cube: true, smart_turn_count: 36, smart_turns: null });

		expect(getTimerEndFinalTime()).toBe(9_350);
		expect(setTimerParams).toHaveBeenCalledWith(expect.objectContaining({ finalTime: 9_350 }));

		runDeferredSave();
		expect(saveSolve).toHaveBeenCalledTimes(1);
		expect((saveSolve as jest.Mock).mock.calls[0][1]).toBe(9_350);
	});

	it('takes TPS over the measured time, not the offset one', () => {
		stop(timerContext(), 9_000, { is_smart_cube: true, smart_turn_count: 36, smart_turns: null });

		// 36 turns / 9.00 s, not 36 / 9.35
		expect(setTimerParams).toHaveBeenCalledWith(expect.objectContaining({
			lastSmartSolveStats: { turns: 36, tps: 4 },
		}));
	});

	// Owner's decision: with "use spacebar with smart cubes" the keyboard starts and stops the
	// timer, so the cube's own stop, which the offset makes up for, plays no part.
	it('leaves a smart cube solve timed with the spacebar alone', () => {
		mockSettings.use_space_with_smart_cube = true;

		stop(timerContext());

		// Keyboard stop measures Date.now() - start = 10 s, and nothing is added
		expect(getTimerEndFinalTime()).toBe(10_000);
		runDeferredSave();
		expect((saveSolve as jest.Mock).mock.calls[0][1]).toBe(10_000);
	});

	it('leaves every other timer alone', () => {
		mockSettings.timer_type = 'keyboard';

		stop(timerContext());

		expect(getTimerEndFinalTime()).toBe(10_000);
		runDeferredSave();
		expect((saveSolve as jest.Mock).mock.calls[0][1]).toBe(10_000);
	});

	it('leaves a smart cube solve alone with the default of 0', () => {
		mockSettings.smart_cube_time_offset = 0;

		stop(timerContext(), 9_000, { is_smart_cube: true, smart_turn_count: 36, smart_turns: null });

		expect(getTimerEndFinalTime()).toBe(9_000);
	});
});
