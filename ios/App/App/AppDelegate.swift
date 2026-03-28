import UIKit
import Capacitor
import CoreTelephony

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var cellularData: CTCellularData?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // iOS ilk acilista "kablosuz veri kullanabilsin mi?" diyalogu gosterir.
        // WKWebView bu diyalog acikken baglanamiyor. Izin verildikten sonra da
        // otomatik retry yapmiyor. CTCellularData ile izin aninda reload yapiyoruz.
        if !UserDefaults.standard.bool(forKey: "zkt_hasLaunchedBefore") {
            setupFirstLaunchNetworkHandler()
        }
        return true
    }

    private func setupFirstLaunchNetworkHandler() {
        cellularData = CTCellularData()
        cellularData?.cellularDataRestrictionDidUpdateNotifier = { [weak self] state in
            guard let self = self else { return }
            if state == .notRestricted {
                // Kullanici izin verdi. 0.5 sn bekle (iOS network'u aktif etsin), sonra reload.
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                    self.reloadIfNeeded()
                }
            }
        }
    }

    private func reloadIfNeeded() {
        guard let vc = window?.rootViewController as? CAPBridgeViewController,
              let webView = vc.webView else { return }

        // Sayfa zaten yukleniyor mu? Mudahale etme.
        if webView.isLoading { return }

        // Sayfa yuklendi mi?
        webView.evaluateJavaScript("typeof window.__STORE__ !== 'undefined'") { [weak self] result, _ in
            if result as? Bool == true {
                // Sayfa zaten yuklenmis, temizle.
                self?.markAsLoaded()
                return
            }
            // Sayfa yuklenemedi, tek seferlik reload.
            webView.load(URLRequest(url: URL(string: "https://zktimer.app")!))
            // 5 sn sonra ne olursa olsun temizle (sonsuz dongu onlemi).
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.0) {
                self?.markAsLoaded()
            }
        }
    }

    private func markAsLoaded() {
        UserDefaults.standard.set(true, forKey: "zkt_hasLaunchedBefore")
        cellularData?.cellularDataRestrictionDidUpdateNotifier = nil
        cellularData = nil
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
