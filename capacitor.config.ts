import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'com.zktimer.app',
    appName: 'Zkt-Timer',
    webDir: 'dist',
    server: {
        url: 'https://zktimer.app',
        cleartext: false,
    },
    plugins: {
        SplashScreen: {
            launchAutoHide: true,
            launchShowDuration: 10000,
            launchFadeOutDuration: 300,
            androidScaleType: 'CENTER_CROP',
        },
    },
};

export default config;
