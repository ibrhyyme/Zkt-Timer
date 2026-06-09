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
 * Streams nothing to JS — compares accelerometer magnitude deviation
 * against a threshold supplied by the TS layer and emits a discrete
 * "slam" event when it fires. All decision logic (sensitivity mapping,
 * arming window, lifecycle) lives in TypeScript.
 */
@CapacitorPlugin(name = "SlamDetector")
public class SlamDetectorPlugin extends Plugin implements SensorEventListener {

    // 100Hz, matches iOS accelerometerUpdateInterval = 0.01
    private static final int SENSOR_PERIOD_US = 10000;
    private static final double GRAVITY = 9.81;

    private SensorManager sensorManager;
    private Sensor accelerometer;
    private boolean active = false;
    // Threshold in g for |magnitude - 1g| deviation; set per start() call
    private double threshold = 1.0;
    private long refractoryMs = 150;
    private long lastFireAt = 0;

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
        refractoryMs = call.getInt("refractoryMs", 150);
        lastFireAt = 0;

        // Restart cleanly if already running (e.g. threshold update from slider)
        if (active) {
            sensorManager.unregisterListener(this);
        }

        sensorManager.registerListener(this, accelerometer, SENSOR_PERIOD_US);
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

        // Android reports m/s² — normalize to g so thresholds match iOS
        double x = event.values[0] / GRAVITY;
        double y = event.values[1] / GRAVITY;
        double z = event.values[2] / GRAVITY;
        double magnitude = Math.sqrt(x * x + y * y + z * z);
        // Deviation from 1g — orientation- and sample-rate-independent
        double deviation = Math.abs(magnitude - 1.0);

        if (deviation > threshold) {
            // Epoch ms — SensorEvent.timestamp is boot-relative nanos, unusable for endTimer
            long now = System.currentTimeMillis();
            if (now - lastFireAt >= refractoryMs) {
                lastFireAt = now;
                JSObject data = new JSObject();
                data.put("timestamp", now);
                data.put("magnitude", deviation);
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
            sensorManager.registerListener(this, accelerometer, SENSOR_PERIOD_US);
        }
    }
}
