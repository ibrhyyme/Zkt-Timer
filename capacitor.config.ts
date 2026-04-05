import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

// !! DIKKAT: "npx cap sync" KULLANMA — her zaman yarn script'lerini kullan:
//   yarn cap-sync-ios      → iOS icin local asset build + sync
//   yarn cap-sync-android  → Android icin sync + server.url ekleme
//
// iOS: server.url YOK → local asset'lerden yuklenir (offline calisir)
// Android: server.url post-sync script ile eklenir
const config: CapacitorConfig = {
    appId: 'com.zktimer.app',
    appName: 'Zkt-Timer',
    webDir: 'dist',
    backgroundColor: '#12141C',
    server: {
        cleartext: false,
        allowNavigation: ['*.worldcubeassociation.org'],
    },
    android: {
        webContentsDebuggingEnabled: true,
    },
    ios: {
        webContentsDebuggingEnabled: true,
        limitsNavigationsToAppBoundDomains: true,
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
    },
};

export default config;
