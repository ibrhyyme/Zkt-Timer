let mockAndroid = true;
let mockReversed = false;

jest.mock('../../../../../util/platform', () => ({
	isAndroidNative: () => mockAndroid,
	updateGestureExclusion: jest.fn(),
	clearGestureExclusion: jest.fn(),
}));
jest.mock('../../../../../util/reversed-ui', () => ({
	isUiReversed: () => mockReversed,
}));

import {updateGestureExclusion, clearGestureExclusion} from '../../../../../util/platform';
import {planEdgeExclusion, resetEdgeNotchesForTests, setEdgeNotch} from '../gesture_exclusion';

const update = updateGestureExclusion as jest.Mock;
const clear = clearGestureExclusion as jest.Mock;

// node env: stand in for the <body> class observer.
let classChanged: (() => void) | null = null;
class FakeObserver {
	constructor(cb: () => void) {
		classChanged = cb;
	}
	observe() {}
	disconnect() {
		classChanged = null;
	}
}

beforeAll(() => {
	(global as any).MutationObserver = FakeObserver;
	(global as any).document = {body: {}};
});

afterAll(() => {
	delete (global as any).MutationObserver;
	delete (global as any).document;
});

beforeEach(() => {
	mockAndroid = true;
	mockReversed = false;
	resetEdgeNotchesForTests();
	update.mockClear();
	clear.mockClear();
});

describe('planEdgeExclusion', () => {
	it('keeps each notch on its own edge when upright', () => {
		expect(planEdgeExclusion({left: 30, right: 60}, false)).toEqual({left: 30, right: 60});
	});

	it('swaps the edges and mirrors the height in reversed use', () => {
		expect(planEdgeExclusion({left: 30, right: 60}, true)).toEqual({left: 40, right: 70});
		expect(planEdgeExclusion({left: 30, right: null}, true)).toEqual({left: null, right: 70});
	});
});

describe('setEdgeNotch', () => {
	it('excludes each notch on its own edge and skips repeats', () => {
		setEdgeNotch('left', 30);
		setEdgeNotch('right', 60);
		setEdgeNotch('right', 60);
		expect(update.mock.calls).toEqual([
			['left', 30, 115],
			['right', 60, 115],
		]);
		expect(clear.mock.calls).toEqual([['right']]);
	});

	it('moves both rects when reversed use turns on and back off', () => {
		setEdgeNotch('left', 30);
		setEdgeNotch('right', 60);
		update.mockClear();

		mockReversed = true;
		classChanged!();
		expect(update.mock.calls).toEqual([
			['left', 40, 115],
			['right', 70, 115],
		]);

		update.mockClear();
		mockReversed = false;
		classChanged!();
		expect(update.mock.calls).toEqual([
			['left', 30, 115],
			['right', 60, 115],
		]);
	});

	it('does not let one drawer clear the edge the other now owns', () => {
		// Reversed: the left drawer's notch is on the physical right edge. Unmounting the
		// right drawer must clear the physical left edge only.
		mockReversed = true;
		setEdgeNotch('left', 30);
		setEdgeNotch('right', 60);
		clear.mockClear();
		update.mockClear();

		setEdgeNotch('right', null);
		expect(clear.mock.calls).toEqual([['left']]);
		expect(update).not.toHaveBeenCalled();
	});

	it('stops watching once both drawers are gone', () => {
		setEdgeNotch('left', 30);
		expect(classChanged).not.toBeNull();
		setEdgeNotch('left', null);
		expect(classChanged).toBeNull();
	});

	it('does nothing off Android', () => {
		mockAndroid = false;
		setEdgeNotch('left', 30);
		expect(update).not.toHaveBeenCalled();
		expect(clear).not.toHaveBeenCalled();
		expect(classChanged).toBeNull();
	});
});
