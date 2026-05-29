import {useEffect} from 'react';

/**
 * Screen wake lock — keeps device screen on during training/timer.
 *
 * Browser support:
 * - Chrome (Android) 84+
 * - Safari (iOS) 16.4+
 * - Silently no-op on older browsers.
 *
 * Responsive to visibility changes: after user returns to tab, browser
 * automatically releases wake lock — we request it again.
 *
 * @param active When true, acquire wake lock; when false, release it.
 */
export function useWakeLock(active: boolean): void {
	useEffect(() => {
		if (!active) return;
		if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

		let sentinel: any = null;
		let released = false;

		const request = async () => {
			try {
				const s = await (navigator as any).wakeLock.request('screen');
				if (released) {
					s.release?.();
					return;
				}
				sentinel = s;
			} catch {
				// Permission denied or device not supported — silently continue
			}
		};

		request();

		const onVisibility = () => {
			if (document.visibilityState === 'visible' && active && !sentinel) {
				request();
			}
		};
		document.addEventListener('visibilitychange', onVisibility);

		return () => {
			released = true;
			document.removeEventListener('visibilitychange', onVisibility);
			if (sentinel) {
				try { sentinel.release?.(); } catch { /* ignore */ }
				sentinel = null;
			}
		};
	}, [active]);
}
