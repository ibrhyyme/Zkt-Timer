import {useEffect} from 'react';

/**
 * Screen wake lock — antrenman/timer aktifken cihazin ekranini acik tutar.
 *
 * Tarayici destegi:
 * - Chrome (Android) 84+
 * - Safari (iOS) 16.4+
 * - Eski tarayicilarda sessizce no-op.
 *
 * Visibility change'e duyarli: kullanici sekmeye geri donduktan sonra
 * tarayici wake lock'u otomatik birakir — biz yeniden request ederiz.
 *
 * @param active true iken wake lock alinir, false iken birakilir.
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
				// Permission denied veya cihaz desteklemiyor — sessiz gec
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
