import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
    appId: 'com.zktimer.app',
    appName: 'Zkt Timer',
    webDir: 'dist',
    backgroundColor: '#12141C',
    server: {
        url: 'https://zktimer.app',
        cleartext: false,
        allowNavigation: ['*.worldcubeassociation.org'],
    },
    android: {
        webContentsDebuggingEnabled: true,
        appendUserAgent: 'ZktTimerApp',
    },
    ios: {
        webContentsDebuggingEnabled: true,
        limitsNavigationsToAppBoundDomains: true,
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
            resizeOnFullScreen: false,
        },
        // PushNotifications presentationOptions yok — foreground'da gosterimi
        // client/util/push-notifications.ts icindeki LocalNotifications fallback'i hallediyor.
        // Bu sayede native build/store gerek olmaz.
    },
};

export default config;
