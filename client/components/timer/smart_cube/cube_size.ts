// The smart cube's size setting against the size the cube is drawn at.
//
// The setting predates the renderer: on desktop the old 3D player was drawn at the stored
// size and shrunk to 40% with CSS zoom, so a stored 400 has always meant a 160 px cube on
// a desktop layout. The stored values (synced per platform) keep that meaning, so no
// user's cube changes size; what changed is that the cube is now drawn at its real size
// instead of being drawn 2.5 times larger and zoomed down, and that the settings slider
// shows and takes the drawn size, so its number is what the user sees.
//
// On the phone the stored value is the drawn size, capped by the screen so the timer and
// the cards under it are never squeezed. The slider stops at that cap: past it, a step
// used to change nothing.
//
// Pure, so it runs in node tests.

/** Desktop layout: the drawn cube against the stored size (the old zoom: 0.4). */
export const DESKTOP_DRAWN_SCALE = 0.4;

/** The slider's stored range (the setting's own units). */
export const STORED_MIN = 100;
export const STORED_MAX = 600;

/** The largest cube a phone layout draws: a share of the screen height and width. */
export function mobileCubeCap(viewportW: number, viewportH: number): number {
	return Math.floor(Math.min(viewportH * 0.3, viewportW * 0.52));
}

/** The size the cube is drawn at, in CSS px. */
export function drawnCubeSize(stored: number, mobileLayout: boolean, viewportW: number, viewportH: number): number {
	if (mobileLayout) return Math.floor(Math.min(stored, mobileCubeCap(viewportW, viewportH)));
	return Math.round(stored * DESKTOP_DRAWN_SCALE);
}

/** The slider's range in drawn px: every step inside it changes the cube on screen. */
export function drawnCubeRange(mobileLayout: boolean, viewportW: number, viewportH: number): { min: number; max: number } {
	if (mobileLayout) {
		const cap = mobileCubeCap(viewportW, viewportH);
		return { min: Math.min(STORED_MIN, cap), max: cap };
	}
	return { min: Math.round(STORED_MIN * DESKTOP_DRAWN_SCALE), max: Math.round(STORED_MAX * DESKTOP_DRAWN_SCALE) };
}

/** The stored value for a size picked on the slider. */
export function storedCubeSize(drawn: number, mobileLayout: boolean): number {
	return mobileLayout ? Math.round(drawn) : Math.round(drawn / DESKTOP_DRAWN_SCALE);
}
