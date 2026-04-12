import UIKit
import WebKit
import Capacitor

class ZKTBridgeViewController: CAPBridgeViewController {

    private var hasLoadedSuccessfully = false
    private var isLoadingFallback = false

    override func viewDidLoad() {
        super.viewDidLoad()
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeAudioPlugin())
        // Capacitor webView yuklendikten sonra navigation delegate'i ayarla
        webView?.navigationDelegate = self
    }

    /// Offline bundle'dan index.html yukle
    private func loadOfflineBundle() {
        guard let webView = webView else { return }

        // offline-bundle klasorundeki index.html'i ara
        if let indexPath = Bundle.main.path(forResource: "index", ofType: "html", inDirectory: "offline-bundle") {
            let fileURL = URL(fileURLWithPath: indexPath)
            let dirURL = URL(fileURLWithPath: Bundle.main.path(forResource: "offline-bundle", ofType: nil)!)
            webView.loadFileURL(fileURL, allowingReadAccessTo: dirURL)
            print("[ZKT] Offline bundle yukleniyor")
        } else {
            // offline-bundle yoksa basit offline.html goster
            loadOfflinePage()
        }
    }

    /// Basit offline sayfasi (baglanti yok mesaji)
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

// MARK: - WKNavigationDelegate
extension ZKTBridgeViewController: WKNavigationDelegate {

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        let url = navigationAction.request.url?.absoluteString ?? ""

        // Harici domainlerde native back gesture ac, zktimer.app'te kapat (JS SwipeBackIndicator ile cakismasin)
        webView.allowsBackForwardNavigationGestures = !url.contains("zktimer.app")

        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let currentUrl = webView.url?.absoluteString ?? ""
        if currentUrl.contains("zktimer.app") {
            hasLoadedSuccessfully = true
        }
        isLoadingFallback = false
        print("[ZKT] Sayfa basariyla yuklendi: \(currentUrl)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        print("[ZKT] Navigation hatasi: \(nsError.code) - \(nsError.localizedDescription)")

        let offlineErrors: Set<Int> = [
            0,                                    // SW redirect rejection (iOS)
            NSURLErrorNotConnectedToInternet,      // -1009
            NSURLErrorTimedOut,                    // -1001
            NSURLErrorCannotConnectToHost,         // -1004
            NSURLErrorNetworkConnectionLost,       // -1005
            NSURLErrorDNSLookupFailed,             // -1006
            NSURLErrorCannotFindHost,              // -1003
        ]

        guard offlineErrors.contains(nsError.code) else { return }

        // Zaten fallback deniyorsak ve o da basarisiz olduysa → basit offline.html
        if isLoadingFallback {
            print("[ZKT] Fallback da basarisiz, offline.html gosteriliyor")
            loadOfflinePage()
            return
        }

        // Sunucu yuklenemedi → local bundle'dan tam uygulamayi yukle
        print("[ZKT] Offline tespit edildi, offline bundle yukleniyor")
        isLoadingFallback = true
        loadOfflineBundle()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        print("[ZKT] Yukleme hatasi: \(nsError.code) - \(nsError.localizedDescription)")
        if !hasLoadedSuccessfully && !isLoadingFallback {
            loadOfflinePage()
        }
    }
}
