package com.zktimer.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.util.DisplayMetrics;
import android.view.View;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.graphics.Insets;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;

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
            FirebaseApp.initializeApp(this);
        }
        registerPlugin(GestureExclusionPlugin.class);
        super.onCreate(savedInstanceState);

        updateOrientationLock();

        // Status bar ve navigation bar ikonlarını açık renk yap (koyu tema için)
        WindowInsetsControllerCompat insetsController =
            WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        insetsController.setAppearanceLightStatusBars(false);
        insetsController.setAppearanceLightNavigationBars(false);

        // System bar insets'lerini content view'a padding olarak uygula
        // Android 15+ (targetSdk 35) edge-to-edge zorunlu olduğundan bu gerekli
        View contentView = findViewById(android.R.id.content);
        ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
            Insets systemBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars());
            Insets cutout = windowInsets.getInsets(WindowInsetsCompat.Type.displayCutout());

            int top = Math.max(systemBars.top, cutout.top);
            int bottom = Math.max(systemBars.bottom, cutout.bottom);
            int left = Math.max(systemBars.left, cutout.left);
            int right = Math.max(systemBars.right, cutout.right);

            v.setPadding(left, top, right, bottom);
            return WindowInsetsCompat.CONSUMED;
        });
    }
}
