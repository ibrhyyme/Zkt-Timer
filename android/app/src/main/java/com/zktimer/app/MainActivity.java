package com.zktimer.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

public class MainActivity extends BridgeActivity {
    /** App background (#12141C) — what shows through wherever the WebView does not paint. */
    private static final int WINDOW_BACKGROUND = 0xFF12141C;

    /** Shortest gap between two renderer-death recoveries before we stop recreating. */
    private static final long RENDERER_RESTART_COOLDOWN_MS = 10000;

    private long lastRendererRestartAt = 0;

    @Override
    public void onConfigurationChanged(android.content.res.Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        updateOrientationLock();
        // The core SystemBars plugin re-applies its own decor background here; ours goes last.
        applyWindowBackground();
    }

    private void updateOrientationLock() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        double widthInch = (double) dm.widthPixels / dm.xdpi;
        double heightInch = (double) dm.heightPixels / dm.ydpi;
        double diagonalInch = Math.sqrt(widthInch * widthInch + heightInch * heightInch);
        int smallestWidthDp = getResources().getConfiguration().smallestScreenWidthDp;

        int target;
        if (diagonalInch >= 9.0) {
            // Buyuk tablet → landscape kilitli
            target = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        } else if (smallestWidthDp >= 600) {
            // Foldable acik / kucuk tablet → serbest
            target = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
        } else {
            // Normal telefon → portrait kilitli
            target = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        }

        // Re-applying the same value still forces a window relayout, and this runs on every
        // configuration change. Skipping the no-op keeps the window untouched on rotation.
        if (getRequestedOrientation() == target) {
            return;
        }
        setRequestedOrientation(target);
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
        registerPlugin(SlamDetectorPlugin.class);
        registerPlugin(NativeCalendarPlugin.class);
        super.onCreate(savedInstanceState);

        // Deferred by one frame rather than called inline. The system hands the splash
        // screen surface over to the activity during its first draw; changing the requested
        // orientation while that is in flight crashes inside
        // ActivityThread.syncTransferSplashscreenViewTransaction on a null SurfaceControl.
        // That was the app's most reported Play Console crash (Xiaomi/HyperOS devices,
        // where a cold start after the Bluetooth permission dialog hits it most often).
        getWindow().getDecorView().post(this::updateOrientationLock);

        // Status bar ve navigation bar ikonlarını açık renk yap (koyu tema için)
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        // Login sonrasi session cookie'nin disk'e garantili yazilmasi icin
        // CookieManager'i acik tut. Default'ta acik ama emniyet icin set ediyoruz.
        CookieManager.getInstance().setAcceptCookie(true);

        disableSystemBarContrast();
        applyWindowBackground();
        surviveRenderProcessDeath();
    }

    /**
     * When the WebView's render process dies (most often an out-of-memory kill on a
     * low-RAM device), Android kills the entire app process unless onRenderProcessGone
     * reports the state as handled. Capacitor's BridgeWebViewClient returns false unless a
     * listener claims it, and nothing registered one, so a renderer death showed up to the
     * user as the app vanishing with no error at all.
     *
     * A dead WebView can never be reused, so the view is detached and destroyed and the
     * activity is recreated. Session cookies live in CookieManager, not in the WebView, so
     * the user comes back signed in.
     */
    private void surviveRenderProcessDeath() {
        // Null on a device with no usable WebView: BridgeActivity bails out of onCreate
        // before building the bridge and shows its no_webview layout instead.
        if (getBridge() == null) {
            return;
        }
        getBridge()
            .addWebViewListener(
                new WebViewListener() {
                    @Override
                    public boolean onRenderProcessGone(WebView webView, RenderProcessGoneDetail detail) {
                        long now = System.currentTimeMillis();
                        // If the fresh renderer dies again straight away, recreating in a loop
                        // would be worse than sitting still. Claim the event either way: that is
                        // what stops the system from killing the process.
                        if (now - lastRendererRestartAt < RENDERER_RESTART_COOLDOWN_MS) {
                            return true;
                        }
                        lastRendererRestartAt = now;

                        ViewGroup parent = (ViewGroup) webView.getParent();
                        if (parent != null) {
                            parent.removeView(webView);
                        }
                        webView.destroy();
                        recreate();
                        return true;
                    }
                }
            );
    }

    /**
     * Capacitor's SystemBars plugin paints the decor view with the theme's
     * android:windowBackground. The active theme (AppTheme.NoActionBarLaunch, a
     * Theme.SplashScreen child) declares that as a drawable, so the plugin's
     * TypedValue.data is a resource id read as a color — a junk value. Pin the real
     * app background instead, so any sliver the WebView does not cover matches it.
     */
    private void applyWindowBackground() {
        getWindow().getDecorView().setBackgroundColor(WINDOW_BACKGROUND);
    }

    /**
     * API 29+ draws an automatic contrast scrim behind transparent system bars.
     * Combined with the safe-area plugin's IME handling, that scrim can get stuck
     * as a black strip at the keyboard boundary. Disable it; bar colors are managed
     * explicitly by the SafeArea/StatusBar plugins. No-op when bars are opaque.
     */
    private void disableSystemBarContrast() {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        // Re-assert in case the system or a plugin reset the window flags.
        disableSystemBarContrast();
        applyWindowBackground();
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
