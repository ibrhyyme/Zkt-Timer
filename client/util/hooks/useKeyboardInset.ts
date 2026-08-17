import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

// Below this a "shrink" is a toolbar collapsing or a rounding difference, not a keyboard.
const KEYBOARD_MIN_HEIGHT = 60;

/**
 * Height of the soft keyboard in CSS pixels, 0 while it is closed.
 *
 * The native build ships `KeyboardResize.None` (capacitor.config.ts) together with
 * `interactive-widget=overlays-content` (public/index.html), so the WebView keeps its
 * full height and the keyboard simply covers the bottom of the page. iOS Safari behaves
 * the same way on the web: the layout viewport (and therefore `100dvh`) does not change
 * when the keyboard opens. Anything anchored to the bottom of a full-screen layout has
 * to subtract this value itself or it ends up underneath the keyboard.
 */
export function useKeyboardInset(): number {
	const [inset, setInset] = useState(0);

	useEffect(() => {
		if (Capacitor.isNativePlatform()) {
			// iOS reports points, Android reports dp; both equal one CSS pixel in the WebView.
			const willShowPromise = Keyboard.addListener('keyboardWillShow', (info) =>
				setInset(Math.round(info.keyboardHeight))
			);
			// Swapping to an emoji or third-party keyboard changes the height after the
			// open animation, so the settled value is read as well.
			const didShowPromise = Keyboard.addListener('keyboardDidShow', (info) =>
				setInset(Math.round(info.keyboardHeight))
			);
			const willHidePromise = Keyboard.addListener('keyboardWillHide', () => setInset(0));
			// keyboardWillHide does not arrive for every Android dismissal; didHide is the fallback.
			const didHidePromise = Keyboard.addListener('keyboardDidHide', () => setInset(0));

			return () => {
				willShowPromise.then((h) => h.remove()).catch(() => {});
				didShowPromise.then((h) => h.remove()).catch(() => {});
				willHidePromise.then((h) => h.remove()).catch(() => {});
				didHidePromise.then((h) => h.remove()).catch(() => {});
			};
		}

		const vv = window.visualViewport;
		if (!vv) return;

		function measure() {
			if (!vv) return;
			// A browser that shrinks the layout viewport instead (Chrome on Android) reports
			// ~0 here, which is correct: the page already lost that height, so `100dvh` is
			// short by exactly the keyboard and there is nothing left to subtract.
			const covered = window.innerHeight - vv.height - vv.offsetTop;
			setInset(covered > KEYBOARD_MIN_HEIGHT ? Math.round(covered) : 0);
		}

		measure();
		vv.addEventListener('resize', measure);
		// offsetTop moves when iOS pans the visual viewport, which changes how much of the
		// page is actually covered.
		vv.addEventListener('scroll', measure);

		return () => {
			vv.removeEventListener('resize', measure);
			vv.removeEventListener('scroll', measure);
		};
	}, []);

	return inset;
}

/** Whether a soft keyboard is on screen. A hardware keyboard's accessory bar does not count. */
export function useKeyboardOpen(): boolean {
	return useKeyboardInset() > 150;
}
