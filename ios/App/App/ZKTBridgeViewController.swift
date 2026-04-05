import UIKit
import WebKit
import Capacitor

class ZKTBridgeViewController: CAPBridgeViewController {

    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.navigationDelegate = self
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
        print("[ZKT] Sayfa basariyla yuklendi: \(currentUrl)")
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        print("[ZKT] Navigation hatasi: \(nsError.code) - \(nsError.localizedDescription)")
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        let nsError = error as NSError
        print("[ZKT] Yukleme hatasi: \(nsError.code) - \(nsError.localizedDescription)")
    }
}
