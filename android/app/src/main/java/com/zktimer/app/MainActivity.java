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

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Fiziksel ekran boyutuna göre yön kilidi
        // Z Fold açık ~7.6", gerçek tabletler 10"+, eşik 9"
        DisplayMetrics dm = getResources().getDisplayMetrics();
        double widthInch = (double) dm.widthPixels / dm.xdpi;
        double heightInch = (double) dm.heightPixels / dm.ydpi;
        double diagonalInch = Math.sqrt(widthInch * widthInch + heightInch * heightInch);
        boolean isTablet = diagonalInch >= 9.0;
        setRequestedOrientation(isTablet
            ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            : ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

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
