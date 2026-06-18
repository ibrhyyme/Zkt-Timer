package com.zktimer.app;

import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Thin native peak-detector for the "slam to stop" timer feature.
 * Streams nothing to JS — compares the Z-axis sample-to-sample delta
 * against a threshold supplied by the TS layer and emits a discrete
 * "slam" event when it fires. All decision logic (sensitivity mapping,
 * arming window, lifecycle) lives in TypeScript.
 *
 * Algorithm ported 1:1 from FiveTimer (com.thesixsides.cincotimer) —
 * a 15-year-proven "Drop to Stop": Z-axis consecutive delta in m/s²,
 * 0.3 noise deadband, threshold compare, refractory window.
 */
@CapacitorPlugin(name = "SlamDetector")
public class SlamDetectorPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor accelerometer;
    private boolean active = false;
    // Threshold + noise-floor deadband (m/s²) for the Z-axis delta; set per start()
    private double threshold = 1.0;
    private double deadband = 0.1;
    private long refractoryMs = 750;
    private long lastFireAt = 0;
    private float lastZ = 0f;
    private boolean initialized = false;

    @PluginMethod()
    public void start(PluginCall call) {
        if (sensorManager == null) {
            sensorManager = (SensorManager) getContext().getSystemService(android.content.Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
            }
        }

        if (sensorManager == null || accelerometer == null) {
            call.reject("Accelerometer not available");
            return;
        }

        threshold = call.getDouble("threshold", 1.0);
        deadband = call.getDouble("deadband", 0.1);
        refractoryMs = call.getInt("refractoryMs", 750);
        lastFireAt = 0;
        initialized = false;

        // Restart cleanly if already running (e.g. threshold update from slider)
        if (active) {
            sensorManager.unregisterListener(this);
        }

        // SENSOR_DELAY_GAME (~50Hz) — matches iOS 0.02s and the FiveTimer reference.
        // Delta metric is rate-dependent, so the rate must match for thresholds to hold.
        sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
        active = true;
        call.resolve();
    }

    @PluginMethod()
    public void stop(PluginCall call) {
        if (sensorManager != null && active) {
            sensorManager.unregisterListener(this);
        }
        active = false;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!active) return;

        // Z axis in m/s² (gravity included — cancels out in the delta)
        float z = event.values[2];

        // First sample is the baseline, no delta yet
        if (!initialized) {
            lastZ = z;
            initialized = true;
            return;
        }

        double delta = Math.abs(lastZ - z);
        lastZ = z;
        if (delta < deadband) {
            delta = 0;
        }

        if (delta > threshold) {
            // Epoch ms — SensorEvent.timestamp is boot-relative nanos, unusable for endTimer
            long now = System.currentTimeMillis();
            if (now - lastFireAt >= refractoryMs) {
                lastFireAt = now;
                JSObject data = new JSObject();
                data.put("timestamp", now);
                data.put("magnitude", delta);
                notifyListeners("slam", data);
            }
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not relevant for spike detection
    }

    // Sensor stream must not run while the app is backgrounded (battery).
    // The TS layer keeps `active` intent; we re-attach on resume.
    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        if (sensorManager != null && active) {
            sensorManager.unregisterListener(this);
        }
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (sensorManager != null && accelerometer != null && active) {
            sensorManager.registerListener(this, accelerometer, SensorManager.SENSOR_DELAY_GAME);
        }
    }
}
