/**
 * Global Offline Sync Listener
 *
 * Online/offline event'lerini dinler ve automatik sync yapar
 */

import { processQueue, registerBackgroundSync, isOnline } from '../../util/offline-sync';
import { getPendingCount } from '../../util/offline-queue';
import { initNetworkListener, getNetworkStatus } from '../../util/native-plugins';
import { isNative } from '../../util/platform';
import i18n from '../../i18n/i18n';

let syncInProgress = false;

/**
 * Online/offline event listener'larını başlat
 */
export function initOfflineSyncListener() {
    // Online olunca sync et
    window.addEventListener('online', handleOnline);

    // Native network listener — navigator.onLine'dan daha guvenilir
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

    // Service Worker'ı register et
    registerServiceWorker();
}

async function handleOnline() {
    // Zaten sync yapılıyorsa skip
    if (syncInProgress) return;

    // Service Worker'ın online durumu algılaması için kısa gecikme
    await new Promise(r => setTimeout(r, 2000));

    // Gecikme sonrası hala online mı kontrol et
    const online = await getNetworkStatus();
    if (!online) return;

    // Pending yoksa skip
    const pendingCount = await getPendingCount();
    if (pendingCount === 0) return;

    // Sync yap
    syncInProgress = true;
    try {
        await processQueue();
        await registerBackgroundSync();
    } catch (error) {
        console.error('Auto-sync hatası:', error);
    } finally {
        syncInProgress = false;
    }
}

/**
 * Service Worker register et
 */
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
            });

            console.log('Service Worker registered:', registration.scope);

            // Güncelleme kontrolü
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;

                newWorker?.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Yeni versiyon var, kullanıcıyı bilgilendir
                        if (confirm(i18n.t('common.new_version_available'))) {
                            window.location.reload();
                        }
                    }
                });
            });

            // controllerchange: yeni SW devraldiginda reload
            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if (document.visibilityState === 'visible') {
                    window.location.reload();
                }
            });

            // SW guncelleme kontrolu -- platform'a gore
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

            // Her 5 dakikada bir periyodik güncelleme kontrolü
            setInterval(() => {
                registration.update().catch(() => {});
            }, 5 * 60 * 1000);

            // Background Sync register et
            await registerBackgroundSync();
        } catch (error) {
            console.error('Service Worker registration başarısız:', error);
        }
    }
}
