import { clearQueue } from '../offline-queue';

/**
 * Local state that belongs to the signed-in account and must not outlive it on this device.
 * Shared by logout and account deletion.
 *
 * - The offline queue: left behind, the next account on this browser replayed the previous
 *   one's changes under its own session.
 * - Pages cached by the service worker: a cached page carries the server-rendered identity
 *   of whoever loaded it, so an offline launch after logout could come up as the previous
 *   account. Only page entries go; the versioned app bundles and static files stay, so the
 *   app shell keeps working offline.
 */
export async function clearAccountCaches(): Promise<void> {
	try {
		await clearQueue();
	} catch (e) {
		console.error('[logout] queue could not be cleared', e);
	}

	await purgeCachedPages();
}

async function purgeCachedPages(): Promise<void> {
	if (typeof caches === 'undefined') return;

	try {
		const cacheNames = (await caches.keys()).filter((name) => name.startsWith('zkt-'));
		for (const name of cacheNames) {
			const cache = await caches.open(name);
			const requests = await cache.keys();
			await Promise.all(
				requests
					.filter((request) => {
						const path = new URL(request.url).pathname;
						return !path.startsWith('/dist/') && !path.startsWith('/public/');
					})
					.map((request) => cache.delete(request))
			);
		}
	} catch (e) {
		console.error('[logout] cached pages could not be cleared', e);
	}
}
