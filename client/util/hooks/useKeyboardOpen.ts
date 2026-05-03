import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

/**
 * Soft klavyenin acik olup olmadigini takip eder.
 * Native platformda (iOS/Android) Capacitor Keyboard event'leri — kesin sinyal.
 * Web fallback: visualViewport.height farki.
 */
export function useKeyboardOpen(): boolean {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (Capacitor.isNativePlatform()) {
			const isAndroid = Capacitor.getPlatform() === 'android';

			// Android WebView klavye kapaninca Y=eski_klavye_ust_siniri'nda paint cache artifact birakir
			// (siyah cizgi). 1-frame'lik transform flicker GPU layer'i force-repaint ettirir.
			const triggerAndroidRepaint = () => {
				if (!isAndroid) return;
				const el = document.querySelector('.cd-timer.cd-timer--mobile') as HTMLElement | null;
				if (!el) return;
				el.style.transform = 'translateZ(0)';
				requestAnimationFrame(() => {
					el.style.transform = '';
				});
			};

			const showPromise = Keyboard.addListener('keyboardWillShow', () => setOpen(true));
			const willHidePromise = Keyboard.addListener('keyboardWillHide', () => {
				setOpen(false);
				triggerAndroidRepaint();
			});
			// keyboardWillHide Android'de bazi kapatma senaryolarinda gelmiyor; didHide fallback.
			const didHidePromise = Keyboard.addListener('keyboardDidHide', () => {
				setOpen(false);
				triggerAndroidRepaint();
			});
			return () => {
				showPromise.then((h) => h.remove()).catch(() => {});
				willHidePromise.then((h) => h.remove()).catch(() => {});
				didHidePromise.then((h) => h.remove()).catch(() => {});
			};
		}

		const vv = window.visualViewport;
		if (!vv) return;

		function check() {
			const visibleHeight = vv?.height ?? window.innerHeight;
			setOpen(window.innerHeight - visibleHeight > 150);
		}

		check();
		vv.addEventListener('resize', check);
		return () => vv.removeEventListener('resize', check);
	}, []);

	return open;
}
