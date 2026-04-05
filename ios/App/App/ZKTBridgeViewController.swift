import UIKit
import WebKit
import Capacitor

class ZKTBridgeViewController: CAPBridgeViewController {

    private var hasLoadedSuccessfully = false

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.navigationDelegate = self
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

    private func retryRemoteLoad() {
        guard let webView = webView else { return }
        let request = URLRequest(url: URL(string: "https://zktimer.app")!)
        webView.load(request)
        print("[ZKT] Remote yuklemesi deneniyor...")
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
            print("[ZKT] Sayfa basariyla yuklendi: \(currentUrl)")
        }
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

        // Hemen offline.html gostermek yerine, once WKWebView HTTP cache'inden yuklemeyi dene.
        // returnCacheDataDontLoad: suresi dolmus olsa bile cache'teki veriyi kullan, network'e gitme.
        print("[ZKT] Offline tespit edildi, cache'ten yukleme deneniyor")
        var request = URLRequest(url: URL(string: "https://zktimer.app")!)
        request.cachePolicy = .returnCacheDataDontLoad
        webView.load(request)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        // Cache'te de yoksa (ilk kurulum, hic acilmamis) → offline.html goster
        if !hasLoadedSuccessfully {
            print("[ZKT] Cache'te de bulunamadi, offline.html yukleniyor")
            loadOfflinePage()
        }
    }
}
