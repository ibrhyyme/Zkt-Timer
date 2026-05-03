package com.zktimer.app;

import android.view.View;
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
            View webView = bridge.getWebView();
            if (webView == null) {
                call.resolve();
                return;
            }

            // WebView'i kisa sure gizle, sonra geri goster — surface invalidate
            webView.setVisibility(View.GONE);
            webView.post(() -> webView.setVisibility(View.VISIBLE));
            call.resolve();
        });
    }
}
