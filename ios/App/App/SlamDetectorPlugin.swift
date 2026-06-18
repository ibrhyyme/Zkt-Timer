import Capacitor
import CoreMotion

/// Thin native peak-detector for the "slam to stop" timer feature.
/// Streams nothing to JS — compares the Z-axis sample-to-sample delta
/// against a threshold supplied by the TS layer and emits a discrete
/// "slam" event when it fires. All decision logic (sensitivity mapping,
/// arming window, lifecycle) lives in TypeScript.
///
/// Algorithm ported 1:1 from FiveTimer (com.thesixsides.cincotimer) —
/// a 15-year-proven "Drop to Stop": Z-axis consecutive delta in m/s²,
/// 0.3 noise deadband, threshold compare, refractory window.
@objc(SlamDetectorPlugin)
public class SlamDetectorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SlamDetectorPlugin"
    public let jsName = "SlamDetector"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    // CoreMotion reports acceleration in g; convert to m/s² so thresholds
    // match the Android (SensorManager) units and the FiveTimer reference.
    private static let gravity = 9.81
    private let motionManager = CMMotionManager()
    private let queue = OperationQueue()
    // Threshold + noise-floor deadband (m/s²) for the Z-axis delta; set per start()
    private var threshold: Double = 1.0
    private var deadband: Double = 0.1
    private var refractorySeconds: Double = 0.75
    private var lastFireAt: TimeInterval = 0
    private var lastZ: Double = 0
    private var initialized = false

    @objc func start(_ call: CAPPluginCall) {
        guard motionManager.isAccelerometerAvailable else {
            call.reject("Accelerometer not available")
            return
        }

        threshold = call.getDouble("threshold") ?? 1.0
        deadband = call.getDouble("deadband") ?? 0.1
        refractorySeconds = Double(call.getInt("refractoryMs") ?? 750) / 1000.0
        lastFireAt = 0
        initialized = false

        // Restart cleanly if already running (e.g. threshold update from slider)
        if motionManager.isAccelerometerActive {
            motionManager.stopAccelerometerUpdates()
        }

        motionManager.accelerometerUpdateInterval = 0.02 // ~50Hz, matches Android SENSOR_DELAY_GAME
        motionManager.startAccelerometerUpdates(to: queue) { [weak self] data, error in
            guard let self = self, let data = data, error == nil else { return }

            // Z axis in m/s² (gravity included — cancels out in the delta)
            let z = data.acceleration.z * SlamDetectorPlugin.gravity

            // First sample is the baseline, no delta yet
            if !self.initialized {
                self.lastZ = z
                self.initialized = true
                return
            }

            var delta = abs(self.lastZ - z)
            self.lastZ = z
            if delta < self.deadband {
                delta = 0
            }

            if delta > self.threshold {
                let now = Date().timeIntervalSince1970
                if now - self.lastFireAt >= self.refractorySeconds {
                    self.lastFireAt = now
                    // Epoch ms — CMAccelerometerData.timestamp is boot-relative, unusable for endTimer
                    self.notifyListeners("slam", data: [
                        "timestamp": now * 1000.0,
                        "magnitude": delta,
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
