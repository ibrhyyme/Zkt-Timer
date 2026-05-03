package com.zktimer.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.webkit.CookieManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        updateOrientationLock();
    }

    private void updateOrientationLock() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        double widthInch = (double) dm.widthPixels / dm.xdpi;
        double heightInch = (double) dm.heightPixels / dm.ydpi;
        double diagonalInch = Math.sqrt(widthInch * widthInch + heightInch * heightInch);
        int smallestWidthDp = getResources().getConfiguration().smallestScreenWidthDp;

        if (diagonalInch >= 9.0) {
            // Buyuk tablet → landscape kilitli
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        } else if (smallestWidthDp >= 600) {
            // Foldable acik / kucuk tablet → serbest
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            // Normal telefon → portrait kilitli
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        if (FirebaseApp.getApps(this).isEmpty()) {
            FirebaseOptions options = new FirebaseOptions.Builder()
                .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                .setApiKey(BuildConfig.FIREBASE_API_KEY)
                .setStorageBucket(BuildConfig.FIREBASE_STORAGE_BUCKET)
                .build();
            FirebaseApp.initializeApp(this, options);
        }
        registerPlugin(GestureExclusionPlugin.class);
        super.onCreate(savedInstanceState);

        updateOrientationLock();

        // Status bar ve navigation bar ikonlarını açık renk yap (koyu tema için)
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        // Login sonrasi session cookie'nin disk'e garantili yazilmasi icin
        // CookieManager'i acik tut. Default'ta acik ama emniyet icin set ediyoruz.
        CookieManager.getInstance().setAcceptCookie(true);
    }

    /**
     * Android WebView session cookie'leri memory'de tutar; disk'e flush
     * acikca cagrilmadigi surece process ölümünde kaybolabilir.
     * Login sonrasi 5-10sn icinde uygulama kapatilirsa kullanici tekrar
     * login ekranina dustugu icin onPause/onStop'da flush ediyoruz.
     */
    @Override
    public void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override
    public void onStop() {
        super.onStop();
        CookieManager.getInstance().flush();
    }
}
