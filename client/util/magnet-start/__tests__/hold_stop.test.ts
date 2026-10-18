import {
	canBeginHoldStop,
	HOLD_STOP_MAX_EVENT_LAG_MS,
	HOLD_STOP_MS,
	HOLD_STOP_SLOP_PX,
	holdStopMoved,
	holdStopPressedAt,
	holdStopProgress,
	holdStopRemainingMs,
	holdStopTimestamp,
	HoldStopStartInput,
} from '../hold_stop';

const OK: HoldStopStartInput = {
	solving: true,
	touchCount: 1,
	blocked: false,
	insideTimer: true,
	inEdgeZone: false,
	guardedAfterMagnet: false,
};

describe('canBeginHoldStop', () => {
	it('starts on one still finger on the timer while a solve runs', () => {
		expect(canBeginHoldStop(OK)).toBe(true);
	});

	it('never starts while idle or in inspection (no solve running)', () => {
		expect(canBeginHoldStop({ ...OK, solving: false })).toBe(false);
	});

	it('refuses a second finger', () => {
		expect(canBeginHoldStop({ ...OK, touchCount: 2 })).toBe(false);
		expect(canBeginHoldStop({ ...OK, touchCount: 0 })).toBe(false);
	});

	it('leaves buttons, own-gesture regions and the outside of the timer alone', () => {
		expect(canBeginHoldStop({ ...OK, blocked: true })).toBe(false);
		expect(canBeginHoldStop({ ...OK, insideTimer: false })).toBe(false);
	});

	it('leaves the edge drawer notches alone', () => {
		expect(canBeginHoldStop({ ...OK, inEdgeZone: true })).toBe(false);
	});

	it('ignores the hand that just lifted the cube', () => {
		expect(canBeginHoldStop({ ...OK, guardedAfterMagnet: true })).toBe(false);
	});
});

describe('holdStopMoved', () => {
	const start = { x: 100, y: 200 };

	it('tolerates a few px of drift', () => {
		expect(holdStopMoved(start, 100, 200)).toBe(false);
		expect(holdStopMoved(start, 106, 208)).toBe(false); // exactly 10 px
	});

	it('drops the hold past the slop in any direction', () => {
		expect(holdStopMoved(start, 100 + HOLD_STOP_SLOP_PX + 1, 200)).toBe(true);
		expect(holdStopMoved(start, 100, 200 - HOLD_STOP_SLOP_PX - 1)).toBe(true);
		expect(holdStopMoved(start, 92, 192)).toBe(true); // diagonal, 11.3 px
	});

	it('takes a custom slop', () => {
		expect(holdStopMoved(start, 103, 200, 2)).toBe(true);
	});
});

describe('holdStopProgress / holdStopRemainingMs', () => {
	it('runs from 0 to 1 over the hold', () => {
		expect(holdStopProgress(1000, 1000)).toBe(0);
		expect(holdStopProgress(1000, 1000 + HOLD_STOP_MS / 2)).toBeCloseTo(0.5);
		expect(holdStopProgress(1000, 1000 + HOLD_STOP_MS)).toBe(1);
		expect(holdStopProgress(1000, 1000 + HOLD_STOP_MS * 3)).toBe(1);
	});

	it('clamps a clock that reads before the press', () => {
		expect(holdStopProgress(1000, 900)).toBe(0);
	});

	it('counts down what is left, never below zero', () => {
		expect(holdStopRemainingMs(1000, 1000)).toBe(HOLD_STOP_MS);
		expect(holdStopRemainingMs(1000, 1300)).toBe(HOLD_STOP_MS - 300);
		expect(holdStopRemainingMs(1000, 1000 + HOLD_STOP_MS + 50)).toBe(0);
	});

	it('is one second', () => {
		expect(HOLD_STOP_MS).toBe(1000);
	});
});

describe('holdStopTimestamp', () => {
	it('records the stop at the moment the press began', () => {
		expect(holdStopTimestamp(15_000, 3_000)).toBe(15_000);
	});

	it('never ends a solve at or before its start', () => {
		expect(holdStopTimestamp(3_000, 3_000)).toBe(3_001);
		expect(holdStopTimestamp(2_990, 3_000)).toBe(3_001);
	});
});

describe('holdStopPressedAt', () => {
	it('keeps the event time when it trails the handler by a plausible input lag', () => {
		expect(holdStopPressedAt(10_000, 10_000)).toBe(10_000);
		expect(holdStopPressedAt(10_000, 10_000 + HOLD_STOP_MAX_EVENT_LAG_MS)).toBe(10_000);
	});

	it('falls back to now when the monotonic clock fell behind (phone slept with the page open)', () => {
		// Without this the hold would complete the moment the finger lands.
		const now = 50_000;
		const pressedAt = holdStopPressedAt(now - 30_000, now);
		expect(pressedAt).toBe(now);
		expect(holdStopRemainingMs(pressedAt, now)).toBe(HOLD_STOP_MS);
	});

	it('falls back to now for a stamp from the future or not a number', () => {
		expect(holdStopPressedAt(10_500, 10_000)).toBe(10_000);
		expect(holdStopPressedAt(NaN, 10_000)).toBe(10_000);
	});
});
