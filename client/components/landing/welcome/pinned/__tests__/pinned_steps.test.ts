import {
	stepOffset,
	inPinnedRange,
	lastOffset,
	nearestStep,
	needsSettle,
	snapAction,
	SnapGeometry,
} from '../pinned_steps';

// Six steps, pinned from y=1000, one 800px screen each: steps at 1000..5000.
const g: SnapGeometry = {start: 1000, step: 800, count: 6};

describe('pinned step geometry', () => {
	it('places one step per screen of scroll', () => {
		expect(stepOffset(g, 0)).toBe(1000);
		expect(stepOffset(g, 3)).toBe(3400);
		expect(lastOffset(g)).toBe(5000);
	});

	it('finds the nearest step and clamps at both ends', () => {
		expect(nearestStep(g, 1399)).toBe(0);
		expect(nearestStep(g, 1401)).toBe(1);
		expect(nearestStep(g, -500)).toBe(0);
		expect(nearestStep(g, 99999)).toBe(5);
		expect(nearestStep({...g, step: 0}, 3000)).toBe(0);
	});

	it('is pinned from the first step to the last, with rounding slack', () => {
		expect(inPinnedRange(g, 997)).toBe(false);
		expect(inPinnedRange(g, 999)).toBe(true);
		expect(inPinnedRange(g, 5001)).toBe(true);
		expect(inPinnedRange(g, 5003)).toBe(false);
	});

	it('settles only between steps, never at the ends', () => {
		expect(needsSettle(g, 1800)).toBe(false); // on step 1
		expect(needsSettle(g, 2100)).toBe(true);
		expect(needsSettle(g, 1001)).toBe(false); // leaving upwards
		expect(needsSettle(g, 4999)).toBe(false); // leaving downwards
	});
});

describe('snapAction', () => {
	const base = {g, dir: 1 as const, active: 1, engaged: true, locked: false};

	it('lets the page scroll outside the scene', () => {
		expect(snapAction({...base, y: 400})).toEqual({type: 'pass'});
		expect(snapAction({...base, y: 6000})).toEqual({type: 'pass'});
	});

	it('moves one step per tick', () => {
		expect(snapAction({...base, y: 1800})).toEqual({type: 'go', index: 2});
		expect(snapAction({...base, y: 1800, dir: -1})).toEqual({type: 'go', index: 0});
	});

	it('swallows the rest of a gesture while a step plays out', () => {
		expect(snapAction({...base, y: 1800, locked: true})).toEqual({type: 'block'});
	});

	it('releases the page past either end', () => {
		expect(snapAction({...base, y: 5000, active: 5})).toEqual({type: 'pass'});
		expect(snapAction({...base, y: 1000, active: 0, dir: -1})).toEqual({type: 'pass'});
	});

	it('settles on the nearest step when the visitor scrolls in, without skipping it', () => {
		// Coming down from the hero, a little past the pin point: step 0, not 1.
		expect(snapAction({...base, y: 1040, active: 0, engaged: false})).toEqual({type: 'go', index: 0});
		// Even exactly on the pin point, the first tick only settles.
		expect(snapAction({...base, y: 1000, active: 0, engaged: false})).toEqual({type: 'go', index: 0});
		// Coming back up from below: the last step.
		expect(snapAction({...base, y: 4960, active: 0, engaged: false, dir: -1})).toEqual({type: 'go', index: 5});
	});
});
