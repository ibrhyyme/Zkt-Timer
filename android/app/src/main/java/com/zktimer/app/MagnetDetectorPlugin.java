package com.zktimer.app;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONException;

/**
 * Raw magnetometer streamer for magnet lift-to-start ("Kaldırınca Başlat").
 *
 * Deliberately dumb: it only turns sensor events into epoch-millisecond samples and
 * sends them to JS in small time-based batches. Every decision (plateaus, near/far,
 * lift onset) lives in client/util/magnet-start/ so it can be tested against real
 * recordings.
 *
 * Only TYPE_MAGNETIC_FIELD_UNCALIBRATED is used. The calibrated sensor keeps
 * re-estimating hard-iron bias and slowly "learns" a cube that rests next to the phone
 * as part of the device, which inverts near/far after a minute or two (measured on
 * iOS's calibrated stream: 1229 -> 818 uT in 100 s). No calibrated fallback: a device
 * without the uncalibrated sensor reports available=false.
 *
 * Threading: start() runs on Capacitor's plugin thread, which has a Looper. The sensor
 * is registered with a Handler on that thread, so callbacks, batching and
 * notifyListeners all run there. Lifecycle callbacks run on the main thread and only
 * touch the sensor registration plus volatile flags.
 */
@CapacitorPlugin(name = "MagnetDetector")
public class MagnetDetectorPlugin extends Plugin implements SensorEventListener {

    private static final int VERSION = 1;
    private static final int DEFAULT_PERIOD_US = 10000;
    private static final int DEFAULT_BATCH_MS = 50;
    private static final int MAX_BATCH_SAMPLES = 256;

    private static final int CLOCK_UNKNOWN = 0;
    private static final int CLOCK_BOOT = 1;
    private static final int CLOCK_UPTIME = 2;
    private static final int CLOCK_ARRIVAL = 3;
    // A sensor timestamp this close behind "now" on a clock identifies that clock.
    private static final long CLOCK_MATCH_NS = 500_000_000L;

    private SensorManager sensorManager;
    private Sensor sensor;
    private Handler handler;

    // Set by start()/stop() on the plugin thread, read by lifecycle callbacks on the main thread.
    private volatile boolean active = false;
    // Asks the sensor thread to drop its batch and re-detect the clock on the next event.
    private volatile boolean resetPending = true;
    private volatile int periodUs = DEFAULT_PERIOD_US;

    // Sensor-thread state
    private final double[] batch = new double[MAX_BATCH_SAMPLES * 4];
    private int batchCount = 0;
    private double batchOffsetMs = 0;
    private double flushSpanMs = DEFAULT_BATCH_MS - 10;
    private int clockBase = CLOCK_UNKNOWN;

    private void ensureSensor() {
        if (sensorManager != null) return;
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            sensor = sensorManager.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD_UNCALIBRATED);
        }
    }

    @PluginMethod
    public void getCapabilities(PluginCall call) {
        ensureSensor();
        JSObject ret = new JSObject();
        ret.put("version", VERSION);
        ret.put("available", sensor != null);
        ret.put("uncalibrated", sensor != null);
        if (sensor != null) {
            ret.put("minDelayUs", sensor.getMinDelay());
            ret.put("maxRange", sensor.getMaximumRange());
            ret.put("resolution", sensor.getResolution());
            ret.put("name", sensor.getName());
            ret.put("vendor", sensor.getVendor());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void start(PluginCall call) {
        ensureSensor();
        if (sensorManager == null || sensor == null) {
            call.reject("Uncalibrated magnetometer not available", "UNAVAILABLE");
            return;
        }

        int minDelay = sensor.getMinDelay();
        if (minDelay <= 0) minDelay = DEFAULT_PERIOD_US;
        int requested = call.getInt("periodUs", DEFAULT_PERIOD_US);
        periodUs = Math.max(requested, minDelay);
        int batchMs = Math.min(Math.max(call.getInt("batchMs", DEFAULT_BATCH_MS), 20), 500);
        flushSpanMs = Math.max(batchMs - 10, 10);

        // Restart cleanly if already running
        sensorManager.unregisterListener(this);
        resetPending = true;

        Looper looper = Looper.myLooper();
        handler = new Handler(looper != null ? looper : Looper.getMainLooper());
        // maxReportLatencyUs = 0: no hardware batching, every event as it happens.
        boolean ok = sensorManager.registerListener(this, sensor, periodUs, 0, handler);
        if (!ok) {
            active = false;
            call.reject("Could not register the magnetometer listener", "REGISTER_FAILED");
            return;
        }
        active = true;
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        active = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        resetPending = true;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!active) return;

        if (resetPending) {
            resetPending = false;
            batchCount = 0;
            clockBase = CLOCK_UNKNOWN;
        }

        long ts = event.timestamp;
        if (clockBase == CLOCK_UNKNOWN) {
            clockBase = detectClockBase(ts);
        }

        double tMs;
        if (clockBase == CLOCK_ARRIVAL) {
            tMs = System.currentTimeMillis();
        } else {
            // One wall-clock offset per batch: per-sample offsets would add the jitter of
            // reading two clocks to every sample.
            if (batchCount == 0) {
                long nowWall = System.currentTimeMillis();
                long nowBase = clockBase == CLOCK_BOOT
                    ? SystemClock.elapsedRealtimeNanos()
                    : SystemClock.uptimeMillis() * 1_000_000L;
                batchOffsetMs = nowWall - nowBase / 1e6;
            }
            tMs = ts / 1e6 + batchOffsetMs;
        }

        int i = batchCount * 4;
        batch[i] = tMs;
        // values[0..2] = uncalibrated field; values[3..5] would be the estimated bias.
        batch[i + 1] = event.values[0];
        batch[i + 2] = event.values[1];
        batch[i + 3] = event.values[2];
        batchCount++;

        if (tMs - batch[0] >= flushSpanMs || batchCount >= MAX_BATCH_SAMPLES) {
            flush();
        }
    }

    private int detectClockBase(long ts) {
        // Since API 24 (minSdk) sensor timestamps must be on elapsedRealtimeNanos; some
        // older HALs used uptime. Anything else falls back to arrival time.
        long bootLag = SystemClock.elapsedRealtimeNanos() - ts;
        if (bootLag >= 0 && bootLag < CLOCK_MATCH_NS) return CLOCK_BOOT;
        long uptimeLag = SystemClock.uptimeMillis() * 1_000_000L - ts;
        if (uptimeLag >= 0 && uptimeLag < CLOCK_MATCH_NS) return CLOCK_UPTIME;
        return CLOCK_ARRIVAL;
    }

    private void flush() {
        if (batchCount == 0) return;
        JSArray d = new JSArray();
        try {
            for (int i = 0; i < batchCount * 4; i++) {
                d.put(batch[i]);
            }
        } catch (JSONException e) {
            // Only thrown for NaN/Infinity, which a sensor should never produce.
            batchCount = 0;
            return;
        }
        batchCount = 0;

        JSObject payload = new JSObject();
        payload.put("v", VERSION);
        payload.put("clk", clockBase == CLOCK_BOOT ? "boot" : clockBase == CLOCK_UPTIME ? "uptime" : "arrival");
        payload.put("d", d);
        notifyListeners("samples", payload);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Uncalibrated values carry no calibration accuracy worth acting on.
    }

    // The sensor must not run while the app is in the background (battery). The TS layer
    // also stops on visibility change; this covers the gap before JS gets to run.
    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (sensorManager != null && active) {
            sensorManager.unregisterListener(this);
            resetPending = true;
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (sensorManager != null && sensor != null && active && handler != null) {
            resetPending = true;
            sensorManager.registerListener(this, sensor, periodUs, 0, handler);
        }
    }

    // MainActivity.recreate() (after a renderer crash) builds a new plugin instance; the
    // old one must not keep a sensor listener alive.
    @Override
    protected void handleOnDestroy() {
        active = false;
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
        }
        super.handleOnDestroy();
    }
}
