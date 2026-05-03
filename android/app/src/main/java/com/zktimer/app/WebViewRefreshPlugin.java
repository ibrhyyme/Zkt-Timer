package com.zktimer.app;

import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Klavye kapandiktan sonra WebView surface paint cache'inde kalan siyah cizgi
 * artifact'ini temizlemek icin WebView'i kisa sure GONE -> VISIBLE yapip
 * surface'i yeniden olusturmaya zorlar.
 *
 * Kullanicinin manuel olarak app'i background'a alip geri dondurdugundeki
 * davranisi simule eder (Activity lifecycle onPause/onResume → WebView
 * surface invalidate). JS'den klavye `keyboardDidHide` event'inde cagirilir.
 */
@CapacitorPlugin(name = "WebViewRefresh")
public class WebViewRefreshPlugin extends Plugin {

    @PluginMethod()
    public void refresh(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            View view = bridge.getWebView();
            if (!(view instanceof WebView)) {
                call.resolve();
                return;
            }
            WebView wv = (WebView) view;

            // WebView'i suspend → resume — kullanicinin "background → foreground"
            // davranisinin tam karsiligi. WebView GPU resources release edilir,
            // sonra yeniden olusturulur. Paint cache compositor seviyesinde temizlenir.
            wv.onPause();
            wv.post(() -> {
                wv.onResume();
                call.resolve();
            });
        });
    }
}
