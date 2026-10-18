// Hold to stop: the Magnet Timer's escape for a drop the slam detector missed (soft table,
// low sensitivity). In that input touch neither starts nor stops (feedback 1.6-c, the hand
// placing or grabbing the cube brushes the screen all the time), so the escape has to be
// something a brush never is: one finger, held still, for a full second, while a solve runs.
//
// Pure rules only (no DOM, no timers): KeyWatcher owns the touch listeners and the timeout,
// hold_stop_store.ts carries the press to the progress bar.

/** How long the finger must stay down. */
export const HOLD_STOP_MS = 1000;

/** How far the finger may drift (CSS px, straight line) before the hold is dropped. */
export const HOLD_STOP_SLOP_PX = 10;

export interface HoldStopStartInput {
	/** A solve is running (timeStartedAt set). Idle and inspection never hold-stop. */
	solving: boolean;
	/** Fingers on the screen after this touchstart. A second finger is not a still press. */
	touchCount: number;
	/** classifyTouchTarget: a button or a region that owns its touches. */
	blocked: boolean;
	/** classifyTouchTarget: inside the timer subtree. */
	insideTimer: boolean;
	/** Within a notch strip of the edge drawers. */
	inEdgeZone: boolean;
	/** Within the touch guard after the magnet's own start (the grabbing hand). */
	guardedAfterMagnet: boolean;
}

export function canBeginHoldStop(input: HoldStopStartInput): boolean {
	return (
		input.solving &&
		input.touchCount === 1 &&
		!input.blocked &&
		input.insideTimer &&
		!input.inEdgeZone &&
		!input.guardedAfterMagnet
	);
}

/**
 * Whether the finger left the spot it pressed. Distance is the same in the rotated reader's
 * frame (reversed use), so physical coordinates are fine here.
 */
export function holdStopMoved(
	start: { x: number; y: number },
	x: number,
	y: number,
	slopPx: number = HOLD_STOP_SLOP_PX
): boolean {
	return Math.hypot(x - start.x, y - start.y) > slopPx;
}

/**
 * Longest gap between the touch event's own timestamp and the handler running that is still
 * trusted as input lag (WKWebView IPC, a busy main thread).
 */
export const HOLD_STOP_MAX_EVENT_LAG_MS = 200;

/**
 * When the press began, on the Date.now() clock. The event timestamp is
 * performance.timeOrigin + e.timeStamp, a monotonic clock that stops while the phone sleeps:
 * on a page kept open across screen locks it falls behind Date.now() by the time slept. A
 * stamp that far back would complete the hold the moment a finger lands (and clamp the
 * stop to the solve's first millisecond), so beyond a plausible input lag the handler's own
 * time is used instead.
 */
export function holdStopPressedAt(eventTs: number, now: number): number {
	const lag = now - eventTs;
	return Number.isFinite(lag) && lag >= 0 && lag <= HOLD_STOP_MAX_EVENT_LAG_MS ? eventTs : now;
}

/** 0..1 share of the hold already done. */
export function holdStopProgress(pressedAt: number, now: number, holdMs: number = HOLD_STOP_MS): number {
	if (!(holdMs > 0)) return 1;
	const p = (now - pressedAt) / holdMs;
	if (!Number.isFinite(p) || p <= 0) return 0;
	return p >= 1 ? 1 : p;
}

/** Milliseconds left until the hold completes (0 when it already has). */
export function holdStopRemainingMs(pressedAt: number, now: number, holdMs: number = HOLD_STOP_MS): number {
	return Math.max(0, pressedAt + holdMs - now);
}

/**
 * The time the solve is recorded to end at: the moment the press began, which is closer to
 * the real finish than the end of the hold. Never at or before the solve's own start.
 */
export function holdStopTimestamp(pressedAt: number, solveStartedAt: number): number {
	return Math.max(pressedAt, solveStartedAt + 1);
}
