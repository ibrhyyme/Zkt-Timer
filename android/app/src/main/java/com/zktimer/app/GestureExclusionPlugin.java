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
 * Centik (notch) bolgesini Android'in geri hareketinden muaf tutar.
 * JS tarafindan centik pozisyonu degistiginde cagirilir.
 */
@CapacitorPlugin(name = "GestureExclusion")
public class GestureExclusionPlugin extends Plugin {

    @PluginMethod()
    public void update(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.resolve();
            return;
        }

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
            // Sag kenardan 48dp genislik
            int exclusionWidth = (int) (48 * density);

            int top = Math.max(0, centerY - exclusionHeight / 2);
            int bottom = Math.min(viewHeight, centerY + exclusionHeight / 2);

            List<Rect> exclusions = new ArrayList<>();
            exclusions.add(new Rect(
                viewWidth - exclusionWidth,
                top,
                viewWidth,
                bottom
            ));

            contentView.setSystemGestureExclusionRects(exclusions);
            call.resolve();
        });
    }

    @PluginMethod()
    public void clear(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            call.resolve();
            return;
        }

        getActivity().runOnUiThread(() -> {
            View contentView = getActivity().findViewById(android.R.id.content);
            if (contentView != null) {
                contentView.setSystemGestureExclusionRects(new ArrayList<>());
            }
            call.resolve();
        });
    }
}
