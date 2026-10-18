/**
 * endTimer holds a module-level lock from the stop until its deferred save has run, so a
 * second stop in between (a double tap, a hardware timer echoing the stop) is ignored.
 * The lock has to come off even when that work throws: left set, it refused every later
 * stop until the page was reloaded.
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

import { endTimer, startTimer } from '../events';
import { saveSolve } from '../save';
import { setTimerParams } from '../params';
import { clearInspectionTimers } from '../timers';
import { consumePreGeneratedScramble, preGenerateScramble, resetScramble } from '../scramble';

const STARTED_AT = 10_000;
const STOPPED_AT = 20_000;

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
		smartTurns: [],
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

/** Runs the deferred stop work and what it defers in turn: the save follows the scramble a paint later. */
function runDeferredSave() {
	const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
		deferred.push(fn);
		return 0;
	}) as any);
	try {
		while (deferred.length) {
			const queued = deferred;
			deferred = [];
			queued.forEach((fn) => fn());
		}
	} finally {
		spy.mockRestore();
	}
}

/** How many stops got as far as resetting the timer, i.e. were not refused by the lock. */
function stopsTaken(): number {
	return (setTimerParams as jest.Mock).mock.calls.filter(
		([params]) => params && params.solving === false && params.timeStartedAt === null
	).length;
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
	Object.assign(mockSettings, {
		timer_type: 'keyboard',
		use_space_with_smart_cube: false,
		scramble_top_color: null,
		multi_phase_count: 1,
	});
});

afterEach(() => {
	// A test that left a save queued would leave the module-level lock set for the next.
	try {
		runDeferredSave();
	} catch {
		// Only the lock matters here; the tests assert on their own errors.
	}
	dateNowSpy.mockRestore();
});

describe('endTimer lock', () => {
	it('refuses a second stop while the first one is still saving', () => {
		stop(timerContext());
		stop(timerContext());
		expect(stopsTaken()).toBe(1);

		runDeferredSave();
		expect(saveSolve).toHaveBeenCalledTimes(1);
	});

	it('takes the next stop once the save has run', () => {
		stop(timerContext());
		runDeferredSave();

		seedStore();
		stop(timerContext());
		expect(stopsTaken()).toBe(2);
	});

	it('comes off when the save throws, so the next solve can still be stopped', () => {
		(saveSolve as jest.Mock).mockImplementationOnce(() => {
			throw new Error('save failed');
		});

		stop(timerContext());
		// The failure is not swallowed.
		expect(() => runDeferredSave()).toThrow('save failed');

		seedStore();
		stop(timerContext());
		expect(stopsTaken()).toBe(2);

		runDeferredSave();
		expect(saveSolve).toHaveBeenCalledTimes(2);
	});

	it('comes off when the stop throws before the save is scheduled', () => {
		(clearInspectionTimers as jest.Mock).mockImplementationOnce(() => {
			throw new Error('cleanup failed');
		});

		expect(() => stop(timerContext())).toThrow('cleanup failed');
		// Nothing was queued that could have released it later.
		expect(deferred).toHaveLength(0);

		seedStore();
		stop(timerContext());
		expect(stopsTaken()).toBe(1);

		runDeferredSave();
		expect(saveSolve).toHaveBeenCalledTimes(1);
	});
});

describe('next scramble before the save', () => {
	/** Runs only the step endTimer deferred, not what that step defers in turn. */
	function runFirstStep() {
		const queued = deferred;
		deferred = [];
		const spy = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
			deferred.push(fn);
			return 0;
		}) as any);
		try {
			queued.forEach((fn) => fn());
		} finally {
			spy.mockRestore();
		}
	}

	it('shows the pre-generated scramble a step before the save re-renders the modules', () => {
		(consumePreGeneratedScramble as jest.Mock).mockReturnValueOnce("F R U' R'");
		stop(timerContext());

		runFirstStep();
		expect(mockStore.scramble).toBe("F R U' R'");
		expect(saveSolve).not.toHaveBeenCalled();

		runDeferredSave();
		expect(saveSolve).toHaveBeenCalledTimes(1);
		// The solve keeps the scramble it was done with.
		expect((saveSolve as jest.Mock).mock.calls[0][2]).toBe("R U R' U'");
	});

	it('still saves the solve when the next scramble cannot be made', () => {
		(resetScramble as jest.Mock).mockImplementationOnce(() => {
			throw new Error('no scramble');
		});
		stop(timerContext());

		expect(() => runFirstStep()).toThrow('no scramble');
		runDeferredSave();
		expect(saveSolve).toHaveBeenCalledTimes(1);

		seedStore();
		stop(timerContext());
		expect(stopsTaken()).toBe(2);
	});
});

describe('startTimer with a release instant', () => {
	// The remote-input grace window starts the solve 40 ms after the key came up and
	// hands startTimer the instant it did, so the wait never lands in the recorded time.
	it('starts from a recent instant rather than now', () => {
		startTimer(undefined, STOPPED_AT - 40);
		expect(mockStore.timeStartedAt).toEqual(new Date(STOPPED_AT - 40));
	});

	it('pre-generates for the subset the stop will ask for, also before one was picked this session', () => {
		Object.assign(mockSettings, { cube_type: 'wca', scramble_subset: '333' });
		delete mockStore.scrambleSubset;
		startTimer();
		expect(preGenerateScramble).toHaveBeenLastCalledWith('wca', '333', null);

		// A subset picked on the page is in the store, and wins like it does in the context.
		mockStore.scrambleSubset = '222';
		startTimer();
		expect(preGenerateScramble).toHaveBeenLastCalledWith('wca', '222', null);
	});

	it('falls back to now for an instant too old to trust', () => {
		startTimer(undefined, STOPPED_AT - 5_000);
		expect(mockStore.timeStartedAt).toEqual(new Date(STOPPED_AT));
	});
});
