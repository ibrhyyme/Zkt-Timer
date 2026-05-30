package com.zktimer.app;

import android.graphics.Rect;
import android.os.Build;
import android.view.View;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

/**
 * Centik (notch) bolgelerini Android'in geri hareketinden muaf tutar.
 * JS tarafindan centik pozisyonu degistiginde cagirilir.
 *
 * Plugin iki ayri rect tutar: sag (navigation drawer) + sol (settings drawer).
 * Her update'te non-null rect'lerin birlesik listesi
 * setSystemGestureExclusionRects'e gonderilir; boylece iki notch bagimsiz
 * yonetilebilir, biri digerinin exclusion'ini ezmez.
 *
 * side parametresi opsiyonel; verilmezse 'right' (geri uyumluluk).
 */
@CapacitorPlugin(name = "GestureExclusion")
public class GestureExclusionPlugin extends Plugin {

    private Rect rightRect = null;
    private Rect leftRect = null;

    @PluginMethod()
    public void update(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.resolve();
            return;
        }

        String side = call.getString("side", "right");
        double yPercent = call.getDouble("yPercent", 50.0);
        double heightPx = call.getDouble("heightPx", 115.0);

        getActivity().runOnUiThread(() -> {
            View contentView = getActivity().findViewById(android.R.id.content);
            if (contentView == null) {
                call.resolve();
                return;
            }

            int viewHeight = contentView.getHeight();
            int viewWidth = contentView.getWidth();
            float density = getActivity().getResources().getDisplayMetrics().density;

            // Centik merkez Y'si (yuzde -> piksel)
            int centerY = (int) (viewHeight * yPercent / 100.0);
            // Centik yuksekligi + ekstra dokunma alani
            int exclusionHeight = (int) (heightPx * density) + (int) (40 * density);
            // Kenardan 48dp genislik
            int exclusionWidth = (int) (48 * density);

            int top = Math.max(0, centerY - exclusionHeight / 2);
            int bottom = Math.min(viewHeight, centerY + exclusionHeight / 2);

            Rect newRect;
            if ("left".equals(side)) {
                newRect = new Rect(0, top, exclusionWidth, bottom);
                leftRect = newRect;
            } else {
                newRect = new Rect(viewWidth - exclusionWidth, top, viewWidth, bottom);
                rightRect = newRect;
            }

            contentView.setSystemGestureExclusionRects(currentRects());
            call.resolve();
        });
    }

    @PluginMethod()
    public void clear(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.resolve();
            return;
        }

        String side = call.getString("side", null);

        getActivity().runOnUiThread(() -> {
            View contentView = getActivity().findViewById(android.R.id.content);
            if (contentView == null) {
                call.resolve();
                return;
            }

            if (side == null) {
                // Tum exclusion'lari temizle (geri uyumluluk)
                rightRect = null;
                leftRect = null;
            } else if ("left".equals(side)) {
                leftRect = null;
            } else {
                rightRect = null;
            }

            contentView.setSystemGestureExclusionRects(currentRects());
            call.resolve();
        });
    }

    private List<Rect> currentRects() {
        List<Rect> rects = new ArrayList<>();
        if (rightRect != null) rects.add(rightRect);
        if (leftRect != null) rects.add(leftRect);
        return rects;
    }
}
