import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

// Below this a "shrink" is a toolbar collapsing or a rounding difference, not a keyboard.
const KEYBOARD_MIN_HEIGHT = 60;

interface KeyboardState {
	/** Pixels of the layout viewport the keyboard covers that CSS still has to subtract. */
	inset: number;
	/** Full on-screen keyboard height, whether or not the viewport already shrank for it. */
	height: number;
}

const CLOSED: KeyboardState = { inset: 0, height: 0 };

/**
 * Keyboard geometry, split into the part CSS owns and the part it does not.
 *
 * A soft keyboard can eat layout in two ways. Either the layout viewport keeps its full
 * height and the keyboard is painted over the bottom of it (iOS/WKWebView always, and any
 * Chromium that honours `interactive-widget=overlays-content`), or the layout viewport is
 * shrunk to fit above the keyboard (Chromium's default, and any WebView older than 108 that
 * ignores the meta tag). Only the first case leaves anything for `100dvh` to subtract; in
 * the second the page already lost those pixels, and subtracting them again pushes the
 * bottom of a full-screen layout a whole keyboard too high. So the height the platform
 * reports is reduced by whatever the viewport gave up on its own.
 */
function useKeyboardState(): KeyboardState {
	const [state, setState] = useState<KeyboardState>(CLOSED);

	useEffect(() => {
		// The layout viewport height with no keyboard on screen. A keyboard can only ever
		// take height away, so the running maximum is the unshrunk value. A width change
		// means a rotation or a fold, where the previous maximum no longer describes
		// anything and the current height is the best new baseline.
		let baselineHeight = window.innerHeight;
		let baselineWidth = window.innerWidth;

		function refreshBaseline(): void {
			if (window.innerWidth !== baselineWidth) {
				baselineWidth = window.innerWidth;
				baselineHeight = window.innerHeight;
			} else if (window.innerHeight > baselineHeight) {
				baselineHeight = window.innerHeight;
			}
		}

		/** How much of the keyboard the platform already took out of `100dvh` by itself. */
		function viewportShrink(): number {
			return Math.max(0, baselineHeight - window.innerHeight);
		}

		function publish(next: KeyboardState): void {
			setState((prev) => (prev.inset === next.inset && prev.height === next.height ? prev : next));
		}

		if (Capacitor.isNativePlatform()) {
			// iOS reports points, Android reports dp; both equal one CSS pixel in the WebView.
			let reported = 0;

			const emit = () => {
				refreshBaseline();
				if (reported <= 0) {
					publish(CLOSED);
					return;
				}
				publish({ inset: Math.max(0, reported - viewportShrink()), height: reported });
			};

			const onShow = (info: { keyboardHeight: number }) => {
				reported = Math.round(info.keyboardHeight);
				emit();
			};

			const onHide = () => {
				reported = 0;
				emit();
			};

			// The WebView resizes on its own schedule, a frame or more after the keyboard
			// event lands, so the shrink has to be re-read when it actually happens. While
			// the keyboard is down this is what grows the baseline back to full height.
			const onResize = () => emit();
			window.addEventListener('resize', onResize);

			const willShowPromise = Keyboard.addListener('keyboardWillShow', onShow);
			// Swapping to an emoji or third-party keyboard changes the height after the
			// open animation, so the settled value is read as well.
			const didShowPromise = Keyboard.addListener('keyboardDidShow', onShow);
			const willHidePromise = Keyboard.addListener('keyboardWillHide', onHide);
			// keyboardWillHide does not arrive for every Android dismissal; didHide is the fallback.
			const didHidePromise = Keyboard.addListener('keyboardDidHide', onHide);

			return () => {
				window.removeEventListener('resize', onResize);
				willShowPromise.then((h) => h.remove()).catch(() => {});
				didShowPromise.then((h) => h.remove()).catch(() => {});
				willHidePromise.then((h) => h.remove()).catch(() => {});
				didHidePromise.then((h) => h.remove()).catch(() => {});
			};
		}

		const vv = window.visualViewport;
		if (!vv) return;

		function measure(): void {
			if (!vv) return;
			refreshBaseline();
			// The part of the layout viewport that survived but has the keyboard drawn over
			// it. A browser that shrinks the viewport instead reports ~0 here, which is
			// correct: those pixels are already gone from `100dvh`.
			const covered = window.innerHeight - vv.height - vv.offsetTop;
			const inset = covered > KEYBOARD_MIN_HEIGHT ? Math.round(covered) : 0;
			// Both routes hide the same keyboard, so together they are its real height.
			const height = inset + viewportShrink();
			publish(height > KEYBOARD_MIN_HEIGHT ? { inset, height: Math.round(height) } : CLOSED);
		}

		measure();
		vv.addEventListener('resize', measure);
		// offsetTop moves when iOS pans the visual viewport, which changes how much of the
		// page is actually covered.
		vv.addEventListener('scroll', measure);
		// Only the window fires when it is the layout viewport that shrank.
		window.addEventListener('resize', measure);

		return () => {
			vv.removeEventListener('resize', measure);
			vv.removeEventListener('scroll', measure);
			window.removeEventListener('resize', measure);
		};
	}, []);

	return state;
}

/**
 * Height in CSS pixels that a bottom-anchored element has to subtract to clear the
 * keyboard, 0 while it is closed. Already accounts for any shrinking the viewport did on
 * its own, so `calc(100dvh - var(--keyboard-h))` is correct on every platform.
 */
export function useKeyboardInset(): number {
	return useKeyboardState().inset;
}

/** Whether a soft keyboard is on screen. A hardware keyboard's accessory bar does not count. */
export function useKeyboardOpen(): boolean {
	return useKeyboardState().height > 150;
}
