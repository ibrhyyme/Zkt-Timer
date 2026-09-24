import type { MagnetPlatform } from './types';

// Every threshold lives in TypeScript so it ships over the air; only the sampling
// rate and the wire format are fixed in the native plugins.
//
// Starting values come from five phyphox recordings (iPhone 15 Pro, Samsung Z Fold 6),
// 2026-09-23:
// - rest noise (vector deviation from the plateau mean): iPhone max ~0.6-1.0 uT,
//   Fold max ~4.2 uT, i.e. Android is roughly 6x noisier
// - cube at the rear-camera hot spot: ~500 uT from the far baseline on both phones;
//   at 5 cm the field is practically gone (1/r^3)
// - a flat phone rotated on the table moves the far vector by up to ~54 uT (earth field),
//   the Fold's far baseline shifted a permanent 35 uT when nudged
// - lifts cross 5 uT 10-20 ms after the motion starts, 10-90 % of the swing takes ~80 ms
export interface DetectorConfig {
	/** Trigger floor and plateau stability band, uT. */
	platformMin: number;
	/** A plateau at least this far from the far baseline is "near", uT. */
	nearMin: number;
	/** A plateau closer than this to the far baseline is "far", uT. */
	farMax: number;
	/** Window a plateau must stay inside the stability band for, ms. */
	plateauMs: number;
	/** The near reference ignores the newest samples so a starting lift cannot drag it, ms. */
	excludeRecentMs: number;
	/** Onset band = max(bandFloor, bandSigma * sigma), uT. */
	bandFloor: number;
	bandSigma: number;
	/** Lift trigger = max(platformMin, triggerSigma * sigma), uT. */
	triggerSigma: number;
	/** Required progress toward the far baseline: 1 - |B-F| / |R-F|. */
	confirmProgress: number;
	/** Consecutive samples that must satisfy the confirmation. */
	confirmHoldSamples: number;
	/** A deviation back inside the band for this long was a spike, ms. */
	spikeReturnMs: number;
	/** A lift that neither confirms nor settles within this long is dropped, ms. */
	liftTimeoutMs: number;
	/** Far plateaus within max(freeTrackMin, freeTrackSigma * sigma) replace F at once, uT. */
	freeTrackMin: number;
	freeTrackSigma: number;
	/**
	 * Larger far shifts (up to farMax) are adopted only after persisting this long, ms.
	 * Either way F never moves further than farMax from its anchor (last re-learn or load),
	 * so a cube hovering closer in small steps cannot walk the baseline up to the hot spot.
	 */
	adoptMs: number;
	/** A gap longer than this restarts plateau detection, ms. */
	gapResetMs: number;
	/** A gap longer than this makes the state unknown, ms. */
	gapUnknownMs: number;
	/** Below this delivery rate the device is unsupported, Hz. */
	minRateHz: number;
	/** Samples used to measure the delivery rate after a (re)start. */
	rateProbeSamples: number;
	/** Sample history kept for plateaus and onset backtracking, ms. */
	historyMs: number;
	/** How far back an onset may be searched from the trigger, ms. */
	maxOnsetLookbackMs: number;
	/** How long the reading must be steady for "re-learn baseline", ms. */
	relearnMs: number;
}

const BASE: Omit<DetectorConfig, 'platformMin'> = {
	nearMin: 150,
	farMax: 80,
	plateauMs: 300,
	excludeRecentMs: 50,
	bandFloor: 2,
	bandSigma: 3,
	triggerSigma: 6,
	confirmProgress: 0.6,
	confirmHoldSamples: 2,
	spikeReturnMs: 30,
	liftTimeoutMs: 2000,
	freeTrackMin: 8,
	freeTrackSigma: 10,
	adoptMs: 5000,
	gapResetMs: 100,
	gapUnknownMs: 1000,
	minRateHz: 40,
	rateProbeSamples: 50,
	historyMs: 3000,
	maxOnsetLookbackMs: 300,
	relearnMs: 1000,
};

export const PLATFORM_MIN_UT: Record<MagnetPlatform, number> = {
	ios: 3,
	android: 10,
};

export function detectorConfigFor(platform: MagnetPlatform, overrides?: Partial<DetectorConfig>): DetectorConfig {
	return { ...BASE, platformMin: PLATFORM_MIN_UT[platform], ...overrides };
}

// Controller timing
/** Minimum time the cube must rest before READY; freeze_time extends it. */
export const MIN_DWELL_MS = 300;
/** After any stop or reset the cube must be away this long before an idle lift may act. */
export const ARM_FAR_MS = 3000;
/** Same age limit the touch path applies to a backdated start (events.ts startTimer). */
export const MAX_ONSET_AGE_MS = 2000;
/** Lift triggers are ignored this long after our own READY vibration. */
export const HAPTIC_MUTE_MS = 120;

// Native stream
export const STREAM_PERIOD_US = 10000;
export const STREAM_BATCH_MS = 50;
export const PROBE_TIMEOUT_MS = 1500;
