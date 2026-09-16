/**
 * endTimer takes the per-move smart cube fields (turns, pick-up and last-move time) from
 * the store: TimerContext no longer carries them, see FAST_TIMER_FIELDS. The keyboard
 * stop in "use space with smart cube" mode depends on them for the turn count and the
 * pick-up / put-down times, and has to read them before endTimer's own reset clears them.
 */

const mockStore: Record<string, any> = {};
const mockSmartCubeStore: Record<string, any> = {smartDeviceId: 'cube-1'};
const mockSettings: Record<string, any> = {};
let mockMe: any = null;

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
// The connected device id moved to its own slice (reducers/smart_cube.ts), so endTimer
// reads it from there rather than from TimerContext.
jest.mock('../../../../util/hooks/useSmartCubeStore', () => ({
	getSmartCubeStore: (key: string) => mockSmartCubeStore[key],
}));
jest.mock('../../../../util/storage', () => ({ resourceUri: (path: string) => path }));
jest.mock('../../../../util/native-audio', () => ({ playNativeSound: () => false }));
jest.mock('../../../../util/native-plugins', () => ({ hapticImpact: jest.fn() }));
jest.mock('../../../store', () => ({
	getStore: () => ({ getState: () => ({ account: { me: mockMe } }) }),
}));
jest.mock('../../../../lib/pro', () => ({ isPro: (me: any) => !!me?.pro }));

import { endTimer } from '../events';
import { saveSolve } from '../save';
import { setTimerParams } from '../params';

const STARTED_AT = 10_000;
const STOPPED_AT = 20_000;

/** What Timer puts in the context: no per-move fields at all. */
function timerContext(): any {
	return {
		cubeType: '333',
		scrambleSubset: null,
		scramble: "R U R' U'",
		timeStartedAt: new Date(STARTED_AT),
		solvesFilter: {},
	};
}

function seedStore() {
	for (const key of Object.keys(mockStore)) delete mockStore[key];
	Object.assign(mockStore, {
		timeStartedAt: new Date(STARTED_AT),
		phaseSplits: [],
		smartTurns: [
			// Scramble leftover, well before the start: never part of the solve.
			{ turn: 'U', completedAt: STARTED_AT - 1_000 },
			// Inside the 500 ms lead-in the live stats allow for the starting move.
			{ turn: 'R', completedAt: STARTED_AT - 200 },
			{ turn: 'U', completedAt: STARTED_AT + 2_000 },
			{ turn: "R'", completedAt: STARTED_AT + 5_000 },
		],
		smartPickUpTime: 0.8,
		lastSmartMoveTime: STOPPED_AT - 1_500,
	});
}

let deferred: Array<() => void> = [];
let dateNowSpy: jest.SpyInstance;

/**
 * Calls endTimer and holds back the save it defers by a tick, so a test decides when it
 * runs. The spy lives only for the call: Jest itself uses setTimeout.
 */
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
	seedStore();
	mockMe = null;
	Object.assign(mockSettings, {
		timer_type: 'smart',
		use_space_with_smart_cube: true,
		scramble_top_color: null,
		multi_phase_count: null,
	});
});

afterEach(() => {
	// endTimer holds a module-level lock until its deferred save has run.
	runDeferredSave();
	dateNowSpy.mockRestore();
});

describe('endTimer with a smart cube stopped from the keyboard', () => {
	it('counts the turns from the store for the live stats', () => {
		stop(timerContext());

		// R, U, R' (the leftover U predates the lead-in): 3 turns over 10 s.
		expect(setTimerParams).toHaveBeenCalledWith(expect.objectContaining({
			lastSmartSolveStats: { turns: 3, tps: 0.3 },
		}));
	});

	it('saves the turn count and the pick-up / put-down times read before the reset', () => {
		stop(timerContext());
		runDeferredSave();

		// The reset ran before the save, so reading the store at save time would find
		// nothing. The values still arrive, so they were taken before it.
		expect(mockStore.smartTurns).toEqual([]);
		expect(mockStore.lastSmartMoveTime).toBe(0);

		expect(saveSolve).toHaveBeenCalledTimes(1);
		const overrides = (saveSolve as jest.Mock).mock.calls[0][7];
		expect(overrides).toMatchObject({
			is_smart_cube: true,
			smart_device_id: 'cube-1',
			// Only turns from the start on are saved: U and R'.
			smart_turn_count: 2,
			smart_turns: null,
			smart_pick_up_time: 0.8,
			smart_put_down_time: 1.5,
		});
	});

	it('serializes the saved turns for a Pro user from the same snapshot', () => {
		mockMe = { pro: true };

		stop(timerContext());
		runDeferredSave();

		const overrides = (saveSolve as jest.Mock).mock.calls[0][7];
		expect(typeof overrides.smart_turns).toBe('string');
		expect(overrides.smart_turns.length).toBeGreaterThan(0);
	});
});

describe('endTimer with a smart cube finished by the engine', () => {
	it('keeps the counts it was handed instead of recounting', () => {
		// The engine only runs when the space bar is not the start/stop control.
		mockSettings.use_space_with_smart_cube = false;

		stop(timerContext(), 9_000, { is_smart_cube: true, smart_turn_count: 42, smart_turns: null });
		runDeferredSave();

		expect(setTimerParams).toHaveBeenCalledWith(expect.objectContaining({
			lastSmartSolveStats: { turns: 42, tps: 4.67 },
		}));
		const overrides = (saveSolve as jest.Mock).mock.calls[0][7];
		expect(overrides.smart_turn_count).toBe(42);
	});
});
