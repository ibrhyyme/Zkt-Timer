import { isCancelSwipe, SWIPE_UP_CANCEL_PX } from '../touch_gesture';

// This gesture has been broken once already: a refactor swapped the upward-swipe test
// for an omnidirectional distance test, so lifting a finger with a few pixels of
// downward drift silently cancelled the solve. Direction is the whole contract, so it
// is pinned here.

const OVER = SWIPE_UP_CANCEL_PX + 10;

describe('isCancelSwipe', () => {
	it('cancels on a deliberate upward swipe', () => {
		expect(isCancelSwipe(0, -OVER)).toBe(true);
	});

	it('never cancels on downward movement, however far', () => {
		expect(isCancelSwipe(0, 200)).toBe(false);
	});

	it('never cancels on sideways movement, however far', () => {
		expect(isCancelSwipe(200, 0)).toBe(false);
		expect(isCancelSwipe(-200, 0)).toBe(false);
	});

	it('ignores the jitter of a hand resting on the screen', () => {
		expect(isCancelSwipe(3, -8)).toBe(false);
		expect(isCancelSwipe(-5, 5)).toBe(false);
	});

	it('needs more than the threshold, not exactly it', () => {
		expect(isCancelSwipe(0, -SWIPE_UP_CANCEL_PX)).toBe(false);
		expect(isCancelSwipe(0, -(SWIPE_UP_CANCEL_PX + 1))).toBe(true);
	});

	it('treats a mostly-sideways diagonal as a drag, not a cancel', () => {
		expect(isCancelSwipe(200, -OVER)).toBe(false);
		expect(isCancelSwipe(-200, -OVER)).toBe(false);
	});

	it('still cancels on a diagonal the swipe dominates', () => {
		expect(isCancelSwipe(10, -OVER)).toBe(true);
	});
});
