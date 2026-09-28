import {
	getLastMagnetActionAt,
	magnetOwnsTouchStart,
	markMagnetAction,
	MagnetTouchInput,
	resetMagnetActionForTests,
	shouldCancelHoldOnPlacement,
	touchGuardedAfterMagnet,
} from '../touch_guard';
import { TOUCH_GUARD_AFTER_MAGNET_MS } from '../config';
import type { DetectorEvent } from '../types';

function input(over: Partial<MagnetTouchInput> = {}): MagnetTouchInput {
	return { active: true, testMode: false, phase: 'far', hint: 'none', delta: 2, farMax: 80, ...over };
}

describe('magnetOwnsTouchStart', () => {
	it.each([
		['the cube rests at the hot spot', { phase: 'near' as const }, true],
		['the cube is being lifted', { phase: 'lifting' as const }, true],
		['the cube is approaching (far, inside the magnet reach)', { phase: 'far' as const, delta: 120 }, true],
		['exactly at the reach', { phase: 'far' as const, delta: 80 }, true],
		['the cube is away', { phase: 'far' as const, delta: 3 }, false],
		['a cube resting a few cm off the hot spot', { phase: 'far' as const, hint: 'closer' as const, delta: 120 }, false],
		['no reading yet', { phase: 'far' as const, delta: null }, false],
		['the baseline is unknown (touch is the fallback)', { phase: 'unknown' as const, delta: 400 }, false],
		['the sensor is unsupported', { phase: 'unsupported' as const }, false],
		['the stream is off (solving, disabled)', { active: false, phase: 'near' as const }, false],
		['the settings panel is open', { testMode: true, phase: 'near' as const }, false],
	])('%s -> %s', (_label, over, expected) => {
		expect(magnetOwnsTouchStart(input(over))).toBe(expected);
	});

	it('is false without a magnet at all', () => {
		expect(magnetOwnsTouchStart(null)).toBe(false);
	});
});

describe('touchGuardedAfterMagnet', () => {
	const ms = TOUCH_GUARD_AFTER_MAGNET_MS;
	it.each([
		['no magnet action yet', null, 1000, false],
		['a touch timestamped during the lift (before the action)', 1000, 950, true],
		['at the action', 1000, 1000, true],
		['just inside the guard', 1000, 1000 + ms - 1, true],
		['at the end of the guard', 1000, 1000 + ms, false],
		['long after', 1000, 60_000, false],
	])('%s', (_label, last, now, expected) => {
		expect(touchGuardedAfterMagnet(last as number | null, now as number, ms)).toBe(expected);
	});
});

describe('shouldCancelHoldOnPlacement', () => {
	const fresh: DetectorEvent = { type: 'near', t: 1, delta: 490, replaced: false, farSince: 0 };
	const replaced: DetectorEvent = { type: 'near', t: 1, delta: 470, replaced: true, farSince: null };

	it('drops a hold primed by the palm that placed the cube', () => {
		expect(shouldCancelHoldOnPlacement([fresh], true, false)).toBe(true);
	});

	it('leaves everything else alone', () => {
		expect(shouldCancelHoldOnPlacement([fresh], false, false)).toBe(false);
		expect(shouldCancelHoldOnPlacement([replaced], true, false)).toBe(false);
		expect(shouldCancelHoldOnPlacement([fresh], true, true)).toBe(false);
		expect(shouldCancelHoldOnPlacement([], true, false)).toBe(false);
	});
});

describe('magnet action clock', () => {
	afterEach(() => resetMagnetActionForTests());

	it('remembers the last magnet action', () => {
		expect(getLastMagnetActionAt()).toBeNull();
		markMagnetAction(1234);
		expect(getLastMagnetActionAt()).toBe(1234);
	});
});
