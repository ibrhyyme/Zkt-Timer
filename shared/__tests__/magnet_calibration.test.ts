import {PLATFORM_MIN_UT, detectorConfigFor} from '../../client/util/magnet-start/config';
import {
	CALIBRATION_ALGO_VERSION,
	CALIBRATION_FLOW,
	CALIBRATION_LIMITS,
	CALIBRATION_PLATFORM_MIN_UT,
	CalibrationMeasurementInput,
	FAR_CAP_UT,
	NEAR_CAP_UT,
	NEAR_FLOOR_UT,
	checkCalibrationMeasurement,
	deriveThresholds,
	deriveThresholdsFromRow,
	isNoisy,
	isPeakSaturated,
	nearFloorFor,
} from '../magnet_calibration';

describe('constants stay in step with the detector config', () => {
	it('caps are today\'s BASE thresholds', () => {
		for (const platform of ['ios', 'android'] as const) {
			const config = detectorConfigFor(platform);
			expect(NEAR_CAP_UT).toBe(config.nearMin);
			expect(FAR_CAP_UT).toBe(config.farMax);
			expect(CALIBRATION_FLOW.minRateHz).toBe(config.minRateHz);
		}
	});

	it('platform minimum mirrors PLATFORM_MIN_UT', () => {
		expect(CALIBRATION_PLATFORM_MIN_UT).toEqual(PLATFORM_MIN_UT);
	});

	it('server lower bounds are the flow minimums', () => {
		expect(CALIBRATION_LIMITS.sampleCount.min).toBe(CALIBRATION_FLOW.minSamples);
		expect(CALIBRATION_LIMITS.sweepMs.min).toBe(CALIBRATION_FLOW.minTotalMs);
		expect(CALIBRATION_LIMITS.rateHz.min).toBe(CALIBRATION_FLOW.minRateHz);
	});
});

describe('deriveThresholds', () => {
	// Design 6.2 examples. Noise: iOS 1 uT, Android 3 uT (both under the floors' noise term).
	const IOS_NOISE = 1;
	const ANDROID_NOISE = 3;

	it('gives a typical 3x3 exactly today\'s thresholds on both platforms', () => {
		for (const [platform, noise] of [['ios', IOS_NOISE], ['android', ANDROID_NOISE]] as const) {
			const t = deriveThresholds({peak: 2000, rest: 500, noise}, platform);
			expect(t).toEqual({nearMin: 150, farMax: 80, quality: 'ok', algoVersion: CALIBRATION_ALGO_VERSION});
		}
	});

	it('keeps the caps from about 429 uT up', () => {
		expect(deriveThresholds({peak: 3000, rest: 429, noise: IOS_NOISE}, 'ios').nearMin).toBe(150);
		expect(deriveThresholds({peak: 3000, rest: 3000, noise: IOS_NOISE}, 'ios')).toMatchObject({nearMin: 150, farMax: 80});
		expect(deriveThresholds({peak: 3000, rest: 420, noise: IOS_NOISE}, 'ios').nearMin).toBeLessThan(150);
	});

	it('scales a weak 3x3', () => {
		const t = deriveThresholds({peak: 900, rest: 300, noise: IOS_NOISE}, 'ios');
		expect(t.nearMin).toBeCloseTo(105, 6);
		expect(t.farMax).toBeCloseTo(57.75, 6);
		expect(t.quality).toBe('ok');
	});

	it('marks a 2x2 at 200 uT weak', () => {
		for (const [platform, noise] of [['ios', IOS_NOISE], ['android', ANDROID_NOISE]] as const) {
			const t = deriveThresholds({peak: 400, rest: 200, noise}, platform);
			expect(t.nearMin).toBeCloseTo(70, 6);
			expect(t.farMax).toBeCloseTo(38.5, 6);
			expect(t.quality).toBe('weak');
		}
	});

	it('holds the platform floors for a low magnet Pyraminx', () => {
		const ios = deriveThresholds({peak: 200, rest: 100, noise: IOS_NOISE}, 'ios');
		expect(ios.nearMin).toBeCloseTo(35, 6);
		expect(ios.farMax).toBeCloseTo(19.25, 6);
		expect(ios.quality).toBe('weak');

		const android = deriveThresholds({peak: 200, rest: 100, noise: ANDROID_NOISE}, 'android');
		expect(android.nearMin).toBe(45);
		expect(android.farMax).toBeCloseTo(24.75, 6);
		expect(android.quality).toBe('weak');
	});

	it('fails a cube without magnets', () => {
		expect(deriveThresholds({peak: 30, rest: 15, noise: IOS_NOISE}, 'ios').quality).toBe('fail');
		expect(deriveThresholds({peak: 30, rest: 15, noise: ANDROID_NOISE}, 'android').quality).toBe('fail');
	});

	it('puts the fail line at 1.5 near floors and the weak line at nearMin 100', () => {
		// iOS near floor 30 -> fail under R = 45.
		expect(deriveThresholds({peak: 100, rest: 44.9, noise: IOS_NOISE}, 'ios').quality).toBe('fail');
		expect(deriveThresholds({peak: 100, rest: 45, noise: IOS_NOISE}, 'ios').quality).toBe('weak');
		// nearMin 100 <-> R = 285.71...
		expect(deriveThresholds({peak: 1000, rest: 285, noise: IOS_NOISE}, 'ios').quality).toBe('weak');
		expect(deriveThresholds({peak: 1000, rest: 286, noise: IOS_NOISE}, 'ios').quality).toBe('ok');
	});

	it('raises both floors with the measured noise', () => {
		// Android noise 6 uT: near floor 72, far floor 36.
		expect(nearFloorFor(6, 'android')).toBe(72);
		const t = deriveThresholds({peak: 400, rest: 150, noise: 6}, 'android');
		expect(t.nearMin).toBe(72);
		expect(t.farMax).toBeCloseTo(39.6, 6);
		const quiet = deriveThresholds({peak: 400, rest: 60, noise: 0.5}, 'android');
		expect(quiet.farMax).toBeCloseTo(24.75, 6); // 0.55 * 45, over the far floor of 2 * platformMin = 20
	});

	it('derives the rest value from half the peak when it was not measured', () => {
		expect(deriveThresholds({peak: 600, rest: null, noise: IOS_NOISE}, 'ios').nearMin).toBeCloseTo(105, 6);
		expect(deriveThresholds({peak: 600, rest: undefined, noise: IOS_NOISE}, 'ios').nearMin).toBeCloseTo(105, 6);
	});

	it('never takes a rest value above the peak', () => {
		expect(deriveThresholds({peak: 200, rest: 400, noise: IOS_NOISE}, 'ios').nearMin).toBeCloseTo(70, 6);
	});

	it('keeps nearMin and farMax inside their floors and caps', () => {
		for (const platform of ['ios', 'android'] as const) {
			for (let rest = 0; rest <= 5000; rest += 37) {
				const t = deriveThresholds({peak: 5000, rest, noise: 1}, platform);
				expect(t.nearMin).toBeGreaterThanOrEqual(NEAR_FLOOR_UT[platform]);
				expect(t.nearMin).toBeLessThanOrEqual(NEAR_CAP_UT);
				expect(t.farMax).toBeLessThanOrEqual(FAR_CAP_UT);
				expect(t.farMax).toBeLessThan(t.nearMin);
			}
		}
	});

	it('derives from a stored row', () => {
		expect(deriveThresholdsFromRow({platform: 'ios', peak_ut: 2000, rest_ut: 500, noise_ut: 1})).toMatchObject({
			nearMin: 150,
			farMax: 80,
		});
		expect(deriveThresholdsFromRow({platform: 'web', peak_ut: 2000, rest_ut: 500, noise_ut: 1})).toBeNull();
	});
});

describe('helpers', () => {
	it('flags noise over three times the platform expectation', () => {
		expect(isNoisy(3, 'ios')).toBe(false);
		expect(isNoisy(3.1, 'ios')).toBe(true);
		expect(isNoisy(12, 'android')).toBe(false);
		expect(isNoisy(12.1, 'android')).toBe(true);
	});

	it('flags a peak at 95 % of the sensor range', () => {
		expect(isPeakSaturated(4750, 5000)).toBe(true);
		expect(isPeakSaturated(4700, 5000)).toBe(false);
		expect(isPeakSaturated(4750, null)).toBe(false);
		expect(isPeakSaturated(4750, 0)).toBe(false);
	});
});

describe('checkCalibrationMeasurement', () => {
	const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);

	function valid(overrides: Partial<CalibrationMeasurementInput> = {}): CalibrationMeasurementInput {
		const t = deriveThresholds({peak: 2000, rest: 300, noise: 1}, 'ios');
		return {
			platform: 'ios',
			device_model: '  Apple iPhone16,1  ',
			peak_ut: 2000,
			rest_ut: 300,
			noise_ut: 1,
			near_min_ut: t.nearMin,
			far_max_ut: t.farMax,
			quality: t.quality,
			sample_count: 1200,
			sweep_ms: 12000,
			rate_hz: 100,
			algo_version: CALIBRATION_ALGO_VERSION,
			measured_at: new Date(NOW - 1000),
			...overrides,
		};
	}

	function reason(overrides: Partial<CalibrationMeasurementInput>) {
		const r = checkCalibrationMeasurement(valid(overrides), NOW);
		return r.ok ? 'ok' : r.reason;
	}

	it('accepts a clean measurement and trims the model', () => {
		const r = checkCalibrationMeasurement(valid(), NOW);
		expect(r.ok).toBe(true);
		if (!r.ok) return;
		expect(r.deviceModel).toBe('Apple iPhone16,1');
		expect(r.platform).toBe('ios');
		expect(r.thresholds?.nearMin).toBeCloseTo(105, 6);
	});

	it('accepts thresholds within 1 uT and an ISO or epoch measured_at', () => {
		const t = deriveThresholds({peak: 2000, rest: 300, noise: 1}, 'ios');
		expect(reason({near_min_ut: t.nearMin + 0.9, far_max_ut: t.farMax - 0.9})).toBe('ok');
		expect(reason({measured_at: new Date(NOW).toISOString()})).toBe('ok');
		expect(reason({measured_at: NOW + 4 * 60_000})).toBe('ok');
	});

	it('accepts a missing rest value', () => {
		const t = deriveThresholds({peak: 2000, rest: null, noise: 1}, 'ios');
		expect(reason({rest_ut: null, near_min_ut: t.nearMin, far_max_ut: t.farMax, quality: t.quality})).toBe('ok');
	});

	it('rejects values out of range', () => {
		expect(reason({platform: 'web'})).toBe('platform');
		expect(reason({device_model: '   '})).toBe('device_model');
		expect(reason({device_model: 'x'.repeat(81)})).toBe('device_model');
		expect(reason({peak_ut: 0.5})).toBe('peak');
		expect(reason({peak_ut: 20001})).toBe('peak');
		expect(reason({peak_ut: NaN})).toBe('peak');
		expect(reason({rest_ut: -1})).toBe('rest');
		expect(reason({rest_ut: 2101})).toBe('rest'); // over peak x 1.05
		expect(reason({noise_ut: 51})).toBe('noise');
		expect(reason({rate_hz: 39})).toBe('rate');
		expect(reason({rate_hz: 1001})).toBe('rate');
		expect(reason({sample_count: 299})).toBe('samples');
		expect(reason({sample_count: 300.5})).toBe('samples');
		expect(reason({sweep_ms: 3999})).toBe('sweep');
		expect(reason({sweep_ms: 120001})).toBe('sweep');
		expect(reason({algo_version: 0})).toBe('algo_version');
		expect(reason({algo_version: CALIBRATION_ALGO_VERSION + 1})).toBe('algo_version');
		expect(reason({quality: 'fail'})).toBe('quality');
		expect(reason({measured_at: NOW + 6 * 60_000})).toBe('measured_at');
		expect(reason({measured_at: 'not a date'})).toBe('measured_at');
	});

	it('rejects thresholds the formula does not produce', () => {
		expect(reason({near_min_ut: 150})).toBe('thresholds');
		expect(reason({far_max_ut: 80})).toBe('thresholds');
		expect(reason({near_min_ut: -1})).toBe('thresholds');
	});

	it('rejects a quality the formula does not produce', () => {
		expect(reason({quality: 'weak'})).toBe('quality');
	});

	it('rejects a cube too weak for this phone', () => {
		expect(reason({peak_ut: 30, rest_ut: 15, near_min_ut: 30, far_max_ut: 16.5, quality: 'weak'})).toBe('too_weak');
	});
});
