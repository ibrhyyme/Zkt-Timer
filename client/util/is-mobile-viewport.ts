/**
 * The one definition of "this viewport counts as mobile".
 *
 * It decides the global `mobile_mode` flag, which in turn decides whether the desktop
 * header renders at all and whether the edge drawers appear. It was written out three
 * times (HeaderNav, the old Nav sidebar, useMobileModeSync); the sidebar has since been
 * deleted, and the remaining two now read it from here so the app cannot end up half
 * mobile and half desktop.
 *
 * Under 1024 is mobile, which counts an unfolded foldable. The height test catches a
 * phone held in landscape inside a desktop-width browser window.
 */
export const MOBILE_MAX_WIDTH = 1024;
export const MOBILE_MAX_LANDSCAPE_HEIGHT = 500;

export function isMobileViewport(): boolean {
	if (typeof window === 'undefined') return false;
	return window.innerWidth < MOBILE_MAX_WIDTH || window.innerHeight <= MOBILE_MAX_LANDSCAPE_HEIGHT;
}
