// The release rules KeyWatcher's keyupSpace / keydownSpace build on. The component itself
// cannot run under the node test environment, so the rules live in key_release.ts and are
// pinned here.

// timers.ts pulls in the Redux store through params; none of that is under test.
jest.mock('../params', () => ({ setTimerParams: jest.fn() }));

import {
	cancelPendingRelease,
	deferRelease,
	deferredReleaseStart,
	hasPendingRelease,
	PendingRelease,
	RELEASE_GRACE_MS,
	releaseEndsStopBlock,
	releaseOutlivedByStart,
	shouldDeferKeyRelease,
	SPACE_KEY_CODE,
} from '../key_release';
import { stopAllTimers } from '../timers';

const KEY_A = 65;
const KEY_S = 83;

describe('releaseEndsStopBlock', () => {
	it('ends on the release of the key that stopped the timer', () => {
		expect(releaseEndsStopBlock(false, KEY_A, KEY_A)).toBe(true);
		expect(releaseEndsStopBlock(false, SPACE_KEY_CODE, SPACE_KEY_CODE)).toBe(true);
	});

	it('does not end when an unrelated key comes up while the stopping key is still held', () => {
		// Stopped with Space, some other key released: Space is still down.
		expect(releaseEndsStopBlock(false, KEY_A, SPACE_KEY_CODE)).toBe(false);
		expect(releaseEndsStopBlock(false, KEY_S, KEY_A)).toBe(false);
	});

	it('ends on a Space release whatever key stopped the timer', () => {
		// Otherwise a solve stopped with another key whose keyup got lost would keep
		// swallowing Space presses.
		expect(releaseEndsStopBlock(false, SPACE_KEY_CODE, KEY_A)).toBe(true);
		expect(releaseEndsStopBlock(false, SPACE_KEY_CODE, null)).toBe(true);
	});

	it('ends on a finger release, as every touch release always did', () => {
		expect(releaseEndsStopBlock(true, undefined, SPACE_KEY_CODE)).toBe(true);
	});
});

describe('releaseOutlivedByStart', () => {
	it('spends the hold when the solve is already running under it', () => {
		// Inspection auto-start: the countdown ran out while Space (or the finger) was
		// still down. The release must start nothing, or it opens a fresh inspection on
		// top of the running solve.
		expect(releaseOutlivedByStart({primed: true, solveRunning: true})).toBe(true);
	});

	it('leaves an ordinary release alone', () => {
		expect(releaseOutlivedByStart({primed: true, solveRunning: false})).toBe(false);
	});

	it('says nothing about a release with no hold behind it', () => {
		expect(releaseOutlivedByStart({primed: false, solveRunning: true})).toBe(false);
		expect(releaseOutlivedByStart({primed: false, solveRunning: false})).toBe(false);
	});
});

describe('shouldDeferKeyRelease', () => {
	const primedSpace = {
		enabled: true,
		touch: false,
		keyCode: SPACE_KEY_CODE,
		primed: true,
		stopKeyHeld: false,
	};

	it('holds back a primed Space release while the setting is on', () => {
		expect(shouldDeferKeyRelease(primedSpace)).toBe(true);
	});

	it('never holds anything back with the setting off', () => {
		expect(shouldDeferKeyRelease({ ...primedSpace, enabled: false })).toBe(false);
		expect(shouldDeferKeyRelease({ ...primedSpace, enabled: false, stopKeyHeld: true })).toBe(false);
	});

	it('never holds back a touch release', () => {
		expect(shouldDeferKeyRelease({ ...primedSpace, touch: true, keyCode: undefined })).toBe(false);
	});

	it('never holds back another key', () => {
		expect(shouldDeferKeyRelease({ ...primedSpace, keyCode: KEY_A })).toBe(false);
	});

	it('holds back Space while the press that stopped the solve is still down', () => {
		// Holding Space after the stop produces the same repeat pairs. Without the wait the
		// first keyup would lift the stop block and its keydown would prime a new solve.
		expect(shouldDeferKeyRelease({ ...primedSpace, primed: false, stopKeyHeld: true })).toBe(true);
	});

	it('lets a release with nothing to act on through at once', () => {
		expect(shouldDeferKeyRelease({ ...primedSpace, primed: false, stopKeyHeld: false })).toBe(false);
	});
});

describe('deferredReleaseStart', () => {
	it('starts a key release from the moment the key came up', () => {
		expect(deferredReleaseStart({ releasedAtMs: 1_000 })).toBe(1_000);
	});

	it('prefers the event timestamp when the caller had one', () => {
		expect(deferredReleaseStart({ releasedAtMs: 1_000, eventTimestamp: 990 })).toBe(990);
	});
});

// Jest's modern fake timers cannot install on this Node (global.performance is read-only),
// so the grace window runs on a small hand-rolled clock instead.
let clock = 0;
let nextTimerId = 1;
let queued: { id: number; at: number; fn: () => void }[] = [];

function advanceTimersByTime(ms: number) {
	const until = clock + ms;
	for (;;) {
		const due = queued.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
		if (!due) break;
		queued = queued.filter((t) => t !== due);
		clock = due.at;
		due.fn();
	}
	clock = until;
}

describe('the grace window', () => {
	beforeEach(() => {
		clock = 0;
		queued = [];
		jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
			const id = nextTimerId++;
			queued.push({ id, at: clock + (ms || 0), fn });
			return id;
		}) as any);
		const clear = ((id: number) => {
			queued = queued.filter((t) => t.id !== id);
		}) as any;
		jest.spyOn(global, 'clearTimeout').mockImplementation(clear);
		jest.spyOn(global, 'clearInterval').mockImplementation(clear);
	});

	afterEach(() => {
		stopAllTimers();
		jest.restoreAllMocks();
	});

	it('lets a real release through once the window has passed, with its original instant', () => {
		const complete = jest.fn();
		deferRelease({ releasedAtMs: 1_000 }, complete);
		expect(hasPendingRelease()).toBe(true);

		advanceTimersByTime(RELEASE_GRACE_MS - 1);
		expect(complete).not.toHaveBeenCalled();

		advanceTimersByTime(1);
		expect(complete).toHaveBeenCalledTimes(1);
		expect(complete).toHaveBeenCalledWith({ releasedAtMs: 1_000 });
		// Not pending any more by the time the release runs.
		expect(hasPendingRelease()).toBe(false);
	});

	it.each([10, 20, 30])('drops the release when the repeat keydown lands %i ms after it', (gap) => {
		const complete = jest.fn();
		deferRelease({ releasedAtMs: 1_000 }, complete);

		advanceTimersByTime(gap);
		expect(cancelPendingRelease()).toBe(true);

		advanceTimersByTime(1_000);
		expect(complete).not.toHaveBeenCalled();
		expect(hasPendingRelease()).toBe(false);
	});

	it('rides out a held key\'s whole run of repeat pairs and starts from the real release', () => {
		const complete = jest.fn();
		let now = 0;

		// A tool forwarding auto-repeat: keyup + keydown 10 ms apart, every 33 ms.
		for (let pair = 0; pair < 20; pair++) {
			now += 23;
			advanceTimersByTime(23);
			deferRelease({ releasedAtMs: now }, complete);

			now += 10;
			advanceTimersByTime(10);
			expect(cancelPendingRelease()).toBe(true);
		}

		// The finger really comes up: no keydown follows.
		const releasedAtMs = now + 50;
		advanceTimersByTime(50);
		deferRelease({ releasedAtMs }, complete);
		advanceTimersByTime(RELEASE_GRACE_MS);

		expect(complete).toHaveBeenCalledTimes(1);
		expect(complete).toHaveBeenCalledWith({ releasedAtMs });
	});

	it('keeps the first release when another arrives while it is pending', () => {
		const complete = jest.fn();
		const first: PendingRelease = { releasedAtMs: 1_000 };
		deferRelease(first, complete);

		advanceTimersByTime(15);
		deferRelease({ releasedAtMs: 1_015 }, complete);

		advanceTimersByTime(RELEASE_GRACE_MS);
		expect(complete).toHaveBeenCalledTimes(1);
		expect(complete).toHaveBeenCalledWith(first);
	});

	it('has nothing to cancel when no release is pending', () => {
		expect(hasPendingRelease()).toBe(false);
		expect(cancelPendingRelease()).toBe(false);
	});

	it('is dropped by stopAllTimers along with every other timer', () => {
		const complete = jest.fn();
		deferRelease({ releasedAtMs: 1_000 }, complete);

		stopAllTimers();
		expect(hasPendingRelease()).toBe(false);

		advanceTimersByTime(RELEASE_GRACE_MS * 2);
		expect(complete).not.toHaveBeenCalled();
	});
});
