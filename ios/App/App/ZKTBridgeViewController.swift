import UIKit
import WebKit
import Capacitor

class ZKTBridgeViewController: CAPBridgeViewController {

    // Faz 2 (local bundle): the app boots from the packaged web root, so the old
    // reachability-driven loading machinery (NWPathMonitor, offline page, first-launch
    // retries, isLoading KVO) is gone — a local load cannot fail for network reasons.
    // Offline behavior lives entirely in the web layer now; freshness comes from the
    // Capgo updater. This controller only registers custom plugins and manages the
    // back-gesture policy.

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAudioPlugin())
        bridge?.registerPluginInstance(SlamDetectorPlugin())

        // Back gesture toggle: Capacitor posts this notification on every decidePolicyFor.
        // We do NOT override WKNavigationDelegate, because Capacitor's WebViewDelegationHandler
        // manages webView.isOpaque restore — overriding it produces a black screen.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNavigationPolicy(_:)),
            name: .capacitorDecidePolicyForNavigationAction,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - Navigation Policy (back gesture toggle)

    @objc private func handleNavigationPolicy(_ notification: Notification) {
        guard let action = notification.object as? WKNavigationAction,
              let url = action.request.url else { return }

        // Disable the native back gesture inside the app itself (it conflicts with the
        // JS SwipeBackIndicator): both the local shell (capacitor://localhost /
        // https://localhost) and in-webview zktimer.app pages (one-time /native-migrate
        // bridge). Enable it on genuinely external pages so users can always escape.
        let host = url.host ?? ""
        let isAppSurface = host == "localhost" || host.contains("zktimer.app")
        webView?.allowsBackForwardNavigationGestures = !isAppSurface
    }
}
