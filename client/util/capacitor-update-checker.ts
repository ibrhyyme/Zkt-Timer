import i18n from '../i18n/i18n';
import { isNative } from './platform';

const VERSION_KEY = 'zkt_app_version';

async function checkForUpdate(): Promise<void> {
	try {
		const res = await fetch('/api/version', { cache: 'no-store' });
		if (!res.ok) return;

		const { version } = await res.json();
		const storedVersion = localStorage.getItem(VERSION_KEY);

		if (!storedVersion) {
			localStorage.setItem(VERSION_KEY, version);
			return;
		}

		if (storedVersion === version) return;

		console.log('[UpdateChecker] Yeni versiyon tespit edildi:', storedVersion, '->', version);

		if (!confirm(i18n.t('common.new_version_available'))) return;

		// Versiyonu SADECE kabul edildikten sonra kaydet
		localStorage.setItem(VERSION_KEY, version);

		// Cache temizle ve reload
		if ('caches' in window) {
			const keys = await caches.keys();
			await Promise.all(keys.map((k) => caches.delete(k)));
		}
		if ('serviceWorker' in navigator) {
			const registrations = await navigator.serviceWorker.getRegistrations();
			await Promise.all(registrations.map((r) => r.unregister()));
		}
		window.location.reload();
	} catch (err) {
		console.warn('[UpdateChecker] Versiyon kontrolu basarisiz:', err);
	}
}

export function initCapacitorUpdateChecker(): void {
	if (typeof window === 'undefined') return;

	checkForUpdate();

	if (isNative()) {
		// Native: appStateChange -- iOS'ta visibilitychange guvenilir degil
		import('@capacitor/app').then(({ App }) => {
			App.addListener('appStateChange', ({ isActive }) => {
				if (isActive) checkForUpdate();
			});
		});
	} else {
		document.addEventListener('visibilitychange', () => {
			if (document.visibilityState === 'visible') checkForUpdate();
		});
		// iOS Safari BFCache restoration
		window.addEventListener('pageshow', (e) => {
			if (e.persisted) checkForUpdate();
		});
	}
}
