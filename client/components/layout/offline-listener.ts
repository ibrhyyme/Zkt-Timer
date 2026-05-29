/**
 * Global Offline Sync Listener
 *
 * Listens for online/offline events and performs automatic sync
 */

import { processQueue, registerBackgroundSync, isOnline } from '../../util/offline-sync';
import { getPendingCount } from '../../util/offline-queue';
import { initNetworkListener, getNetworkStatus } from '../../util/native-plugins';
import { isNative } from '../../util/platform';

let syncInProgress = false;

/**
 * Start online/offline event listeners
 */
export function initOfflineSyncListener() {
    // Sync when online
    window.addEventListener('online', handleOnline);

    // Native network listener — more reliable than navigator.onLine
    initNetworkListener((connected) => {
        if (connected) handleOnline();
    });

    // Service Worker message listener
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'BACKGROUND_SYNC') {
                handleOnline();
            }
        });
    }

    // Register Service Worker
    registerServiceWorker();
}

async function handleOnline() {
    // Skip if sync is already in progress
    if (syncInProgress) return;

    // Short delay for Service Worker to detect online status
    await new Promise(r => setTimeout(r, 2000));

    // Check if still online after delay
    const online = await getNetworkStatus();
    if (!online) return;

    // Skip if no pending items
    const pendingCount = await getPendingCount();
    if (pendingCount === 0) return;

    // Perform sync
    syncInProgress = true;
    try {
        await processQueue();
        await registerBackgroundSync();
    } catch (error) {
        console.error('Auto-sync error:', error);
    } finally {
        syncInProgress = false;
    }
}

/**
 * Register Service Worker
 */
async function registerServiceWorker() {
    console.log('[SW-DEBUG] serviceWorker in navigator:', 'serviceWorker' in navigator);
    console.log('[SW-DEBUG] protocol:', window.location.protocol);
    console.log('[SW-DEBUG] origin:', window.location.origin);

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

            // Register Background Sync
            await registerBackgroundSync();
        } catch (error) {
            console.error('Service Worker registration failed:', error);
        }
    }
}
