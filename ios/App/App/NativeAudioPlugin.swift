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

    @objc func preload(_ call: CAPPluginCall) {
        let assetId = call.getString("assetId") ?? ""
        let fileName = call.getString("fileName") ?? ""

        guard let url = Bundle.main.url(forResource: fileName, withExtension: "mp3", subdirectory: "audio") else {
            call.reject("Audio file not found: \(fileName)")
            return
        }

        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.enableRate = true
            player.prepareToPlay()
            players[assetId] = player
            call.resolve()
        } catch {
            call.reject("Failed to load audio: \(error.localizedDescription)")
        }
    }

    @objc func play(_ call: CAPPluginCall) {
        let assetId = call.getString("assetId") ?? ""
        let rate = call.getFloat("rate") ?? 1.0

        guard let player = players[assetId] else {
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
        }

        call.resolve()
    }
}
