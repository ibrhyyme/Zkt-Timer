import { getSetting } from '../../../db/settings/query';
import { getTimerStore } from '../../../util/store/getTimer';
import { virtualCubeSupports } from '../../../util/virtual_cube/size';
import { ITimerContext } from '../Timer';

/**
 * Predicates the keyboard-ownership guards are built on.
 *
 * Two levels, because they gate different things:
 *
 *   virtualCubeSelected   mode-level. True whenever the virtual cube is the active
 *                         input for the current bucket. Gates Space, Escape and
 *                         touch, all of which the virtual cube handles itself.
 *
 *   virtualCubeOwnsKeyboard  true only once the cube is armed. Gates the letter,
 *                         digit and arrow shortcuts, which are ordinary app
 *                         shortcuts the rest of the time.
 *
 * Both read the settings and the Redux store directly rather than a React render
 * closure. That is the same rule KeyWatcher documents for itself: a keypress and
 * its release can both land before React swaps a listener's saved handler, so a
 * guard reading a stale closure would let a key through on exactly the frame it
 * matters.
 */

export function virtualCubeSelected(context: ITimerContext): boolean {
	if (getSetting('timer_type') !== 'virtual') return false;
	if (getSetting('manual_entry')) return false;
	return virtualCubeSupports(context.cubeType, context.scrambleSubset);
}

/**
 * True while the cube is armed, i.e. between Space and the end of the solve.
 *
 * This is the window where the move keys are live, and it is also the window
 * where `timeStartedAt` is still null — which is exactly the condition the app's
 * other shortcut handlers use to decide they are allowed to fire. Without this
 * guard, `d` writes a DNF onto the previous solve, `2` adds a +2 to it and
 * Backspace deletes it, all while the user thinks they are turning the cube.
 */
export function virtualCubeOwnsKeyboard(): boolean {
	return getSetting('timer_type') === 'virtual' && !!getTimerStore('virtualArmed');
}
