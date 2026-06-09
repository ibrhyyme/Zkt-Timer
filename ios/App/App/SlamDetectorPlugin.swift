import Capacitor
import CoreMotion

/// Thin native peak-detector for the "slam to stop" timer feature.
/// Streams nothing to JS — compares accelerometer magnitude deviation
/// against a threshold supplied by the TS layer and emits a discrete
/// "slam" event when it fires. All decision logic (sensitivity mapping,
/// arming window, lifecycle) lives in TypeScript.
@objc(SlamDetectorPlugin)
public class SlamDetectorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SlamDetectorPlugin"
    public let jsName = "SlamDetector"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private let motionManager = CMMotionManager()
    private let queue = OperationQueue()
    // Threshold in g for |magnitude - 1g| deviation; set per start() call
    private var threshold: Double = 1.0
    private var refractorySeconds: Double = 0.15
    private var lastFireAt: TimeInterval = 0

    @objc func start(_ call: CAPPluginCall) {
        guard motionManager.isAccelerometerAvailable else {
            call.reject("Accelerometer not available")
            return
        }

        threshold = call.getDouble("threshold") ?? 1.0
        refractorySeconds = Double(call.getInt("refractoryMs") ?? 150) / 1000.0
        lastFireAt = 0

        // Restart cleanly if already running (e.g. threshold update from slider)
        if motionManager.isAccelerometerActive {
            motionManager.stopAccelerometerUpdates()
        }

        motionManager.accelerometerUpdateInterval = 0.01 // 100Hz, matches Android
        motionManager.startAccelerometerUpdates(to: queue) { [weak self] data, error in
            guard let self = self, let data = data, error == nil else { return }

            let a = data.acceleration // already in g on iOS
            let magnitude = sqrt(a.x * a.x + a.y * a.y + a.z * a.z)
            // Deviation from 1g — orientation- and sample-rate-independent
            let deviation = abs(magnitude - 1.0)

            if deviation > self.threshold {
                let now = Date().timeIntervalSince1970
                if now - self.lastFireAt >= self.refractorySeconds {
                    self.lastFireAt = now
                    // Epoch ms — CMAccelerometerData.timestamp is boot-relative, unusable for endTimer
                    self.notifyListeners("slam", data: [
                        "timestamp": now * 1000.0,
                        "magnitude": deviation,
                    ])
                }
            }
        }

        call.resolve()
    }

    @objc func stop(_ call: CAPPluginCall) {
        motionManager.stopAccelerometerUpdates()
        call.resolve()
    }
}
