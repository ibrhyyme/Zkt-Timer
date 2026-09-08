import { useEffect } from 'react';

import { AllSettings } from '../../../db/settings/query';
import { setSetting } from '../../../db/settings/update';
import { useSettings } from '../../../util/hooks/useSettings';
import { virtualCubeSupports } from '../../../util/virtual_cube/size';
import { is3x3CubeType } from './util';

/**
 * Which timer inputs work on which puzzles, in one place.
 *
 * Only two inputs care about the puzzle at all:
 *   smart    reads a physical 3x3 over Bluetooth
 *   virtual  draws an NxN cube and only implements NxN
 *
 * Everything else measures wall-clock time and works on anything, so the table is
 * deliberately short rather than exhaustive.
 *
 * This used to be a predicate copy-pasted into both pickers, still named
 * `smartUnsupported` in both even after it grew a virtual-cube clause. One copy
 * meant the two pickers could disagree, and they did.
 */
export function timerTypeSupportsBucket(
	type: AllSettings['timer_type'],
	cubeType: string | null | undefined,
	scrambleSubset?: string | null
): boolean {
	if (type === 'smart') {
		return is3x3CubeType(cubeType, scrambleSubset);
	}
	if (type === 'virtual') {
		return virtualCubeSupports(cubeType, scrambleSubset);
	}
	return true;
}

/** The i18n key explaining why an input is unavailable, or null when it is available. */
export function timerTypeUnsupportedReason(
	type: AllSettings['timer_type'],
	cubeType: string | null | undefined,
	scrambleSubset?: string | null
): string | null {
	if (timerTypeSupportsBucket(type, cubeType, scrambleSubset)) {
		return null;
	}
	return type === 'virtual'
		? 'room_timer.virtual_cube_nxn_only'
		: 'room_timer.smart_cube_3x3_only';
}

/**
 * Reset the stored input to the keyboard when the current puzzle does not support it.
 *
 * This is a state change, not a render-time override, and that is the whole point.
 * Previously every consumer evaluated `timerType === 'smart' && supported` on its
 * own while the SETTING stayed 'smart'. The mobile picker computes "is this card
 * active" per card with no aggregate fallback, so with the setting on an
 * unsupported value every card evaluated false and the drawer showed nothing
 * selected at all. The desktop picker hid the same bug behind a `?? options[0]`
 * that happened to land on keyboard.
 *
 * An effect rather than a hook into the cube-type setter, because there is no
 * single setter: the header picker, the mobile cube picker and the settings screen
 * all write cube_type or scramble_subset, and the settings screen can also write an
 * unsupported timer_type directly.
 *
 * @param onBeforeReset runs before the setting is written. Rooms pass their own
 *   smart-cube disconnect here; the timer page needs nothing, because SmartCube
 *   unmounts as soon as the setting changes and disconnects in its own cleanup.
 */
export function useNormalizeTimerType(
	cubeType: string | null | undefined,
	scrambleSubset: string | null | undefined,
	onBeforeReset?: () => void
): void {
	// Subscribed rather than read once: the input can be changed from the header
	// picker, the mobile drawer or the settings screen, and the reset has to run
	// whichever of them wrote it.
	const timerType = useSettings('timer_type');

	useEffect(() => {
		if (!cubeType) return;
		if (timerType === 'keyboard') return;
		if (timerTypeSupportsBucket(timerType, cubeType, scrambleSubset)) return;

		onBeforeReset?.();
		setSetting('timer_type', 'keyboard');
		// onBeforeReset is intentionally not a dependency: callers pass an inline
		// closure, and re-running on its identity would fire the reset repeatedly.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cubeType, scrambleSubset, timerType]);
}

/**
 * Map a room's stored allow-list onto current timer types.
 *
 * Rooms persist their allow-list, and rooms created before StackMat and QYtoys
 * were merged still carry `qiyiwired`. Without this, a room that allowed only
 * QYtoys would show the merged wired card as forbidden. Rewriting the stored rows
 * would be the other option; mapping on read leaves old rooms untouched.
 */
export function normalizeAllowedTimerTypes(allowed?: string[] | null): string[] | null {
	if (!allowed) return allowed ?? null;
	const mapped = allowed.map((type) => (type === 'qiyiwired' ? 'stackmat' : type));
	return Array.from(new Set(mapped));
}
