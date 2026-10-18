// Magnet calibration math (Magnet Timer). Pure and import free: the client derives the
// detector thresholds of a cube on this phone model from the raw calibration values, the
// server re-derives them to reject a forged or broken upload, and the admin view shows what
// the current formula makes of every stored row.
//
// Raw values are the source of truth. Thresholds are always derived at run time from the
// raw values with the current formula, so a formula fix ships over the air and nobody has
// to measure again; the stored near_min_ut / far_max_ut only record what algo_version
// produced at the time. Changing the formula means bumping CALIBRATION_ALGO_VERSION.
//
// Every value is a vector distance |B - F| from the far baseline F, in microtesla.
// See .feedback/designs/magnet-cubes.md section 6 and .claude/skills/magnet-start/SKILL.md.

export type CalibrationPlatform = 'ios' | 'android';

export const CALIBRATION_PLATFORMS: readonly CalibrationPlatform[] = ['ios', 'android'];

/** Version of deriveThresholds below. */
export const CALIBRATION_ALGO_VERSION = 1;

/** Today's detector BASE (client/util/magnet-start/config.ts): the upper bounds of a calibrated cube. */
export const NEAR_CAP_UT = 150;
export const FAR_CAP_UT = 80;

/** Weakest usable "ready" line per platform (about 30x the iOS and 11x the Android noise ceiling). */
export const NEAR_FLOOR_UT: Readonly<Record<CalibrationPlatform, number>> = { ios: 30, android: 45 };

/** Mirror of PLATFORM_MIN_UT in client/util/magnet-start/config.ts; a test keeps them equal. */
export const CALIBRATION_PLATFORM_MIN_UT: Readonly<Record<CalibrationPlatform, number>> = { ios: 3, android: 10 };

/** Expected rest noise (rms) per platform; three times this earns a warning. */
export const EXPECTED_NOISE_UT: Readonly<Record<CalibrationPlatform, number>> = { ios: 1, android: 4 };

/**
 * nearMin = REST_FACTOR x R. The field falls with 1/r^3, so 0.35 keeps the cube "ready" up to
 * about 1.4x the distance it rested at during calibration: room for a placement a few mm off
 * and for the magnets that move with every scramble.
 */
export const REST_FACTOR = 0.35;

/** farMax = FAR_RATIO x nearMin: the same "closer" dead band proportion as today's 80 / 150. */
export const FAR_RATIO = 0.55;

/** A floor scales with the measured noise so a noisy phone never sits on its own noise. */
const NEAR_FLOOR_NOISE_FACTOR = 12;
const FAR_FLOOR_NOISE_FACTOR = 6;
const FAR_FLOOR_PLATFORM_FACTOR = 2;

/** Below 1.5x the near floor the cube is too weak on this phone: the calibration is not saved. */
const FAIL_REST_FACTOR = 1.5;

/** nearMin under this is "weak": farMax drops under the ~54 uT a phone turned on the table moves. */
export const WEAK_NEAR_MIN_UT = 100;

export type CalibrationQuality = 'ok' | 'weak' | 'fail';

export interface CalibrationRaw {
	/** Robust maximum |B - F| during the sweep. */
	peak: number;
	/** |R - F| of the cube resting where the user rests it; null when not measured. */
	rest: number | null | undefined;
	/** rms of the far plateau (phone still, cube away). */
	noise: number;
}

export interface CalibrationThresholds {
	/** Enter-near threshold (the green line). */
	nearMin: number;
	/** Leave-near / far band (hysteresis). */
	farMax: number;
	quality: CalibrationQuality;
	algoVersion: number;
}

function clamp(value: number, min: number, max: number): number {
	// When a noisy phone pushes the floor over the cap, the floor wins: a ready line inside
	// the noise would trigger on its own.
	return Math.max(min, Math.min(max, value));
}

export function isCalibrationPlatform(value: unknown): value is CalibrationPlatform {
	return value === 'ios' || value === 'android';
}

/** Weakest usable nearMin for this noise level. The calibration flow also uses it ("no sweep" check). */
export function nearFloorFor(noise: number, platform: CalibrationPlatform): number {
	return Math.max(NEAR_FLOOR_UT[platform], NEAR_FLOOR_NOISE_FACTOR * noise);
}

export function farFloorFor(noise: number, platform: CalibrationPlatform): number {
	return Math.max(FAR_FLOOR_PLATFORM_FACTOR * CALIBRATION_PLATFORM_MIN_UT[platform], FAR_FLOOR_NOISE_FACTOR * noise);
}

/**
 * Detector thresholds of one cube on one phone model (algo_version 1).
 *
 * Derived from the rest value, not the peak: touching the camera bump the peak reaches up to
 * six times the rest value, and a threshold taken from it is never crossed where the cube
 * really sits. A typical 3x3 (R >= ~429 uT) gets exactly today's 150 / 80.
 */
export function deriveThresholds(raw: CalibrationRaw, platform: CalibrationPlatform): CalibrationThresholds {
	const rest = raw.rest ?? 0.5 * raw.peak;
	const R = Math.min(rest, raw.peak);
	const nearFloor = nearFloorFor(raw.noise, platform);
	const farFloor = farFloorFor(raw.noise, platform);
	const nearMin = clamp(REST_FACTOR * R, nearFloor, NEAR_CAP_UT);
	const farMax = clamp(FAR_RATIO * nearMin, farFloor, FAR_CAP_UT);
	let quality: CalibrationQuality;
	if (R < FAIL_REST_FACTOR * nearFloor) quality = 'fail';
	else if (nearMin < WEAK_NEAR_MIN_UT) quality = 'weak';
	else quality = 'ok';
	return { nearMin, farMax, quality, algoVersion: CALIBRATION_ALGO_VERSION };
}

/** Thresholds of a stored calibration row, with the current formula. */
export function deriveThresholdsFromRow(row: {
	platform: string;
	peak_ut: number;
	rest_ut?: number | null;
	noise_ut: number;
}): CalibrationThresholds | null {
	if (!isCalibrationPlatform(row.platform)) return null;
	return deriveThresholds({ peak: row.peak_ut, rest: row.rest_ut, noise: row.noise_ut }, row.platform);
}

/** Noise this high suggests a magnet or a charging cable nearby. A warning, not a rejection. */
export function isNoisy(noise: number, platform: CalibrationPlatform): boolean {
	return noise > 3 * EXPECTED_NOISE_UT[platform];
}

/** A peak at the sensor's ceiling is only a lower bound. Flagged in the admin view, harmless otherwise. */
export function isPeakSaturated(peak: number, maxRange: number | null | undefined): boolean {
	return !!maxRange && maxRange > 0 && peak >= 0.95 * maxRange;
}

/**
 * Calibration flow (client) timing and rejection rules. The sample count and duration
 * minimums are also the server's lower bounds, so an aborted flow can never be stored.
 */
export const CALIBRATION_FLOW = {
	/** Same as the detector's minRateHz. */
	minRateHz: 40,
	/** Steady plateau for the baseline (step 1) and the rest value (step 3), ms. */
	plateauHoldMs: 1500,
	/** Step 1 waits this long for a steady phone before saying the phone moves, ms. */
	steadyTimeoutMs: 20_000,
	/** Peak: the largest 5-sample running median, so single-sample spikes do not count. */
	peakMedianWindow: 5,
	/** Step 2 lasts at least this long, ms. */
	sweepMinMs: 6000,
	/** Step 2 offers "Done" once the peak grew under peakSettleGrowth for this long, ms. */
	peakSettleMs: 3000,
	peakSettleGrowth: 0.03,
	/** Step 2 ends on its own after this long, ms. */
	sweepMaxMs: 20_000,
	/** A sweep whose peak stays under this many near floors did not reach the camera. */
	sweepMinPeakFloors: 2,
	/** After step 3 the cube is taken away; the plateau must return within this share of farMax of F. */
	returnFarRatio: 0.5,
	/** A flow shorter than this was aborted and is not saved. */
	minSamples: 300,
	minTotalMs: 4000,
} as const;

/** Server bounds of an uploaded calibration (design 6.5). The client never gets trusted. */
export const CALIBRATION_LIMITS = {
	deviceModelMaxLength: 80,
	peakUt: { min: 1, max: 20_000 },
	restUt: { min: 0, max: 20_000 },
	/** rest_ut may exceed peak_ut by this factor at most (the flow takes P = R when R > P). */
	restOverPeak: 1.05,
	noiseUt: { min: 0, max: 50 },
	rateHz: { min: CALIBRATION_FLOW.minRateHz, max: 1000 },
	sampleCount: { min: CALIBRATION_FLOW.minSamples, max: 20_000 },
	sweepMs: { min: CALIBRATION_FLOW.minTotalMs, max: 120_000 },
	/** Any stored threshold; the formula's exact value is checked separately. */
	thresholdUt: { min: 0, max: 20_000 },
	/** The stored thresholds may differ from the server's re-derivation by this much, uT. */
	thresholdToleranceUt: 1,
	/** measured_at may lie this far in the future (clock skew), ms. */
	futureSkewMs: 5 * 60_000,
	/** Saves per user per day (abuse and save loops). Counted by the server against the database. */
	dailySavesPerUser: 50,
} as const;

export interface CalibrationMeasurementInput {
	platform: string;
	device_model: string;
	peak_ut: number;
	rest_ut?: number | null;
	noise_ut: number;
	near_min_ut: number;
	far_max_ut: number;
	quality: string;
	sample_count: number;
	sweep_ms: number;
	rate_hz: number;
	algo_version: number;
	measured_at: Date | string | number;
}

export type CalibrationRejectReason =
	| 'platform'
	| 'device_model'
	| 'peak'
	| 'rest'
	| 'noise'
	| 'rate'
	| 'samples'
	| 'sweep'
	| 'algo_version'
	| 'quality'
	| 'thresholds'
	| 'too_weak'
	| 'measured_at';

export type CalibrationCheckResult =
	| {
		ok: true;
		platform: CalibrationPlatform;
		/** Trimmed device model. */
		deviceModel: string;
		measuredAt: Date;
		/** Re-derived with the current formula; null for an older algo_version. */
		thresholds: CalibrationThresholds | null;
		/** Present on both branches so callers without strictNullChecks can read it directly. */
		reason?: undefined;
	}
	| { ok: false; reason: CalibrationRejectReason };

function inRange(value: unknown, range: { min: number; max: number }): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= range.min && value <= range.max;
}

function isIntInRange(value: unknown, range: { min: number; max: number }): value is number {
	return inRange(value, range) && Number.isInteger(value);
}

/**
 * Validates an uploaded calibration without touching the database. Cube ownership, the
 * archived check, the daily limit and the "newer measured_at wins" rule are the resolver's.
 *
 * For the current algo_version the stored thresholds and quality must match the server's own
 * derivation (within thresholdToleranceUt) and the result must not be "fail". Rows of an
 * older algo_version are range checked only: their formula no longer exists here, and the
 * client re-derives from the raw values anyway.
 */
export function checkCalibrationMeasurement(
	input: CalibrationMeasurementInput,
	now: number = Date.now()
): CalibrationCheckResult {
	const L = CALIBRATION_LIMITS;
	if (!isCalibrationPlatform(input.platform)) return { ok: false, reason: 'platform' };
	const platform = input.platform;

	const deviceModel = typeof input.device_model === 'string' ? input.device_model.trim() : '';
	if (deviceModel.length < 1 || deviceModel.length > L.deviceModelMaxLength) {
		return { ok: false, reason: 'device_model' };
	}

	if (!inRange(input.peak_ut, L.peakUt)) return { ok: false, reason: 'peak' };
	const rest = input.rest_ut ?? null;
	if (rest !== null && (!inRange(rest, L.restUt) || rest > input.peak_ut * L.restOverPeak)) {
		return { ok: false, reason: 'rest' };
	}
	if (!inRange(input.noise_ut, L.noiseUt)) return { ok: false, reason: 'noise' };
	if (!inRange(input.rate_hz, L.rateHz)) return { ok: false, reason: 'rate' };
	if (!isIntInRange(input.sample_count, L.sampleCount)) return { ok: false, reason: 'samples' };
	if (!isIntInRange(input.sweep_ms, L.sweepMs)) return { ok: false, reason: 'sweep' };
	if (!isIntInRange(input.algo_version, { min: 1, max: CALIBRATION_ALGO_VERSION })) {
		return { ok: false, reason: 'algo_version' };
	}
	if (input.quality !== 'ok' && input.quality !== 'weak') return { ok: false, reason: 'quality' };
	if (!inRange(input.near_min_ut, L.thresholdUt) || !inRange(input.far_max_ut, L.thresholdUt)) {
		return { ok: false, reason: 'thresholds' };
	}

	const measuredAt = input.measured_at instanceof Date ? input.measured_at : new Date(input.measured_at);
	const measuredMs = measuredAt.getTime();
	if (!Number.isFinite(measuredMs) || measuredMs > now + L.futureSkewMs) {
		return { ok: false, reason: 'measured_at' };
	}

	let thresholds: CalibrationThresholds | null = null;
	if (input.algo_version === CALIBRATION_ALGO_VERSION) {
		thresholds = deriveThresholds({ peak: input.peak_ut, rest, noise: input.noise_ut }, platform);
		if (thresholds.quality === 'fail') return { ok: false, reason: 'too_weak' };
		if (thresholds.quality !== input.quality) return { ok: false, reason: 'quality' };
		if (
			Math.abs(thresholds.nearMin - input.near_min_ut) > L.thresholdToleranceUt ||
			Math.abs(thresholds.farMax - input.far_max_ut) > L.thresholdToleranceUt
		) {
			return { ok: false, reason: 'thresholds' };
		}
	}

	return { ok: true, platform, deviceModel, measuredAt, thresholds };
}
