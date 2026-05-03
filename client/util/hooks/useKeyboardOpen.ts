import { useEffect, useState } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

interface WebViewRefreshPlugin {
	refresh(): Promise<void>;
}
const WebViewRefresh = registerPlugin<WebViewRefreshPlugin>('WebViewRefresh');

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

			// Android WebView klavye kapaninca paint cache'inde siyah cizgi artifact birakir.
			// Kullanicinin manuel "background → foreground" davranisi cizgiyi temizliyor —
			// bu native cağri WebView'i GONE → VISIBLE toggle ederek o davranisi simule eder.
			const refreshWebView = () => {
				if (isAndroid) {
					WebViewRefresh.refresh().catch(() => {});
				}
			};

			const showPromise = Keyboard.addListener('keyboardWillShow', () => setOpen(true));
			const willHidePromise = Keyboard.addListener('keyboardWillHide', () => setOpen(false));
			// keyboardWillHide Android'de bazi kapatma senaryolarinda gelmiyor; didHide fallback.
			const didHidePromise = Keyboard.addListener('keyboardDidHide', () => {
				setOpen(false);
				refreshWebView();
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
