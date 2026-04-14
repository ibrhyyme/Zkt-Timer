import UIKit
import WebKit
import Capacitor

class ZKTBridgeViewController: CAPBridgeViewController {

    private var hasLoadedSuccessfully = false
    private var isLoadingFallback = false
    private var loadingObservation: NSKeyValueObservation?
    private var failCheckTimer: Timer?

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAudioPlugin())

        // Back gesture toggle: Capacitor her decidePolicyFor'da bu notification'i gonderiyor.
        // WKNavigationDelegate'i override etmiyoruz, cunku Capacitor'un WebViewDelegationHandler'i
        // webView.isOpaque restore islemini yonetiyor — ezersek siyah ekran olusuyor.
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleNavigationPolicy(_:)),
            name: .capacitorDecidePolicyForNavigationAction,
            object: nil
        )

        // KVO: isLoading true→false gecisiyle navigation tamamlanmasini yakala (didFinish/didFail yerine)
        loadingObservation = webView?.observe(\.isLoading, options: [.old, .new]) { [weak self] webView, change in
            guard let self = self else { return }
            let wasLoading = change.oldValue ?? false
            let isLoading = change.newValue ?? false
            guard wasLoading && !isLoading else { return }

            let currentUrl = webView.url?.absoluteString ?? ""

            if currentUrl.contains("zktimer.app") {
                self.hasLoadedSuccessfully = true
                self.isLoadingFallback = false
                self.failCheckTimer?.invalidate()
                UserDefaults.standard.set(true, forKey: "zkt_hasLaunchedBefore")
                print("[ZKT] Sayfa basariyla yuklendi: \(currentUrl)")
            } else if !self.hasLoadedSuccessfully && !self.isLoadingFallback && !currentUrl.contains("offline") {
                print("[ZKT] Loading tamamlandi ama basarisiz: \(currentUrl)")
                self.isLoadingFallback = true
                self.loadOfflineBundle()
            }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // Watchdog: 15s icinde basarili yuklenme olmazsa offline fallback
        failCheckTimer = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: false) { [weak self] _ in
            guard let self = self, !self.hasLoadedSuccessfully else { return }
            print("[ZKT] Watchdog: 15s icinde yuklenemedi, offline fallback")
            if !self.isLoadingFallback {
                self.isLoadingFallback = true
                self.loadOfflineBundle()
            }
        }
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
        loadingObservation?.invalidate()
        failCheckTimer?.invalidate()
    }

    // MARK: - Navigation Policy (back gesture toggle)

    @objc private func handleNavigationPolicy(_ notification: Notification) {
        guard let action = notification.object as? WKNavigationAction,
              let url = action.request.url?.absoluteString else { return }
        // Harici domainlerde native back gesture ac, zktimer.app'te kapat (JS SwipeBackIndicator ile cakismasin)
        webView?.allowsBackForwardNavigationGestures = !url.contains("zktimer.app")
    }

    // MARK: - Offline Fallback

    private func loadOfflineBundle() {
        guard let webView = webView else { return }

        if let indexPath = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "offline-bundle") {
            let fileURL = URL(fileURLWithPath: indexPath)
            let dirURL = URL(fileURLWithPath: Bundle.main.path(forResource: "offline-bundle", ofType: nil)!)
            webView.loadFileURL(fileURL, allowingReadAccessTo: dirURL)
            print("[ZKT] Offline bundle yukleniyor")
        } else {
            loadOfflinePage()
        }
    }

    private func loadOfflinePage() {
        guard let webView = webView else { return }

        let offlinePath = Bundle.main.path(forResource: "offline", ofType: "html", inDirectory: "public")
        guard let path = offlinePath else {
            print("[ZKT] offline.html bulunamadi!")
            return
        }

        let fileURL = URL(fileURLWithPath: path)
        let dirURL = fileURL.deletingLastPathComponent()
        webView.loadFileURL(fileURL, allowingReadAccessTo: dirURL)
        print("[ZKT] offline.html yuklendi")
    }
}
