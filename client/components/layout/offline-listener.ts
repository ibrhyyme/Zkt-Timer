/**
 * Global Offline Sync Listener
 *
 * Listens for online/offline events and performs automatic sync
 */

import { requestQueueFlush } from '../../util/offline-sync';
import { initNetworkListener } from '../../util/native-plugins';
import { onVisibilityChange } from '../../util/app-visibility';
import { isNative } from '../../util/platform';
import { isLocalShell } from '../../util/api-base';
import { Capacitor } from '@capacitor/core';
import { toastWarning } from '../../util/toast';
import i18n from '../../i18n/i18n';

let listenersRegistered = false;

/**
 * Start online/offline event listeners
 *
 * Every trigger goes through requestQueueFlush, which runs one flush at a time and joins
 * late arrivals to the running one. There is deliberately no Background Sync any more: the
 * service worker never synced anything itself, it only messaged the page, and re-registering
 * it after each run made Chrome fire the next run immediately. The launch-time flush it
 * used to provide is now an explicit call in the boot sequence (init.ts).
 */
export function initOfflineSyncListener() {
    if (listenersRegistered) return;
    listenersRegistered = true;

    // Sync when online
    window.addEventListener('online', () => {
        void requestQueueFlush('online');
    });

    // Native network listener — more reliable than navigator.onLine
    initNetworkListener((connected) => {
        if (connected) void requestQueueFlush('online');
    });

    // Coming back to the app (tab focus, native resume): the connection may have come back
    // while nothing was listening, e.g. the app was suspended.
    onVisibilityChange((visible) => {
        if (visible) void requestQueueFlush('resume');
    });

    // Register Service Worker
    registerServiceWorker();
}

/**
 * Register Service Worker
 */
async function registerServiceWorker() {
    // Faz 2 local-bundle shell: assets ship inside the binary and OTA handles updates,
    // so the SW adds nothing but cache-staleness risk. Old remote-loading binaries
    // return false here and keep their Faz 1 SW offline behavior.
    if (isLocalShell()) {
        return;
    }

    // Dev / localhost: never register the SW. Its cache-first strategy serves a stale
    // app.min.css/js during development, which hides every rebuild (the "design won't
    // update" trap). Also tear down any SW + cache left from a previous session so the
    // page stops being served stale assets.
    const host = window.location.hostname;
    const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (isLocalhost && !isNative() && 'serviceWorker' in navigator) {
        try {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
            if (window.caches) {
                const keys = await caches.keys();
                await Promise.all(keys.filter((k) => k.startsWith('zkt-')).map((k) => caches.delete(k)));
            }
            // If a SW was actually controlling this page, reload once so the fresh
            // (uncached) assets load. regs is empty after unregister, so no loop.
            if (regs.length > 0) {
                window.location.reload();
            }
        } catch (e) {
            console.warn('[SW] dev cleanup failed:', e);
        }
        return;
    }

    console.log('[SW-DEBUG] serviceWorker in navigator:', 'serviceWorker' in navigator);
    console.log('[SW-DEBUG] protocol:', window.location.protocol);
    console.log('[SW-DEBUG] origin:', window.location.origin);

    // Old Android System WebViews have no Service Worker support, so offline
    // boot can never work there. Tell the user once how to fix it (update the
    // WebView via Play Store) instead of failing silently.
    if (!('serviceWorker' in navigator)) {
        if (isNative() && Capacitor.getPlatform() === 'android' && !localStorage.getItem('zkt_sw_unsupported_notified')) {
            localStorage.setItem('zkt_sw_unsupported_notified', '1');
            toastWarning(i18n.t('common.webview_update_required'));
        }
        return;
    }

    if ('serviceWorker' in navigator) {
        try {
            console.log('[SW-DEBUG] Registering /sw.js...');
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            });

            console.log('[SW-DEBUG] Registered:', registration.scope);

            // When new SW is detected, it installs but waits for activation.
            // It won't become active until user completely closes and reopens the app — no mid-session reload.

            // SW update check -- varies by platform
            if (isNative()) {
                import('@capacitor/app').then(({ App }) => {
                    App.addListener('appStateChange', ({ isActive }) => {
                        if (isActive) registration.update().catch(() => {});
                    });
                });
            } else {
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') registration.update().catch(() => {});
                });
                window.addEventListener('pageshow', (e) => {
                    if ((e as PageTransitionEvent).persisted) registration.update().catch(() => {});
                });
            }

            // Periodic update check every 5 minutes
            setInterval(() => {
                registration.update().catch(() => {});
            }, 5 * 60 * 1000);
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}
