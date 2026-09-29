// Android's back gesture owns both screen edges, so each drawer's notch has its strip of
// edge excluded (GestureExclusionPlugin). The plugin keys its rects by PHYSICAL edge, while
// a drawer only knows its own side. In reversed use (client/util/reversed-ui.ts) the drawers
// are drawn rotated 180°: the left drawer's notch sits on the physical right edge, at the
// mirrored height. Both physical rects are recomputed here from one table, so the two
// drawers can report in any order without one clearing the rect the other just set.
import {isAndroidNative, updateGestureExclusion, clearGestureExclusion} from '../../../../util/platform';
import {isUiReversed} from '../../../../util/reversed-ui';

export type EdgeSide = 'left' | 'right';
/** Notch centre per edge as a percentage of the screen height, null when there is none. */
export type EdgeNotches = Record<EdgeSide, number | null>;

const SIDES: EdgeSide[] = ['left', 'right'];
// Visible notch height; the plugin adds its own touch slop around it.
const NOTCH_HEIGHT_PX = 115;

/** Where the notches are physically, given where each drawer draws its own. */
export function planEdgeExclusion(drawers: EdgeNotches, reversed: boolean): EdgeNotches {
	if (!reversed) return {left: drawers.left, right: drawers.right};
	return {
		left: drawers.right === null ? null : 100 - drawers.right,
		right: drawers.left === null ? null : 100 - drawers.left,
	};
}

const drawers: EdgeNotches = {left: null, right: null};
// undefined = never sent, so the first sync always reaches the plugin.
const applied: Record<EdgeSide, number | null | undefined> = {left: undefined, right: undefined};
let observer: MutationObserver | null = null;

function sync() {
	const plan = planEdgeExclusion(drawers, isUiReversed());
	for (const side of SIDES) {
		const y = plan[side];
		if (y === applied[side]) continue;
		applied[side] = y;
		if (y === null) clearGestureExclusion(side);
		else updateGestureExclusion(side, y, NOTCH_HEIGHT_PX);
	}
}

// Reversed use turns on and off while the drawers stay mounted, so the class on <body> is
// watched directly instead of waiting for a drawer to re-render.
function watchReversed(on: boolean) {
	if (!on) {
		observer?.disconnect();
		observer = null;
		return;
	}
	if (observer || typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) {
		return;
	}
	observer = new MutationObserver(sync);
	observer.observe(document.body, {attributes: true, attributeFilter: ['class']});
}

/** A drawer's notch is at `yPercent` of the screen height in its own frame, or gone (null). */
export function setEdgeNotch(side: EdgeSide, yPercent: number | null): void {
	if (!isAndroidNative()) return;
	drawers[side] = yPercent;
	watchReversed(drawers.left !== null || drawers.right !== null);
	sync();
}

export function resetEdgeNotchesForTests(): void {
	drawers.left = null;
	drawers.right = null;
	applied.left = undefined;
	applied.right = undefined;
	watchReversed(false);
}
