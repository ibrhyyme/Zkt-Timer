/**
 * Global Offline Sync Listener
 *
 * Online/offline event'lerini dinler ve automatik sync yapar
 */

import { processQueue, registerBackgroundSync, isOnline } from '../../util/offline-sync';
import { getPendingCount } from '../../util/offline-queue';
import i18n from '../../i18n/i18n';

let syncInProgress = false;

/**
 * Online/offline event listener'larını başlat
 */
export function initOfflineSyncListener() {
    // Online olunca sync et
    window.addEventListener('online', handleOnline);

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
    if (!navigator.onLine) return;

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

            // Uygulama öne geldiğinde SW güncelleme kontrolü yap
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    registration.update().catch(() => {});
                }
            });

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
