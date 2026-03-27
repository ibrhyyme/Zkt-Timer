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
        errorPath: '/error.html',
    },
    android: {
        webContentsDebuggingEnabled: true,
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: false,
            launchShowDuration: 999999,
            launchFadeOutDuration: 300,
            androidScaleType: 'CENTER_CROP',
        },
        Keyboard: {
            resize: KeyboardResize.None,
        },
    },
};

export default config;
