import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
    appId: 'com.zktimer.app',
    appName: 'Zkt Timer',
    // Faz 2: the app boots from the bundled web root (built by build-native-bundle.js)
    // instead of loading https://zktimer.app remotely. Guarantees offline cold start
    // (including first launch); freshness comes from the Capgo OTA updater below.
    webDir: 'native-bundle',
    backgroundColor: '#12141C',
    server: {
        // No `url`: local bundle is the app. allowNavigation keeps main-frame
        // navigation to zktimer.app INSIDE the WebView — required by the one-time
        // /native-migrate data bridge (old-origin IndexedDB is only reachable there).
        // WCA OAuth no longer navigates the WebView (external browser + deep link).
        allowNavigation: ['zktimer.app'],
    },
    android: {
        webContentsDebuggingEnabled: true,
        appendUserAgent: 'ZktTimerApp',
    },
    ios: {
        webContentsDebuggingEnabled: true,
        // limitsNavigationsToAppBoundDomains was only needed for Service Worker
        // support in the remote-loading era; with a local bundle it would restrict
        // WKWebView scripting on the capacitor://localhost origin. Must stay off.
        appendUserAgent: 'ZktTimerApp',
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 10000,
            launchFadeOutDuration: 300,
            androidScaleType: 'CENTER_CROP',
        },
        Keyboard: {
            resize: KeyboardResize.None,
        },
        // PushNotifications presentationOptions yok — foreground'da gosterimi
        // client/util/push-notifications.ts icindeki LocalNotifications fallback'i hallediyor.
        // Bu sayede native build/store gerek olmaz.
        CapacitorUpdater: {
            // Self-hosted OTA: checks our endpoint on launch/background, downloads the
            // zip, applies on next start. client calls notifyAppReady() after boot;
            // if it doesn't arrive within appReadyTimeout the bundle is auto-rolled
            // back (the antidote to the old stale-bundle incident).
            autoUpdate: true,
            updateUrl: 'https://zktimer.app/api/ota/latest',
            statsUrl: '',
            appReadyTimeout: 15000,
        },
    },
};

export default config;
