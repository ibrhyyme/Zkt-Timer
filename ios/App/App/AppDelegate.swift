import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // iOS ilk acilista "kablosuz veri kullanabilsin mi?" diyalogu gosterir.
        // WKWebView bu diyalog acikken baglanamiyor ve otomatik retry yapmiyor.
        // 10, 15, 20 saniyede retry yapiyoruz. Basarili olunca duruyor.
        let isFirstLaunch = !UserDefaults.standard.bool(forKey: "zkt_hasLaunchedBefore")
        print("[ZKT] didFinishLaunching - isFirstLaunch: \(isFirstLaunch)")

        if isFirstLaunch {
            for delay in [10.0, 15.0, 20.0] {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) { [weak self] in
                    print("[ZKT] \(delay)s timer fired")
                    self?.reloadAttempt()
                }
            }
        }
        return true
    }

    private func reloadAttempt() {
        // Onceki denemede basarili olduysa atla
        guard !UserDefaults.standard.bool(forKey: "zkt_hasLaunchedBefore") else {
            print("[ZKT] Already loaded, skipping")
            return
        }

        guard let vc = window?.rootViewController as? CAPBridgeViewController,
              let webView = vc.webView else {
            print("[ZKT] reloadAttempt - webView nil!")
            return
        }

        print("[ZKT] reloadAttempt - webView.url: \(webView.url?.absoluteString ?? "nil"), isLoading: \(webView.isLoading)")

        webView.evaluateJavaScript("typeof window.__STORE__ !== 'undefined'") { result, error in
            let storeExists = result as? Bool == true
            print("[ZKT] evaluateJS - __STORE__ exists: \(storeExists), error: \(error?.localizedDescription ?? "none")")

            if storeExists {
                print("[ZKT] Page loaded, marking as launched")
                UserDefaults.standard.set(true, forKey: "zkt_hasLaunchedBefore")
                return
            }

            print("[ZKT] Reloading with cache-busting request")
            var request = URLRequest(url: URL(string: "https://zktimer.app")!)
            request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
            webView.load(request)
        }
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

    // Telefon: sadece dikey, Tablet: sadece yatay
    // Info.plist'te 4 yon var (Apple multitasking zorunlulugu), runtime'da kisitliyoruz
    func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
        if UIDevice.current.userInterfaceIdiom == .pad {
            return .landscape
        }
        return .portrait
    }

}
