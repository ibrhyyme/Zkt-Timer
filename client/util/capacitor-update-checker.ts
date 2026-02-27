const VERSION_KEY = 'zkt_app_version';

async function checkForUpdate(): Promise<void> {
	try {
		const res = await fetch('/api/version', { cache: 'no-store' });
		if (!res.ok) return;

		const { version } = await res.json();
		const storedVersion = localStorage.getItem(VERSION_KEY);

		if (storedVersion && storedVersion !== version) {
			console.log('[UpdateChecker] Yeni versiyon tespit edildi:', storedVersion, '->', version);

			// SW cache'lerini temizle
			if ('caches' in window) {
				const keys = await caches.keys();
				await Promise.all(keys.map((k) => caches.delete(k)));
			}

			// SW'yi unregister et
			if ('serviceWorker' in navigator) {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map((r) => r.unregister()));
			}

			localStorage.setItem(VERSION_KEY, version);
			window.location.reload();
			return;
		}

		// İlk açılış veya aynı versiyon
		if (!storedVersion) {
			localStorage.setItem(VERSION_KEY, version);
		}
	} catch (err) {
		console.warn('[UpdateChecker] Versiyon kontrolü başarısız:', err);
	}
}

export function initCapacitorUpdateChecker(): void {
	if (typeof window === 'undefined') return;

	// İlk açılışta kontrol et
	checkForUpdate();

	// Uygulama arka plandan öne geldiğinde kontrol et
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') {
			checkForUpdate();
		}
	});
}
