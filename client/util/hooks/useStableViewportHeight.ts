import { useEffect, useRef } from 'react';

/**
 * Writes layout viewport height to --stable-vh CSS variable.
 * Since Capacitor KeyboardResize.None + window.innerHeight are used,
 * value doesn't change even if keyboard opens; only orientation/real resize triggers.
 */
export function useStableViewportHeight() {
	const stableHeight = useRef<number>(0);

	useEffect(() => {
		function getViewportHeight(): number {
			return window.innerHeight;
		}

		function setStableHeight(h: number) {
			stableHeight.current = h;
			document.documentElement.style.setProperty('--stable-vh', `${h}px`);
		}

		setStableHeight(getViewportHeight());

		function onResize() {
			const currentHeight = getViewportHeight();
			// Only accept growing resize — Android WebView can shrink when keyboard opens,
			// which would incorrectly lower --stable-vh and leave black space after keyboard closes.
			if (currentHeight > stableHeight.current) {
				setStableHeight(currentHeight);
			}
		}

		function onOrientationChange() {
			setTimeout(() => {
				setStableHeight(getViewportHeight());
			}, 200);
		}

		window.addEventListener('resize', onResize);
		window.addEventListener('orientationchange', onOrientationChange);

		return () => {
			window.removeEventListener('resize', onResize);
			window.removeEventListener('orientationchange', onOrientationChange);
		};
	}, []);
}
