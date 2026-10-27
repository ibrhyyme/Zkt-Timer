import {RefObject, useCallback, useEffect, useRef} from 'react';
import {stepOffset, inPinnedRange, nearestStep, needsSettle, snapAction, SnapGeometry} from './pinned_steps';

// Same edge as $bp-lg: below it the scenes unpin and the page scrolls natively.
const WIDE_QUERY = '(min-width: 1024px)';
const STEP_MS = 700;
// A trackpad keeps sending wheel events for a second after the fingers lift. A gesture
// counts as over once this long passes without one.
const QUIET_MS = 200;
const SETTLE_MS = 180;

interface Options {
	trackRef: RefObject<HTMLElement>;
	pinRef: RefObject<HTMLElement>;
	count: number;
	active: number;
	onChange: (index: number) => void;
}

function easeInOutCubic(p: number): number {
	return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
}

function isTypingTarget(target: EventTarget | null): boolean {
	const el = target as HTMLElement | null;
	return !!el?.closest?.('input, textarea, select, [contenteditable="true"]');
}

/**
 * Pins a scene on a wide screen and moves one step per wheel tick, arrow key, Page
 * Up/Down or Space; a dragged scrollbar or a touch fling settles on the nearest step.
 * Past the first or the last step the page scrolls on as usual. Several scenes on one
 * page each run their own copy; only the one whose range holds the scroll position acts.
 *
 * The step itself is a short scroll tween to the next step's offset; the scene is
 * sticky, so the tween is invisible and the step's own transition is what moves.
 * Nothing here sets state per frame: onChange runs only when the step changes.
 */
export function usePinnedSteps({trackRef, pinRef, count, active, onChange}: Options) {
	const activeRef = useRef(active);
	activeRef.current = active;
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;

	const enabledRef = useRef(false);
	const animatingRef = useRef(false);
	const lockRef = useRef(false);
	const engagedRef = useRef(false);
	const lastWheelRef = useRef(0);
	const rafRef = useRef(0);
	const settleRef = useRef(0);

	const geometry = useCallback((): SnapGeometry | null => {
		const track = trackRef.current;
		const pin = pinRef.current;
		if (!track || !pin) return null;
		const stickyTop = parseFloat(getComputedStyle(pin).top) || 0;
		return {
			start: track.getBoundingClientRect().top + window.scrollY - stickyTop,
			step: pin.offsetHeight,
			count,
		};
	}, [trackRef, pinRef, count]);

	const goTo = useCallback(
		(index: number) => {
			onChangeRef.current(index);
			if (!enabledRef.current) return;
			const g = geometry();
			if (!g) return;

			engagedRef.current = true;
			lockRef.current = true;
			cancelAnimationFrame(rafRef.current);

			const from = window.scrollY;
			const target = stepOffset(g, index);
			const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
			if (reduced || Math.abs(target - from) < 1) {
				window.scrollTo(0, target);
				animatingRef.current = false;
				return;
			}

			animatingRef.current = true;
			const t0 = performance.now();
			const tick = (now: number) => {
				const p = Math.min(1, (now - t0) / STEP_MS);
				window.scrollTo(0, from + (target - from) * easeInOutCubic(p));
				if (p < 1) {
					rafRef.current = requestAnimationFrame(tick);
				} else {
					animatingRef.current = false;
				}
			};
			rafRef.current = requestAnimationFrame(tick);
		},
		[geometry]
	);

	useEffect(() => {
		const query = window.matchMedia(WIDE_QUERY);

		const onWheel = (e: WheelEvent) => {
			if (!enabledRef.current || e.ctrlKey) return;
			if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
			const g = geometry();
			if (!g) return;

			const now = performance.now();
			const locked = lockRef.current && (animatingRef.current || now - lastWheelRef.current < QUIET_MS);
			lastWheelRef.current = now;
			if (!locked) lockRef.current = false;

			const action = snapAction({
				g,
				y: window.scrollY,
				dir: e.deltaY > 0 ? 1 : -1,
				active: activeRef.current,
				engaged: engagedRef.current,
				locked,
			});
			if (action.type === 'pass') return;
			e.preventDefault();
			if (action.type === 'go') goTo(action.index);
		};

		const onKey = (e: KeyboardEvent) => {
			if (!enabledRef.current || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
			if (isTypingTarget(e.target)) return;
			let dir: 0 | 1 | -1 = 0;
			if (e.key === 'ArrowDown' || e.key === 'PageDown') dir = 1;
			else if (e.key === 'ArrowUp' || e.key === 'PageUp') dir = -1;
			else if (e.key === ' ') {
				// Space on a button or link presses it; leave that alone.
				if ((e.target as HTMLElement)?.closest?.('button, a')) return;
				dir = e.shiftKey ? -1 : 1;
			}
			if (!dir) return;
			const g = geometry();
			if (!g) return;
			const action = snapAction({
				g,
				y: window.scrollY,
				dir,
				active: activeRef.current,
				engaged: engagedRef.current,
				locked: animatingRef.current,
			});
			if (action.type === 'pass') return;
			e.preventDefault();
			if (action.type === 'go') goTo(action.index);
		};

		const onScroll = () => {
			if (!enabledRef.current) return;
			const g = geometry();
			if (!g) return;
			const y = window.scrollY;
			if (!inPinnedRange(g, y)) {
				engagedRef.current = false;
				return;
			}
			if (animatingRef.current) return;

			// The page scrolled in and came to rest exactly on a step (a wheel notch that
			// lands on the pin point, coming back up from below): that already is the
			// settle, so the next tick steps instead of being spent on settling. The rest
			// of the gesture is still absorbed, so momentum cannot skip ahead.
			if (!engagedRef.current && Math.abs(y - stepOffset(g, nearestStep(g, y))) <= 2) {
				engagedRef.current = true;
				lockRef.current = true;
				lastWheelRef.current = performance.now();
			}

			// A dragged scrollbar moves through the steps as it goes...
			const index = nearestStep(g, y);
			if (index !== activeRef.current) onChangeRef.current(index);

			// ...and settles on the nearest one once it stops.
			window.clearTimeout(settleRef.current);
			settleRef.current = window.setTimeout(() => {
				const g2 = geometry();
				if (!g2 || animatingRef.current) return;
				const y2 = window.scrollY;
				if (needsSettle(g2, y2)) goTo(nearestStep(g2, y2));
			}, SETTLE_MS);
		};

		const apply = () => {
			enabledRef.current = query.matches;
			if (!query.matches) {
				cancelAnimationFrame(rafRef.current);
				animatingRef.current = false;
				lockRef.current = false;
				engagedRef.current = false;
			} else {
				// A page restored mid-scene starts on the step it was left on.
				onScroll();
			}
		};
		apply();
		query.addEventListener?.('change', apply);

		window.addEventListener('wheel', onWheel, {passive: false});
		window.addEventListener('keydown', onKey);
		window.addEventListener('scroll', onScroll, {passive: true});

		return () => {
			query.removeEventListener?.('change', apply);
			window.removeEventListener('wheel', onWheel);
			window.removeEventListener('keydown', onKey);
			window.removeEventListener('scroll', onScroll);
			window.clearTimeout(settleRef.current);
			cancelAnimationFrame(rafRef.current);
		};
	}, [geometry, goTo]);

	return {goTo};
}
