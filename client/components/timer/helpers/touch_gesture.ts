/**
 * The "I changed my mind" swipe.
 *
 * Holding a finger on the timer primes it; sliding the finger UP before letting go
 * drops the hold, so the release starts nothing. That is the gesture cubers reach for
 * when they pick the puzzle up and decide not to solve yet.
 *
 * It used to be a plain radial distance test, which made a lift that drifted a few
 * pixels DOWN or sideways read as a cancel — releasing without ever starting the
 * solve. Direction is the whole point of the gesture, so it is back, and the rule now
 * lives here where it can be tested without a DOM.
 *
 * The same threshold governs the two places a swipe up means "abort": dropping a
 * primed hold (KeyWatcher) and cancelling inspection (Timer's mobile overlay). They
 * used to be 30px and 50px, which left a band where a swipe silently killed the hold
 * but left inspection running — nothing visibly happened, and the next release did
 * nothing either.
 */
export const SWIPE_UP_CANCEL_PX = 50;

/**
 * Whether a finger's travel during a press is an upward cancel swipe.
 *
 * `diffX` / `diffY` are measured from where the finger landed, in CSS pixels, with
 * y growing downward — so an upward swipe has a negative `diffY`.
 *
 * Requiring the vertical component to dominate keeps a diagonal drag across the
 * screen from counting: that is someone dragging, not someone aborting.
 */
export function isCancelSwipe(diffX: number, diffY: number): boolean {
	return -diffY > SWIPE_UP_CANCEL_PX && Math.abs(diffY) > Math.abs(diffX);
}

/**
 * The band along each side edge where a press is taken for a reach towards the side menus.
 *
 * The menus open from a notch only 8px wide that sits at one height, and the timer ignores
 * just the outer 20px (KeyWatcher's dead zone). A thumb going for the menu that landed a
 * little further in, or above or below the notch, primed the timer, and the sideways swipe
 * that followed started a solve on release; the next tap then stopped it.
 */
export const EDGE_SWIPE_ZONE_PX = 60;

/** Inward travel that makes such a press a swipe rather than a finger settling. */
export const EDGE_SWIPE_MIN_PX = 24;

/**
 * Whether a press is a swipe in from a side edge (towards a side menu), which must not
 * start a solve.
 *
 * Physical screen coordinates on purpose: the drawers sit at the physical edges, and the
 * reversed (180°) timer turns the page with them, so the edge nearest the finger is the
 * one it reaches for either way.
 *
 * `startX` is where the finger landed, `diffX` / `diffY` its travel since, in CSS pixels.
 */
export function isEdgeSwipe(startX: number, diffX: number, diffY: number, viewportWidth: number): boolean {
	let inward: number;
	if (startX < EDGE_SWIPE_ZONE_PX) {
		inward = diffX;
	} else if (viewportWidth - startX < EDGE_SWIPE_ZONE_PX) {
		inward = -diffX;
	} else {
		return false;
	}
	return inward > EDGE_SWIPE_MIN_PX && Math.abs(diffX) > Math.abs(diffY);
}
