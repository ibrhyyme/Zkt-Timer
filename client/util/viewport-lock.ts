/**
 * Keeps the page itself from zooming on touch devices (feedback 2.0).
 *
 * The viewport meta (`maximum-scale=1, user-scalable=no`) already does this on
 * Android, in the Capacitor iOS WebView, and in every desktop browser. iOS Safari
 * ignores that meta for accessibility, so a pinch there zooms the whole app and
 * leaves it panning sideways. Safari still lets a page cancel its proprietary
 * `gesture*` events, which is the only hook that stops the pinch itself.
 * Double-tap zoom is handled in CSS (`touch-action: manipulation`, styles/index.scss).
 *
 * Only on touch devices: on a Mac the same events come from the trackpad, and
 * taking pinch zoom away from a desktop reader is not what the owner asked for.
 *
 * In development it also starts a sideways-overflow detector, so a new page that
 * makes the screen wider than the device shows up in the console the first time it
 * renders instead of in a bug report (see findHorizontalOverflow).
 */

let installed = false;

function preventGesture(e: Event) {
	e.preventDefault();
}

export function initViewportLock(): void {
	if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
	installed = true;

	const touchDevice = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
	if (touchDevice) {
		// Not passive: a passive listener cannot cancel the gesture.
		document.addEventListener('gesturestart', preventGesture, { passive: false });
		document.addEventListener('gesturechange', preventGesture, { passive: false });
		document.addEventListener('gestureend', preventGesture, { passive: false });
	}

	if (process.env.NODE_ENV !== 'production') {
		startOverflowWatch();
	}
}

export interface OverflowRect {
	left: number;
	right: number;
}

/**
 * True when a box sticks out of a viewport `width` px wide, with 1px of slack for
 * sub-pixel rounding. Pure so the rule is tested in node.
 */
export function isOutsideViewport(rect: OverflowRect, width: number): boolean {
	return rect.right > width + 1 || rect.left < -1;
}

function describe(el: Element): string {
	const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
	return el.tagName.toLowerCase() + (cls ? '.' + cls : '');
}

/**
 * Elements wider than the viewport. Body clips sideways overflow (styles/index.scss),
 * so such an element no longer pans the page, but its content is cut off at the screen
 * edge, which is still a layout bug on that page. The scan therefore does not stop at
 * the document's scroll width (always the viewport now). An element inside a
 * horizontally scrolling or clipping box is fine (that box is the intended scroller),
 * and so is anything fixed (the off-screen edge drawers are parked that way).
 */
export function findHorizontalOverflow(root: Document = document): string[] {
	const width = root.documentElement.clientWidth;

	const offenders: string[] = [];
	const all = root.body ? root.body.getElementsByTagName('*') : [];
	for (let i = 0; i < all.length && offenders.length < 10; i++) {
		const el = all[i] as HTMLElement;
		if (!isOutsideViewport(el.getBoundingClientRect(), width)) continue;
		if (insideClipOrFixed(el)) continue;
		offenders.push(describe(el));
	}
	return offenders;
}

function insideClipOrFixed(el: HTMLElement): boolean {
	let node: HTMLElement | null = el;
	while (node && node !== document.body) {
		const style = getComputedStyle(node);
		if (style.position === 'fixed') return true;
		if (node !== el && style.overflowX !== 'visible') return true;
		node = node.parentElement;
	}
	return false;
}

function startOverflowWatch() {
	let pending: ReturnType<typeof setTimeout> | null = null;
	const reported = new Set<string>();

	const check = () => {
		pending = null;
		for (const offender of findHorizontalOverflow()) {
			if (reported.has(offender)) continue;
			reported.add(offender);
			// console.debug survives the production strip and is the project's
			// convention for diagnostics (CLAUDE.md); this only runs in dev anyway.
			console.debug('[viewport] wider than the screen, cut off at the edge:', offender, location.pathname);
		}
	};
	const schedule = () => {
		if (pending) return;
		pending = setTimeout(check, 1000);
	};

	window.addEventListener('resize', schedule);
	if (typeof MutationObserver !== 'undefined' && document.body) {
		new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
	}
	schedule();
}
