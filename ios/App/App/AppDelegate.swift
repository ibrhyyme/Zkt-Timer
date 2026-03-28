import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // iOS ilk acilista "kablosuz veri kullanabilsin mi?" diyalogu gosterir.
        // WKWebView bu diyalog acikken baglanamiyor ve otomatik retry yapmiyor.
        // Splash auto-hide (10 sn) ile ayni anda tek seferlik reload yapiyoruz.
        // Bu noktada kullanici izni coktan vermis oluyor (genelde 2-3 sn icinde).
        if !UserDefaults.standard.bool(forKey: "zkt_hasLaunchedBefore") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 10.0) { [weak self] in
                self?.singleReloadAttempt()
            }
        }
        return true
    }

    private func singleReloadAttempt() {
        guard let vc = window?.rootViewController as? CAPBridgeViewController,
              let webView = vc.webView else { return }

        webView.evaluateJavaScript("typeof window.__STORE__ !== 'undefined'") { result, _ in
            UserDefaults.standard.set(true, forKey: "zkt_hasLaunchedBefore")

            if result as? Bool == true {
                return // Sayfa zaten yuklenmis
            }
            // Sayfa yuklenemedi -- cache'siz tek seferlik reload
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
