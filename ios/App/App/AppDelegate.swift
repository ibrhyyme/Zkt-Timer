import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        FirebaseApp.configure()
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

        let currentUrl = webView.url?.absoluteString ?? "nil"
        print("[ZKT] reloadAttempt - webView.url: \(currentUrl), isLoading: \(webView.isLoading)")

        // Sayfa zaten zktimer.app'ten yuklenmisse basarili say
        if currentUrl.contains("zktimer.app") && !webView.isLoading {
            print("[ZKT] Page already loaded from zktimer.app, marking as launched")
            UserDefaults.standard.set(true, forKey: "zkt_hasLaunchedBefore")
            return
        }

        print("[ZKT] Reloading with cache-busting request")
        var request = URLRequest(url: URL(string: "https://zktimer.app")!)
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        webView.load(request)
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

    // APNs token'i Firebase'e ilet — FCM token'a cevrilir
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        ApplicationDelegateProxy.shared.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        ApplicationDelegateProxy.shared.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
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
