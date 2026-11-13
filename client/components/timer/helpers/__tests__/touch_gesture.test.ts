import { isCancelSwipe, isEdgeSwipe, SWIPE_UP_CANCEL_PX, EDGE_SWIPE_ZONE_PX, EDGE_SWIPE_MIN_PX } from '../touch_gesture';
import { orientDelta } from '../../../../util/reversed-ui';

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

describe('isCancelSwipe on the reversed (180°) timer', () => {
	// The phone lies upside down: the reader's "up" is physically down the screen.
	const cancel = (dx: number, dy: number) => isCancelSwipe(...orientDelta(dx, dy, true));

	it('cancels on a physical downward swipe, which is up for the reader', () => {
		expect(cancel(0, OVER)).toBe(true);
	});

	it('never cancels on a physical upward swipe, which is down for the reader', () => {
		expect(cancel(0, -200)).toBe(false);
	});
});

describe('isEdgeSwipe', () => {
	// A phone in portrait: the side menus open from the physical left and right edges.
	const W = 390;
	const IN = EDGE_SWIPE_MIN_PX + 10;

	it('a swipe in from beside the right notch is a reach for the menu', () => {
		expect(isEdgeSwipe(W - 40, -IN, 5, W)).toBe(true);
	});

	it('a swipe in from beside the left notch is a reach for the menu', () => {
		expect(isEdgeSwipe(40, IN, -5, W)).toBe(true);
	});

	it('moving towards the edge is not a reach for the menu', () => {
		expect(isEdgeSwipe(W - 40, IN, 0, W)).toBe(false);
		expect(isEdgeSwipe(40, -IN, 0, W)).toBe(false);
	});

	it('a press in the middle of the screen never counts, however far it slides', () => {
		expect(isEdgeSwipe(W / 2, -200, 0, W)).toBe(false);
		expect(isEdgeSwipe(W / 2, 200, 0, W)).toBe(false);
	});

	it('only presses inside the edge band count', () => {
		expect(isEdgeSwipe(EDGE_SWIPE_ZONE_PX - 1, IN, 0, W)).toBe(true);
		expect(isEdgeSwipe(EDGE_SWIPE_ZONE_PX, IN, 0, W)).toBe(false);
	});

	it('ignores the jitter of a thumb resting near the edge', () => {
		expect(isEdgeSwipe(W - 30, -6, 3, W)).toBe(false);
		expect(isEdgeSwipe(30, EDGE_SWIPE_MIN_PX, 0, W)).toBe(false);
	});

	it('a mostly vertical movement near the edge is not a menu swipe', () => {
		expect(isEdgeSwipe(W - 30, -IN, -(IN + 20), W)).toBe(false);
	});
});
