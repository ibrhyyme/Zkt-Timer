import Capacitor
import CoreMotion
import UIKit

/// The app's single CMMotionManager. Apple asks for one instance per app (more can
/// lower the delivery rate); SlamDetectorPlugin uses it as well. Declared here so no
/// extra file has to be added to the Xcode project.
let zktSharedMotionManager = CMMotionManager()

/// Raw magnetometer streamer for magnet lift-to-start ("Kaldırınca Başlat").
///
/// Deliberately dumb: it only turns CoreMotion samples into epoch-millisecond samples
/// and sends them to JS in small time-based batches. Every decision (plateaus, near/far,
/// lift onset) lives in client/util/magnet-start/ so it can be tested against real
/// recordings.
///
/// CMMagnetometer is the RAW field (device bias included). The calibrated field from
/// CMDeviceMotion keeps re-estimating the bias and slowly "learns" a cube resting next
/// to the phone as part of the device: measured 1229 -> 818 uT in 100 s, which inverts
/// near/far. Raw drifted 0.67 uT over 145 s.
@objc(MagnetDetectorPlugin)
public class MagnetDetectorPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MagnetDetectorPlugin"
    public let jsName = "MagnetDetector"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getCapabilities", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private static let version = 1

    private let motionManager = zktSharedMotionManager
    // Serial: the batcher is not thread-safe, and OperationQueue runs concurrently by default.
    private let sampleQueue: OperationQueue = {
        let q = OperationQueue()
        q.maxConcurrentOperationCount = 1
        q.name = "zkt.magnet.samples"
        return q
    }()
    // All start/stop/lifecycle state changes go through this queue.
    private let control = DispatchQueue(label: "zkt.magnet.control")

    private var batcher: MagnetBatcher?
    private var wanted = false
    private var periodUs = 10000
    private var batchMs = 50
    private var lifecycleObservers: [NSObjectProtocol] = []

    override public func load() {
        let center = NotificationCenter.default
        lifecycleObservers.append(center.addObserver(
            forName: UIApplication.willResignActiveNotification, object: nil, queue: nil
        ) { [weak self] _ in
            guard let self = self else { return }
            self.control.async { if self.wanted { self.stopUpdates() } }
        })
        lifecycleObservers.append(center.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: nil
        ) { [weak self] _ in
            guard let self = self else { return }
            self.control.async { if self.wanted { self.startUpdates() } }
        })
    }

    deinit {
        lifecycleObservers.forEach { NotificationCenter.default.removeObserver($0) }
    }

    @objc func getCapabilities(_ call: CAPPluginCall) {
        let available = motionManager.isMagnetometerAvailable
        call.resolve([
            "version": MagnetDetectorPlugin.version,
            "available": available,
            "uncalibrated": available,
            "name": "CMMagnetometer",
            "vendor": "Apple",
        ])
    }

    @objc func start(_ call: CAPPluginCall) {
        guard motionManager.isMagnetometerAvailable else {
            call.reject("Magnetometer not available", "UNAVAILABLE")
            return
        }
        let period = max(call.getInt("periodUs") ?? 10000, 5000)
        let batch = min(max(call.getInt("batchMs") ?? 50, 20), 500)
        control.async {
            self.periodUs = period
            self.batchMs = batch
            self.wanted = true
            self.startUpdates()
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        control.async {
            self.wanted = false
            self.stopUpdates()
            call.resolve()
        }
    }

    // Runs on `control`.
    private func startUpdates() {
        stopUpdates()
        let batcher = MagnetBatcher(
            spanMs: Double(max(batchMs - 10, 10)),
            startUptime: ProcessInfo.processInfo.systemUptime
        ) { [weak self] payload in
            self?.emit(payload)
        }
        self.batcher = batcher
        motionManager.magnetometerUpdateInterval = Double(periodUs) / 1_000_000.0
        motionManager.startMagnetometerUpdates(to: sampleQueue) { data, error in
            guard let data = data, error == nil else { return }
            batcher.add(data)
        }
    }

    // Runs on `control`.
    private func stopUpdates() {
        batcher?.cancel()
        batcher = nil
        if motionManager.isMagnetometerActive {
            motionManager.stopMagnetometerUpdates()
        }
    }

    private func emit(_ payload: [String: Any]) {
        // Listener bookkeeping (addListener/removeListener) runs on the bridge's serial
        // queue and notifyListeners reads it without a lock, so notify from that queue.
        if let bridge = self.bridge as? CapacitorBridge {
            bridge.dispatchQueue.async { [weak self] in
                self?.notifyListeners("samples", data: payload)
            }
        } else {
            notifyListeners("samples", data: payload)
        }
    }
}

/// Collects samples on the (serial) sample queue and flushes them by time. One instance
/// per start(); stop() cancels it so a late CoreMotion callback cannot leak into the
/// next stream.
private final class MagnetBatcher {
    private let spanMs: Double
    private let startUptime: TimeInterval
    private let sink: ([String: Any]) -> Void
    private let lock = NSLock()
    private var cancelled = false

    private var buf: [Double] = []
    private var firstT: Double = 0
    private var offsetSeconds: Double = 0
    private var clock: String?

    init(spanMs: Double, startUptime: TimeInterval, sink: @escaping ([String: Any]) -> Void) {
        self.spanMs = spanMs
        self.startUptime = startUptime
        self.sink = sink
    }

    func cancel() {
        lock.lock()
        cancelled = true
        lock.unlock()
    }

    private var isCancelled: Bool {
        lock.lock()
        defer { lock.unlock() }
        return cancelled
    }

    func add(_ data: CMMagnetometerData) {
        if isCancelled { return }

        // CoreMotion may hand back a cached sample from before this start.
        let ts = data.timestamp
        if ts < startUptime - 0.001 { return }

        let nowUptime = ProcessInfo.processInfo.systemUptime
        if clock == nil {
            // CMLogItem timestamps count from boot on the same clock as systemUptime; if a
            // device ever disagrees, fall back to arrival time rather than guess.
            let lag = nowUptime - ts
            clock = (lag >= 0 && lag < 0.5) ? "uptime" : "arrival"
        }

        let tMs: Double
        if clock == "uptime" {
            // One wall-clock offset per batch, not per sample.
            if buf.isEmpty {
                offsetSeconds = Date().timeIntervalSince1970 - nowUptime
            }
            tMs = (ts + offsetSeconds) * 1000.0
        } else {
            tMs = Date().timeIntervalSince1970 * 1000.0
        }

        let field = data.magneticField
        if buf.isEmpty { firstT = tMs }
        buf.append(tMs)
        buf.append(field.x)
        buf.append(field.y)
        buf.append(field.z)

        if tMs - firstT >= spanMs || buf.count >= 1024 {
            flush()
        }
    }

    private func flush() {
        guard !buf.isEmpty, !isCancelled else {
            buf.removeAll(keepingCapacity: true)
            return
        }
        let payload: [String: Any] = ["v": 1, "clk": clock ?? "arrival", "d": buf]
        buf.removeAll(keepingCapacity: true)
        sink(payload)
    }
}
