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
			const showPromise = Keyboard.addListener('keyboardWillShow', () => setOpen(true));
			const hidePromise = Keyboard.addListener('keyboardWillHide', () => setOpen(false));
			return () => {
				showPromise.then((h) => h.remove()).catch(() => {});
				hidePromise.then((h) => h.remove()).catch(() => {});
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
