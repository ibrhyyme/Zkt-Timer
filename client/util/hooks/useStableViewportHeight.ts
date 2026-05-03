import { useEffect, useRef } from 'react';

/**
 * Layout viewport yuksekligini --stable-vh CSS degiskenine yazar.
 * Capacitor KeyboardResize.None + window.innerHeight kullanildigi icin
 * klavye acilsa da deger degismez; sadece oryantasyon / gercek resize tetikler.
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
			// Sadece buyuyen resize'i kabul et — klavye acildiginda Android WebView kuculebilir,
			// bu --stable-vh'yi yanlis sekilde dusurur ve klavye kapandiktan sonra siyah bosluk birakirdi.
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
