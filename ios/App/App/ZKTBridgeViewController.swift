import UIKit
import WebKit
import Capacitor
import Network

class ZKTBridgeViewController: CAPBridgeViewController {

    private var hasLoadedSuccessfully = false
    private var isShowingOfflinePage = false
    private var isOnline = true
    private var loadingObservation: NSKeyValueObservation?
    private let pathMonitor = NWPathMonitor()
    private let pathMonitorQueue = DispatchQueue(label: "com.zktimer.app.reachability")

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

        // KVO on isLoading (true→false): detect a successful LIVE load. This is the only
        // job left here — there is no offline/stale fallback logic in the KVO anymore.
        // Once the live site loads, the reachability monitor stops trying to (re)load.
        loadingObservation = webView?.observe(\.isLoading, options: [.old, .new]) { [weak self] webView, change in
            guard let self = self else { return }
            let wasLoading = change.oldValue ?? false
            let isLoading = change.newValue ?? false
            guard wasLoading && !isLoading else { return }

            if let url = webView.url?.absoluteString, url.contains("zktimer.app") {
                self.hasLoadedSuccessfully = true
                self.isShowingOfflinePage = false
                print("[ZKT] Live site loaded: \(url)")
            }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        startReachabilityMonitor()

        // Bounded retry for the iOS first-launch "allow wireless data" dialog: while that
        // dialog is up the WKWebView can't connect and won't retry on its own. We retry the
        // LIVE site (never a stale local bundle). Skipped automatically once a live load
        // succeeds or while one is already in flight.
        for delay in [6.0, 12.0] {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                guard let self = self, !self.hasLoadedSuccessfully, self.isOnline else { return }
                self.loadLiveSite()
            }
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        loadingObservation?.invalidate()
        pathMonitor.cancel()
    }

    // MARK: - Reachability-driven loading
    //
    // Network reachability decides what to show instead of a blind 15s timer (the old
    // watchdog that wrongly fell back to a stale baked-in bundle):
    //   offline → bundled static offline.html (no app bundle, can never go stale)
    //   online  → (re)load the live site if it hasn't loaded yet (recovers from offline
    //             and from the first-launch wireless-data dialog).

    private func startReachabilityMonitor() {
        pathMonitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }
            DispatchQueue.main.async {
                self.isOnline = (path.status == .satisfied)
                guard !self.hasLoadedSuccessfully else { return }
                if self.isOnline {
                    self.loadLiveSite()
                } else {
                    self.showOfflinePage()
                }
            }
        }
        pathMonitor.start(queue: pathMonitorQueue)
    }

    private func loadLiveSite() {
        guard let webView = webView else { return }
        // Don't interrupt a live load that's already in flight (a legitimately slow load).
        if let url = webView.url?.absoluteString, url.contains("zktimer.app"), webView.isLoading {
            return
        }
        isShowingOfflinePage = false
        var request = URLRequest(url: URL(string: "https://zktimer.app")!)
        request.cachePolicy = .reloadRevalidatingCacheData
        webView.load(request)
        print("[ZKT] Online → loading live site")
    }

    private func showOfflinePage() {
        guard let webView = webView, !isShowingOfflinePage else { return }
        isShowingOfflinePage = true
        // Inline HTML via loadHTMLString instead of a bundled file: needs no Xcode resource
        // / pbxproj entry, so the GitHub Actions build requires no extra tracked asset and
        // cap sync can't clobber it. Self-contained (no app bundle) → can never go stale.
        webView.loadHTMLString(Self.offlineHTML, baseURL: URL(string: "https://zktimer.app"))
        print("[ZKT] Offline → showing inline offline page")
    }

    /// Branded, self-contained "no connection" page. No external assets, no app bundle.
    /// The JS auto-retry is a secondary recovery; NWPathMonitor is the primary one.
    private static let offlineHTML = """
    <!DOCTYPE html>
    <html lang="tr"><head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no,viewport-fit=cover">
    <meta name="theme-color" content="#0F142B">
    <title>Zkt Timer</title>
    <style>
      html,body{margin:0;height:100%}
      body{background:#12141C;color:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        display:flex;justify-content:center;align-items:center;min-height:100vh;text-align:center;
        padding:env(safe-area-inset-top) 1.5rem env(safe-area-inset-bottom);-webkit-tap-highlight-color:transparent}
      .wrap{max-width:22rem}
      .logo{width:4.5rem;height:4.5rem;margin:0 auto 1.5rem;display:block}
      h1{font-size:1.25rem;font-weight:700;margin:0 0 .5rem}
      p{color:#9aa0b4;font-size:.95rem;line-height:1.5;margin:0 0 1.75rem}
      button{background:#6C63FF;color:#fff;border:none;padding:.85rem 2.25rem;border-radius:10px;font-size:1rem;font-weight:600}
      button:active{opacity:.8}
      .hint{margin-top:1rem;font-size:.8rem;color:#5a6072}
    </style></head><body>
    <div class="wrap">
      <svg class="logo" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <rect x="4" y="4" width="40" height="40" rx="8" fill="#1B1E2B" stroke="#2A2E40" stroke-width="2"/>
        <rect x="11" y="11" width="8" height="8" rx="2" fill="#6C63FF"/><rect x="20" y="11" width="8" height="8" rx="2" fill="#3A3F57"/><rect x="29" y="11" width="8" height="8" rx="2" fill="#6C63FF"/>
        <rect x="11" y="20" width="8" height="8" rx="2" fill="#3A3F57"/><rect x="20" y="20" width="8" height="8" rx="2" fill="#6C63FF"/><rect x="29" y="20" width="8" height="8" rx="2" fill="#3A3F57"/>
        <rect x="11" y="29" width="8" height="8" rx="2" fill="#6C63FF"/><rect x="20" y="29" width="8" height="8" rx="2" fill="#3A3F57"/><rect x="29" y="29" width="8" height="8" rx="2" fill="#6C63FF"/>
      </svg>
      <h1>Bağlantı kurulamadı</h1>
      <p>İnternet bağlantınızı kontrol edin. Bağlantı geri geldiğinde uygulama otomatik olarak açılacak.</p>
      <button onclick="go()">Tekrar Dene</button>
      <div class="hint">Bağlantı bekleniyor…</div>
    </div>
    <script>
      var LIVE='https://zktimer.app';
      function go(){window.location.href=LIVE;}
      window.addEventListener('online',go);
      setInterval(function(){if(navigator.onLine)go();},3000);
    </script>
    </body></html>
    """

    // MARK: - Navigation Policy (back gesture toggle)

    @objc private func handleNavigationPolicy(_ notification: Notification) {
        guard let action = notification.object as? WKNavigationAction,
              let url = action.request.url?.absoluteString else { return }
        // Enable native back gesture on external domains, disable on zktimer.app
        // (so it doesn't conflict with the JS SwipeBackIndicator).
        webView?.allowsBackForwardNavigationGestures = !url.contains("zktimer.app")
    }
}
