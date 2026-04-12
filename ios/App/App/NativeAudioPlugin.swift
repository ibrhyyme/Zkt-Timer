import Capacitor
import AVFoundation

@objc(NativeAudioPlugin)
public class NativeAudioPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeAudioPlugin"
    public let jsName = "NativeAudio"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "preload", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
    ]

    private var players: [String: AVAudioPlayer] = [:]

    /// Bundle icinde audio dosyasini birden fazla yoldan ara
    private func findAudioURL(_ fileName: String) -> URL? {
        // 1) audio/ subdirectory icinde (Create folder references)
        if let url = Bundle.main.url(forResource: fileName, withExtension: "mp3", subdirectory: "audio") {
            return url
        }
        // 2) Bundle root'ta (Create groups — Xcode default)
        if let url = Bundle.main.url(forResource: fileName, withExtension: "mp3") {
            return url
        }
        // 3) public/audio/ subdirectory (cap sync kopyaladiysa)
        if let url = Bundle.main.url(forResource: fileName, withExtension: "mp3", subdirectory: "public/audio") {
            return url
        }
        return nil
    }

    @objc func preload(_ call: CAPPluginCall) {
        let assetId = call.getString("assetId") ?? ""
        let fileName = call.getString("fileName") ?? ""

        guard let url = findAudioURL(fileName) else {
            print("[ZKT] NativeAudio: file not found in bundle: \(fileName).mp3")
            call.reject("Audio file not found: \(fileName)")
            return
        }

        print("[ZKT] NativeAudio: loading \(assetId) from \(url.path)")

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.enableRate = true
            player.prepareToPlay()
            players[assetId] = player
            print("[ZKT] NativeAudio: preloaded \(assetId) OK")
            call.resolve()
        } catch {
            print("[ZKT] NativeAudio: load error: \(error.localizedDescription)")
            call.reject("Failed to load audio: \(error.localizedDescription)")
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        let assetId = call.getString("assetId") ?? ""
        let rate = call.getFloat("rate") ?? 1.0

        guard let player = players[assetId] else {
            print("[ZKT] NativeAudio: not preloaded: \(assetId)")
            call.reject("Audio not preloaded: \(assetId)")
            return
        }

        // Her play oncesi audio session'i yeniden ayarla
        // WKWebView override etmis olabilir
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            print("[ZKT] AVAudioSession error: \(error)")
        }

        DispatchQueue.main.async {
            player.currentTime = 0
            player.rate = rate
            player.play()
            print("[ZKT] NativeAudio: playing \(assetId) at rate \(rate)")
        }

        call.resolve()
    }
}
