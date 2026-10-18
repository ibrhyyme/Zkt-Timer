// Calibration measurement (design .feedback/designs/magnet-cubes.md 5.7, 6.1, 6.5): turns the
// raw magnetometer stream of the three step flow into the raw values the thresholds are
// derived from. Pure like the detector: no DOM, no timers, no store. The calibration page
// (client/components/magnet/calibrate/) feeds it the samples of magnetService.subscribeSamples
// while it holds the stream with acquire('calibrate'), and drives the steps with start() and
// finish(). All times are sample times (epoch ms), so a recording replays the same in Jest.
//
// Steps:
//   steady  phone on the table, cube away: a 1.5 s steady plateau gives the baseline F and the
//           noise sigma. "Start" is enabled while the phone is steady and the sensor is fast
//           enough.
//   sweep   the cube is moved around the rear camera: the peak P is the largest 5-sample
//           running median of |B - F| (single-sample spikes do not count).
//   rest    the cube is put where it rests before a solve: a 1.5 s steady plateau gives R.
//   away    the cube is taken away again: the field must come back to F, otherwise the phone
//           moved during the measurement and nothing is saved.
//   done    result() holds the measurement; failed: failure says why.
import {
	CALIBRATION_ALGO_VERSION,
	CALIBRATION_FLOW,
	CALIBRATION_LIMITS,
	CALIBRATION_PLATFORM_MIN_UT,
	deriveThresholds,
	farFloorFor,
	isNoisy,
	isPeakSaturated,
	nearFloorFor,
} from '../../../shared/magnet_calibration';
import type { PendingCalibration } from '../../lib/cubes/active_cube';
import { detectorConfigFor } from './config';
import { distSV, distVV } from './detector';
import type { MagnetPlatform, MagnetSample, Vec3 } from './types';

export type CalibrationStep = 'steady' | 'sweep' | 'rest' | 'away' | 'done' | 'failed';

/**
 * rate:        the sensor delivers under 40 Hz; the flow ends
 * too_weak:    the cube is too weak on this phone where it rests (quality 'fail')
 * phone_moved: with the cube away the field did not come back to the baseline
 * short:       too few samples or too short (an interrupted flow)
 * timeout:     the cube was never put down (rest) or never taken away (away)
 */
export type CalibrationFailReason = 'rate' | 'too_weak' | 'phone_moved' | 'short' | 'timeout';

/**
 * moving:   step 1 found no steady plateau for steadyTimeoutMs (the phone is not lying still)
 * no_sweep: finish was refused, the peak never reached the camera (stays in the sweep)
 * not_back: the cube seems away but the field settled off the baseline (away step, waiting)
 * noisy:    step 1 found no steady plateau because the reading is noisy, not because it moves
 *           (the mean stays put): a magnet or a charging cable nearby. The phone cannot run the
 *           detector like this either, so the flow waits in step 1 with this message.
 */
export type CalibrationIssue = 'moving' | 'no_sweep' | 'not_back' | 'noisy' | null;

export interface CalibrationProgress {
	step: CalibrationStep;
	/** The latest 1.5 s window is a steady plateau (step 1 "phone steady" light). */
	steady: boolean;
	/** Step 1: the plateau sits on the app's known baseline. null without a known baseline. */
	cubeAway: boolean | null;
	/** Step 1: start() would be accepted. */
	canStart: boolean;
	/** |B - F| of the latest sample, uT. null before the baseline is measured. */
	live: number | null;
	/** Largest running median so far (sweep), uT. */
	peak: number | null;
	/** Rest value R once measured, uT. */
	rest: number | null;
	/** Time spent in the sweep, ms. */
	sweepMs: number;
	/** Sweep: finish() is allowed (minimum duration reached). */
	canFinish: boolean;
	/** Sweep: the peak stopped growing; the "Done" button may flash. */
	settled: boolean;
	/** Rest step: how long the cube has been lying still, ms (the "steady 1.5 s" light). */
	holdMs: number;
	issue: CalibrationIssue;
	/** Noise over three times the platform's usual: a warning (magnet or cable nearby), not a stop. */
	noisy: boolean;
	rateHz: number | null;
	failure: CalibrationFailReason | null;
}

/** The finished measurement. Field names follow the CubeCalibration row. */
export interface CalibrationMeasurement {
	platform: MagnetPlatform;
	peak_ut: number;
	rest_ut: number;
	noise_ut: number;
	near_min_ut: number;
	far_max_ut: number;
	quality: 'ok' | 'weak';
	sample_count: number;
	sweep_ms: number;
	rate_hz: number;
	algo_version: number;
	/** Epoch ms of the last sample. */
	measured_at: number;
	noisy: boolean;
	/** The peak touched the sensor's ceiling: only a lower bound (admin flag, harmless). */
	saturated: boolean;
	/** The baseline F measured in step 1 (the page may hand it to the detector). */
	far: Vec3;
}

export interface CalibrationMeterOptions {
	/** The detector's current baseline, for the step 1 "cube away" light. */
	knownFar?: Vec3 | null;
	/** MagnetCapabilities.maxRange (Android), for the saturation flag. */
	maxRange?: number | null;
}

/** Away step: the plateau that decides "back at the baseline", ms. */
const AWAY_HOLD_MS = 1000;
/** Away step: a steady reading off the baseline for this long means the phone moved, ms. */
const AWAY_NOT_BACK_MS = 5000;
/** Rest and away steps end with `timeout` after this long, ms. */
const STEP_TIMEOUT_MS = 60_000;
/** The short window behind the rest step's "lying still" light, ms (the detector's plateau). */
const HOLD_WINDOW_MS = 300;
/** Samples of the rate probe, as in the detector. */
const RATE_PROBE_SAMPLES = 50;
/** Sample history kept for the windows, ms. */
const HISTORY_MS = 2000;
/** Step 1: a window at least this rough (von Neumann ratio) is sensor noise, not motion. */
const NOISE_ROUGHNESS = 0.5;
/** Raw values are stored with this many decimals; thresholds are derived from the rounded values. */
const ROUND = 100;

interface WindowStats {
	mean: Vec3;
	rms: number;
	stable: boolean;
}

function round(value: number): number {
	return Math.round(value * ROUND) / ROUND;
}

function median(values: number[]): number {
	const sorted = values.slice().sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export class CalibrationMeter {
	private readonly platform: MagnetPlatform;
	private readonly platformMin: number;
	private readonly knownFar: Vec3 | null;
	private readonly knownFarMax: number;
	private readonly maxRange: number | null;

	private step: CalibrationStep = 'steady';
	private failure: CalibrationFailReason | null = null;
	private issue: CalibrationIssue = null;

	private buf: MagnetSample[] = [];
	private lastT: number | null = null;
	private stepStartT: number | null = null;

	private rateCount = 0;
	private rateFirstT: number | null = null;
	private rateHz: number | null = null;

	private steady = false;
	private steadyAt: number | null = null;
	private candidateFar: { mean: Vec3; rms: number; fromT: number } | null = null;

	private far: Vec3 | null = null;
	private noise = 0;
	/** First sample of the baseline window: the measurement starts there. */
	private measureFromT = 0;
	private measureCount = 0;

	private recent: number[] = [];
	private peak = 0;
	private peakMark = 0;
	private peakMarkT = 0;
	private sweepStartT = 0;

	private holdSince: number | null = null;
	private rest: number | null = null;
	private restAt = 0;
	private notBackSince: number | null = null;
	private measurement: CalibrationMeasurement | null = null;

	constructor(platform: MagnetPlatform, options: CalibrationMeterOptions = {}) {
		this.platform = platform;
		this.platformMin = CALIBRATION_PLATFORM_MIN_UT[platform];
		this.knownFar = options.knownFar ? [options.knownFar[0], options.knownFar[1], options.knownFar[2]] : null;
		this.knownFarMax = detectorConfigFor(platform).farMax;
		this.maxRange = options.maxRange ?? null;
	}

	push(samples: MagnetSample[]): CalibrationProgress {
		if (this.step === 'done' || this.step === 'failed') return this.progress();
		let added = false;
		for (const s of samples) {
			if (this.lastT !== null && !(s.t > this.lastT)) continue;
			if (this.lastT !== null && s.t - this.lastT > 1000) {
				// A stall breaks every window; the steady checks start over.
				this.buf = [];
				this.holdSince = null;
			}
			this.lastT = s.t;
			if (this.stepStartT === null) this.stepStartT = s.t;
			this.buf.push(s);
			// The measurement runs from the baseline window (counted in start()) to the rest
			// value; the away step only checks it.
			if (this.step === 'sweep' || this.step === 'rest') this.measureCount++;
			added = true;
			if (!this.probeRate(s)) return this.progress();
			if (this.far && this.step === 'sweep') this.trackPeak(s);
		}
		if (!added || this.lastT === null) return this.progress();
		const now = this.lastT;
		let i = 0;
		while (i < this.buf.length && this.buf[i].t < now - HISTORY_MS) i++;
		if (i) this.buf = this.buf.slice(i);

		switch (this.step) {
			case 'steady':
				this.onSteadyStep(now);
				break;
			case 'sweep':
				this.onSweepStep(now);
				break;
			case 'rest':
				this.onRestStep(now);
				break;
			case 'away':
				this.onAwayStep(now);
				break;
		}
		return this.progress();
	}

	/** Step 1 to 2 ("Start"). False while the phone is not steady or the rate is unknown. */
	start(): boolean {
		if (this.step !== 'steady' || !this.canStart() || !this.candidateFar || this.lastT === null) return false;
		this.far = this.candidateFar.mean;
		this.noise = this.candidateFar.rms;
		this.measureFromT = this.candidateFar.fromT;
		this.measureCount = this.buf.filter((s) => s.t >= this.measureFromT).length;
		this.sweepStartT = this.lastT;
		this.peak = 0;
		this.peakMark = 0;
		this.peakMarkT = this.lastT;
		this.recent = [];
		this.issue = null;
		this.enter('sweep');
		return true;
	}

	/**
	 * Step 2 to 3 ("Done"). Refused before the minimum sweep time, and when the peak never
	 * reached the camera (issue 'no_sweep', the sweep goes on).
	 */
	finish(): boolean {
		if (this.step !== 'sweep' || this.lastT === null) return false;
		if (this.lastT - this.sweepStartT < CALIBRATION_FLOW.sweepMinMs) return false;
		const nearFloor = nearFloorFor(this.noise, this.platform);
		if (this.peak < CALIBRATION_FLOW.sweepMinPeakFloors * nearFloor) {
			this.issue = 'no_sweep';
			return false;
		}
		this.issue = null;
		this.enter('rest');
		return true;
	}

	/** The measurement, once the flow is done. */
	result(): CalibrationMeasurement | null {
		return this.measurement;
	}

	getFar(): Vec3 | null {
		return this.far ? [this.far[0], this.far[1], this.far[2]] : null;
	}

	progress(): CalibrationProgress {
		const last = this.buf.length ? this.buf[this.buf.length - 1] : null;
		const sweepMs =
			this.step === 'sweep' && this.lastT !== null
				? this.lastT - this.sweepStartT
				: this.step === 'steady'
					? 0
					: Math.max(0, this.restAt - this.sweepStartT);
		return {
			step: this.step,
			steady: this.steady,
			cubeAway:
				this.step === 'steady' && this.knownFar && this.candidateFar
					? distVV(this.candidateFar.mean, this.knownFar) < this.knownFarMax
					: null,
			canStart: this.canStart(),
			live: this.far && last ? distSV(last, this.far) : null,
			peak: this.far ? this.peak : null,
			rest: this.rest,
			sweepMs,
			canFinish: this.step === 'sweep' && sweepMs >= CALIBRATION_FLOW.sweepMinMs,
			settled:
				this.step === 'sweep' &&
				this.peak > 0 &&
				this.lastT !== null &&
				this.lastT - this.peakMarkT >= CALIBRATION_FLOW.peakSettleMs,
			holdMs: this.holdSince !== null && this.lastT !== null ? this.lastT - this.holdSince : 0,
			issue: this.issue,
			noisy: this.isNoisyNow(),
			rateHz: this.rateHz,
			failure: this.failure,
		};
	}

	private canStart(): boolean {
		return (
			this.step === 'steady' &&
			this.steady &&
			this.candidateFar !== null &&
			this.rateHz !== null &&
			this.rateHz >= CALIBRATION_FLOW.minRateHz
		);
	}

	private isNoisyNow(): boolean {
		const sigma = this.far ? this.noise : this.candidateFar?.rms;
		return sigma !== undefined && sigma !== null && isNoisy(sigma, this.platform);
	}

	private enter(step: CalibrationStep): void {
		this.step = step;
		this.stepStartT = this.lastT;
		this.holdSince = null;
		this.notBackSince = null;
	}

	private fail(reason: CalibrationFailReason): void {
		this.failure = reason;
		this.step = 'failed';
	}

	/** Returns false once the sensor is found too slow (the flow fails). */
	private probeRate(s: MagnetSample): boolean {
		if (this.rateHz !== null) return true;
		if (this.rateFirstT === null) this.rateFirstT = s.t;
		this.rateCount++;
		if (this.rateCount < RATE_PROBE_SAMPLES) return true;
		const span = s.t - this.rateFirstT;
		this.rateHz = span > 0 ? ((this.rateCount - 1) * 1000) / span : 0;
		if (this.rateHz < CALIBRATION_FLOW.minRateHz) {
			this.fail('rate');
			return false;
		}
		return true;
	}

	private onSteadyStep(now: number): void {
		const st = this.stats(now, CALIBRATION_FLOW.plateauHoldMs);
		this.steady = !!st && st.stable;
		if (st && st.stable) {
			this.steadyAt = now;
			this.candidateFar = { mean: st.mean, rms: st.rms, fromT: now - CALIBRATION_FLOW.plateauHoldMs };
			this.issue = null;
			return;
		}
		this.candidateFar = null;
		if (st && isNoisy(st.rms, this.platform) && this.roughness(now, CALIBRATION_FLOW.plateauHoldMs, st.mean) >= NOISE_ROUGHNESS) {
			this.issue = 'noisy';
			return;
		}
		const since = this.steadyAt ?? (this.stepStartT as number);
		this.issue = now - since >= CALIBRATION_FLOW.steadyTimeoutMs ? 'moving' : null;
	}

	/**
	 * Von Neumann ratio of the window: mean squared step between consecutive samples over twice
	 * the variance. White sensor noise gives ~1; a phone turning in the hand is smooth at 100 Hz
	 * and gives close to 0, whatever the shape or period of the motion.
	 */
	private roughness(now: number, spanMs: number, mean: Vec3): number {
		let prev: MagnetSample | null = null;
		let steps = 0;
		let stepSq = 0;
		let n = 0;
		let varSq = 0;
		for (const s of this.buf) {
			if (s.t <= now - spanMs) continue;
			const d = distSV(s, mean);
			varSq += d * d;
			n++;
			if (prev) {
				const dx = s.x - prev.x;
				const dy = s.y - prev.y;
				const dz = s.z - prev.z;
				stepSq += dx * dx + dy * dy + dz * dz;
				steps++;
			}
			prev = s;
		}
		if (!steps || !varSq) return 0;
		return stepSq / steps / (2 * (varSq / n));
	}

	private trackPeak(s: MagnetSample): void {
		this.recent.push(distSV(s, this.far as Vec3));
		if (this.recent.length > CALIBRATION_FLOW.peakMedianWindow) this.recent.shift();
		if (this.recent.length < CALIBRATION_FLOW.peakMedianWindow) return;
		const m = median(this.recent);
		if (m <= this.peak) return;
		this.peak = m;
		if (this.peak > this.peakMark * (1 + CALIBRATION_FLOW.peakSettleGrowth)) {
			this.peakMark = this.peak;
			this.peakMarkT = s.t;
		}
	}

	private onSweepStep(now: number): void {
		const st = this.stats(now, CALIBRATION_FLOW.plateauHoldMs);
		this.steady = !!st && st.stable;
		if (now - this.sweepStartT >= CALIBRATION_FLOW.sweepMaxMs) this.finish();
	}

	private onRestStep(now: number): void {
		const far = this.far as Vec3;
		// "Placed": clearly off the baseline. A cube resting too weakly still counts as placed
		// and ends as too_weak below, rather than leaving the user waiting with no answer.
		const placedMin = 2 * farFloorFor(this.noise, this.platform);

		const short = this.stats(now, HOLD_WINDOW_MS);
		if (short && short.stable && distVV(short.mean, far) >= placedMin) {
			if (this.holdSince === null) this.holdSince = now - HOLD_WINDOW_MS;
		} else {
			this.holdSince = null;
		}

		const st = this.stats(now, CALIBRATION_FLOW.plateauHoldMs);
		this.steady = !!st && st.stable;
		if (st && st.stable) {
			const r = distVV(st.mean, far);
			if (r >= placedMin) {
				this.captureRest(r, now);
				return;
			}
		}
		if (now - (this.stepStartT as number) >= STEP_TIMEOUT_MS) this.fail('timeout');
	}

	private captureRest(r: number, now: number): void {
		this.rest = r;
		this.restAt = now;
		// Never placed at the best spot during the sweep: the rest value is the peak (6.1).
		if (r > this.peak) this.peak = r;
		const t = this.thresholds();
		if (t.quality === 'fail') {
			this.fail('too_weak');
			return;
		}
		this.enter('away');
	}

	private onAwayStep(now: number): void {
		const far = this.far as Vec3;
		const st = this.stats(now, AWAY_HOLD_MS);
		this.steady = !!st && st.stable;
		if (st && st.stable) {
			const d = distVV(st.mean, far);
			const { farMax } = this.thresholds();
			if (d <= CALIBRATION_FLOW.returnFarRatio * farMax) {
				this.complete(now);
				return;
			}
			if (d < 0.5 * (this.rest as number)) {
				// The cube is away (the field fell to under half the rest value) but the reading
				// settled off the baseline: the phone moved, or the cube lies just a little away.
				if (this.notBackSince === null) this.notBackSince = now;
				this.issue = 'not_back';
				if (now - this.notBackSince >= AWAY_NOT_BACK_MS) this.fail('phone_moved');
				return;
			}
		}
		this.notBackSince = null;
		this.issue = null;
		if (now - (this.stepStartT as number) >= STEP_TIMEOUT_MS) this.fail('timeout');
	}

	private thresholds() {
		return deriveThresholds({ peak: round(this.peak), rest: round(this.rest as number), noise: round(this.noise) }, this.platform);
	}

	private complete(now: number): void {
		// Counted over the measurement span so the rate is the one the values came from.
		const span = this.restAt - this.measureFromT;
		const count = this.measureCount;
		const rate = span > 0 ? ((count - 1) * 1000) / span : 0;
		if (count < CALIBRATION_FLOW.minSamples || span < CALIBRATION_FLOW.minTotalMs) {
			this.fail('short');
			return;
		}
		if (rate < CALIBRATION_FLOW.minRateHz) {
			this.fail('rate');
			return;
		}
		const t = this.thresholds();
		if (t.quality === 'fail') {
			this.fail('too_weak');
			return;
		}
		this.measurement = {
			platform: this.platform,
			peak_ut: round(this.peak),
			rest_ut: round(this.rest as number),
			noise_ut: round(this.noise),
			near_min_ut: t.nearMin,
			far_max_ut: t.farMax,
			quality: t.quality,
			sample_count: Math.min(count, CALIBRATION_LIMITS.sampleCount.max),
			sweep_ms: Math.round(Math.min(span, CALIBRATION_LIMITS.sweepMs.max)),
			rate_hz: round(Math.min(rate, CALIBRATION_LIMITS.rateHz.max)),
			algo_version: CALIBRATION_ALGO_VERSION,
			measured_at: now,
			noisy: isNoisy(this.noise, this.platform),
			saturated: isPeakSaturated(this.peak, this.maxRange),
			far: this.far as Vec3,
		};
		this.issue = null;
		this.step = 'done';
	}

	/**
	 * Statistics of the window (now - spanMs, now]. Null when the window is not covered well
	 * enough to judge (same coverage rule as the detector).
	 */
	private stats(now: number, spanMs: number): WindowStats | null {
		const lower = now - spanMs;
		let lo = this.buf.length;
		while (lo - 1 >= 0 && this.buf[lo - 1].t > lower) lo--;
		const n = this.buf.length - lo;
		if (!n) return null;
		const covered = this.buf[this.buf.length - 1].t - this.buf[lo].t;
		const minN = Math.max(5, Math.floor(((spanMs * CALIBRATION_FLOW.minRateHz) / 1000) * 0.8));
		if (n < minN || covered < spanMs * 0.8) return null;

		let mx = 0;
		let my = 0;
		let mz = 0;
		for (let i = lo; i < this.buf.length; i++) {
			mx += this.buf[i].x;
			my += this.buf[i].y;
			mz += this.buf[i].z;
		}
		const mean: Vec3 = [mx / n, my / n, mz / n];
		let maxDev = 0;
		let sq = 0;
		for (let i = lo; i < this.buf.length; i++) {
			const d = distSV(this.buf[i], mean);
			if (d > maxDev) maxDev = d;
			sq += d * d;
		}
		return { mean, rms: Math.sqrt(sq / n), stable: maxDev <= this.platformMin };
	}
}

export interface CalibrationRowContext {
	cubeId: string;
	deviceModel: string;
	osVersion?: string | null;
	appVersion?: string | null;
	sensorName?: string | null;
}

/** The pending calibration row for saveCubeCalibrationLocal (client/lib/cubes/sync.ts). */
export function buildCalibrationRow(m: CalibrationMeasurement, ctx: CalibrationRowContext): PendingCalibration {
	return {
		cube_id: ctx.cubeId,
		platform: m.platform,
		device_model: ctx.deviceModel,
		os_version: ctx.osVersion ?? null,
		app_version: ctx.appVersion ?? null,
		sensor_name: ctx.sensorName ?? null,
		peak_ut: m.peak_ut,
		rest_ut: m.rest_ut,
		noise_ut: m.noise_ut,
		near_min_ut: m.near_min_ut,
		far_max_ut: m.far_max_ut,
		quality: m.quality,
		sample_count: m.sample_count,
		sweep_ms: m.sweep_ms,
		rate_hz: m.rate_hz,
		algo_version: m.algo_version,
		measured_at: m.measured_at,
	};
}
