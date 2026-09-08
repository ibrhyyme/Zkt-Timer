import { useEffect, useState } from 'react';

import { getSetting } from '../../db/settings/query';
import { useSettings } from '../hooks/useSettings';

/**
 * The cube's rendered side length in CSS pixels.
 *
 * The user's setting is a ceiling, not a promise. The cube is centred on the
 * screen with the time beside it, so an unclamped value overflows the row on a
 * narrow window and the cube gets cut off at the edge.
 *
 * The width allowance is deliberately generous: the time display is taken out of
 * the layout flow (it is positioned against the cube rather than sharing a track
 * with it), so the cube only has to leave room for the digits, not split the
 * screen with them.
 *
 * Shared by the cube itself and by the timer layout, which needs the same number
 * to place the digits beside it. Two copies of this arithmetic would drift.
 */
export function computeVirtualCubeSize(
	userSize: number,
	viewportW: number,
	viewportH: number,
	mobile: boolean,
	focus: boolean
): number {
	const size = userSize || 400;

	// Two sizes, because there are two screens.
	//
	// Idle, the cube is a companion to the timer: the scramble, the stats and the
	// solve list are all still there and the cube must not compete with them.
	// Armed or solving, the chrome is gone and the cube is the only thing left to
	// look at, so it takes the space that was freed.
	//
	// The setting scales both, so the slider still means "how big do you want it"
	// rather than picking one state over the other.
	if (focus) {
		return Math.floor(
			mobile
				? Math.min(size * 2, viewportH * 0.52, viewportW * 0.92)
				: Math.min(size * 2, viewportH * 0.78, viewportW * 0.46)
		);
	}

	// Idle. On mobile the cube is the thing that tells you which input you are on,
	// so it carries the screen and the clock shrinks to match (see TimeDisplay).
	// Driven off viewport HEIGHT first: short phones were the ones overflowing, and
	// a height-relative cap makes them self-limit instead of needing a special case.
	return Math.floor(
		mobile
			? Math.min(size * 0.85, viewportH * 0.26, viewportW * 0.62)
			: Math.min(size * 0.5, viewportH * 0.3, viewportW * 0.18)
	);
}

/**
 * @param focus true while the cube is armed or a solve is running.
 */
export function useVirtualCubeSize(mobile: boolean, focus = false): number {
	const userSize = useSettings('virtual_cube_size');

	const [viewport, setViewport] = useState(() => ({
		w: typeof window === 'undefined' ? 1280 : window.innerWidth,
		h: typeof window === 'undefined' ? 800 : window.innerHeight,
	}));

	useEffect(() => {
		const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	return computeVirtualCubeSize(
		userSize ?? (getSetting('virtual_cube_size') as number),
		viewport.w,
		viewport.h,
		mobile,
		focus
	);
}
