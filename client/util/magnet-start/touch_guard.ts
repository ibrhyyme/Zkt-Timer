// Keeps the touch timer out of the way of magnet lift-to-start. The hand that places or
// lifts the cube passes right by the screen, and the touch path would otherwise:
// - start a solve when a palm rests on the screen for freeze_time while the cube is placed,
// - prime a hold during the lift, which makes the magnet refuse its own start,
// - stop a magnet-started solve at ~0.1 s when the grabbing hand brushes the screen.
//
// Contract: while the cube is at the hot spot, or is being placed or lifted, touch does not
// start anything (lift the cube instead); for a moment after any magnet action, timer touches
// are ignored. Everywhere else (baseline unknown, sensor unsupported, cube a few cm off the
// hot spot, cube away, settings panel open) touch works as it always did.
import type { DetectorEvent, DetectorPhase, MagnetHint } from './types';

export interface MagnetTouchInput {
	/** The native stream is running (the timer is idle or in inspection). */
	active: boolean;
	/** The settings panel runs the stream in test mode; the magnet takes no action then. */
	testMode: boolean;
	phase: DetectorPhase;
	hint: MagnetHint;
	/** |B - F| of the latest sample. */
	delta: number | null;
	farMax: number;
}

export function magnetOwnsTouchStart(input: MagnetTouchInput | null): boolean {
	if (!input || !input.active || input.testMode) return false;
	if (input.phase === 'near' || input.phase === 'lifting') return true;
	// Far but already inside the magnet's reach: the cube is on its way to the hot spot (or
	// just left it). A cube resting a few cm away settles as 'closer' and never starts
	// anything from there, so it must not lock touch out.
	return (
		input.phase === 'far' &&
		input.hint !== 'closer' &&
		input.delta !== null &&
		input.delta >= input.farMax
	);
}

/**
 * True while a touch lands within `guardMs` of the last magnet action. A touch timestamped
 * before the action (negative difference) began during the lift, so it is guarded too.
 */
export function touchGuardedAfterMagnet(lastActionAt: number | null, now: number, guardMs: number): boolean {
	return lastActionAt !== null && now - lastActionAt < guardMs;
}

/**
 * A palm that landed before the cube came within reach primed a touch hold. When the cube
 * then settles at the hot spot, that hold is the hand placing the cube, not a start.
 */
export function shouldCancelHoldOnPlacement(events: DetectorEvent[], primed: boolean, testMode: boolean): boolean {
	if (!primed || testMode) return false;
	return events.some((e) => e.type === 'near' && !e.replaced);
}

let lastMagnetActionAt: number | null = null;

export function markMagnetAction(t: number): void {
	lastMagnetActionAt = t;
}

export function getLastMagnetActionAt(): number | null {
	return lastMagnetActionAt;
}

export function resetMagnetActionForTests(): void {
	lastMagnetActionAt = null;
}
