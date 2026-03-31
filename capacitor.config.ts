import { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
    appId: 'com.zktimer.app',
    appName: 'Zkt-Timer',
    webDir: 'dist',
    backgroundColor: '#12141C',
    server: {
        url: 'https://zktimer.app',
        cleartext: false,
        allowNavigation: ['*.worldcubeassociation.org'],
    },
    android: {
        webContentsDebuggingEnabled: true,
    },
    ios: {
        webContentsDebuggingEnabled: true,
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
