// "Reversed use": a phone lying flat on the table upside down (its top edge toward the
// user), so the cube resting at the rear-camera hot spot sits between the user and the
// phone instead of beyond it. The system cannot rotate for this (iPhones with Face ID have
// no upside-down portrait, Android phones are locked to portrait, and a flat phone never
// triggers auto-rotate), so the timer page is rotated 180° in CSS.
//
// The single source of truth is a class on <body>, so code outside React (KeyWatcher's
// gesture maths, the modal swipe-back) reads the same state the CSS does.

export const REVERSED_BODY_CLASS = 'zt-reversed';

// The frames that are drawn rotated: the timer root, and app modals and the edge drawers
// while the class is on.
const REVERSED_FRAME_SELECTOR =
	'.zt-timer--reversed, body.zt-reversed .zt-modal--list > .zt-modal, body.zt-reversed .zt-edge-drawer__drawer';

export type PopperSide = 'top' | 'right' | 'bottom' | 'left';
export type PopperAlign = 'start' | 'center' | 'end';

export function isUiReversed(): boolean {
	if (typeof document === 'undefined' || !document.body) return false;
	return document.body.classList.contains(REVERSED_BODY_CLASS);
}

/**
 * Whether an element is drawn inside a rotated frame. Popovers anchored to it open in
 * physical coordinates, so they have to be flipped and turned to match. Checked per
 * element rather than globally: anything else portaled into <body> is still upright.
 */
export function inReversedFrame(el: { closest?: (selector: string) => unknown } | null | undefined): boolean {
	return !!el && typeof el.closest === 'function' && !!el.closest(REVERSED_FRAME_SELECTOR);
}

/** A touch point in the reader's frame: the viewport turned about its centre. */
export function toReaderPoint(
	x: number,
	y: number,
	width: number,
	height: number,
	reversed: boolean
): [number, number] {
	return reversed ? [width - x, height - y] : [x, y];
}

/** A touch movement in the reader's frame: physically down is "up" for a reversed reader. */
export function orientDelta(dx: number, dy: number, reversed: boolean): [number, number] {
	return reversed ? [-dx, -dy] : [dx, dy];
}

/**
 * Popper placement in physical terms for a trigger inside a rotated frame: "below" the
 * trigger for the reader is physically above it, and the reader's start edge is the
 * physical end edge.
 */
export function reversedPlacement(
	side: PopperSide,
	align: PopperAlign,
	reversed: boolean
): { side: PopperSide; align: PopperAlign } {
	if (!reversed) return { side, align };
	const flipSide: Record<PopperSide, PopperSide> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
	const flipAlign: Record<PopperAlign, PopperAlign> = { start: 'end', end: 'start', center: 'center' };
	return { side: flipSide[side], align: flipAlign[align] };
}

/**
 * The individual `rotate` property composes with the `transform` Radix and the enter
 * animations use. Without it the insets would be swapped with nothing rotated, so an old
 * WebView simply never enters reversed use.
 */
export function supportsRotate(): boolean {
	return typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('rotate', '180deg');
}
