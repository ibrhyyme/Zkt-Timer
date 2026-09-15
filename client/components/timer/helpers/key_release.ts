import { getTimer, setTimer, stopTimer, RELEASE_GRACE_TIMEOUT } from './timers';

// What a key release means to the keyboard timer (KeyWatcher's keyupSpace). Kept out of
// the component so the rules can be tested without a DOM.

export const SPACE_KEY_CODE = 32;

/**
 * Whether a release ends the "the press that stopped the timer is still down" block
 * (KeyWatcher's stopKeyHeldRef).
 *
 * It used to end on any keyup, so letting go of some unrelated key while the stopping
 * key was still held re-opened priming under a key that had never come up. Three
 * releases count now: the key that stopped the timer, Space (the priming key, so a
 * solve stopped with another key never costs more than one swallowed Space press), and
 * a finger, which is what every touch release did before as well.
 */
export function releaseEndsStopBlock(touch: boolean, keyCode: number | undefined, stopKeyCode: number | null): boolean {
	return touch || keyCode === SPACE_KEY_CODE || (stopKeyCode !== null && keyCode === stopKeyCode);
}

/**
 * Remote-input compatibility (the `remote_input_compat` setting): how long a keyboard
 * Space release is held back before it counts.
 *
 * Remote desktop and streaming tools can forward a held key's auto-repeat as keyup +
 * keydown pairs, without `repeat: true` on the keydown. To the timer each pair reads as a
 * release (start the solve) followed by a fresh press (stop it), so holding Space through
 * such a tool starts and stops the timer by itself.
 *
 * With the setting on, a Space press that lands inside this window after a release is
 * that repeat, not the user: the pair is dropped and the hold carries on. Otherwise the
 * release goes through with its original instant, so the recorded time does not grow by
 * the wait. Off by default, because it delays every start by this much and nobody on a
 * local keyboard should pay for that.
 */
export const RELEASE_GRACE_MS = 40;

export interface PendingRelease {
	/** Date.now() when the key came up. */
	releasedAtMs: number;
	/** The event's own timestamp, when the caller had one. */
	eventTimestamp?: number;
}

export interface DeferKeyReleaseInput {
	/** The remote_input_compat setting. */
	enabled: boolean;
	touch: boolean;
	keyCode: number | undefined;
	/** A hold is priming the timer (spaceTimerStarted is set). */
	primed: boolean;
	/** The press that just stopped the timer is still down (stopKeyHeldRef). */
	stopKeyHeld: boolean;
}

/**
 * Whether a release has to wait out the grace window before it counts.
 *
 * Only a keyboard Space release, and only while it has something to act on: a primed
 * hold, or the press that stopped the solve still being down. The second case matters
 * as much as the first. Holding Space after stopping produces the same pairs, and
 * without the wait the first pair's keyup would lift the stop block and its keydown
 * would prime the next solve under a key that never came up.
 *
 * Touch never waits: no remote tool turns a finger into repeat pairs.
 */
export function shouldDeferKeyRelease(input: DeferKeyReleaseInput): boolean {
	return (
		input.enabled &&
		!input.touch &&
		input.keyCode === SPACE_KEY_CODE &&
		(input.primed || input.stopKeyHeld)
	);
}

/** The instant a deferred release starts the solve from: when the key came up. */
export function deferredReleaseStart(pending: PendingRelease): number {
	return pending.eventTimestamp ?? pending.releasedAtMs;
}

/** Whether a release is waiting out the grace window. */
export function hasPendingRelease(): boolean {
	return !!getTimer(RELEASE_GRACE_TIMEOUT);
}

/**
 * Holds a release back for RELEASE_GRACE_MS, then hands it to `complete`.
 *
 * The timer lives in the shared registry, so stopAllTimers drops it with the rest, and
 * it is the only record of a pending release: there is no second flag that could
 * disagree with it. A second release while one is pending changes nothing, because the
 * first one is when the key really came up.
 */
export function deferRelease(pending: PendingRelease, complete: (pending: PendingRelease) => void): void {
	if (hasPendingRelease()) {
		return;
	}

	setTimer(
		RELEASE_GRACE_TIMEOUT,
		setTimeout(() => {
			// Cleared first, so nothing the release goes on to do can see it as pending
			stopTimer(RELEASE_GRACE_TIMEOUT);
			complete(pending);
		}, RELEASE_GRACE_MS)
	);
}

/** Drops a pending release without running it. Returns whether there was one. */
export function cancelPendingRelease(): boolean {
	if (!hasPendingRelease()) {
		return false;
	}

	stopTimer(RELEASE_GRACE_TIMEOUT);
	return true;
}
