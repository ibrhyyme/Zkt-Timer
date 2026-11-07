import { normalizeWcaEventBucket } from '../../../shared/solve';

/**
 * Warm-up auto-save rules, pure so they can be tested without a database.
 *
 * 'pb' saves a warm-up solve that would be a new single PB. 'threshold' saves one at or under
 * the time the user set for the solve's bucket, and a PB as well: a record must never be lost
 * because the threshold was set too low. Thresholds are kept per bucket (cube type + subset),
 * since one number cannot fit 2x2 and 4x4 at once. A bucket with no threshold saves PBs only.
 */

export type WarmupAutoSaveMode = 'off' | 'pb' | 'threshold';
export type WarmupAutoSaveReason = 'pb' | 'threshold';

/** Seconds per bucket key, see warmupBucketKey. */
export type WarmupThresholds = Record<string, number>;

/** Same bucket the solve is saved under: '333' with no subset and 'wca::333' are one bucket. */
export function warmupBucketKey(cubeType: string | null | undefined, scrambleSubset: string | null | undefined): string {
	const bucket = normalizeWcaEventBucket(cubeType, scrambleSubset);
	return `${bucket.cube_type ?? ''}::${bucket.scramble_subset ?? ''}`;
}

export function getWarmupThreshold(
	thresholds: WarmupThresholds | null | undefined,
	cubeType: string | null | undefined,
	scrambleSubset: string | null | undefined
): number | null {
	const value = thresholds?.[warmupBucketKey(cubeType, scrambleSubset)];
	return typeof value === 'number' && value > 0 ? value : null;
}

/** A new map with this bucket's threshold set, or removed for null. Never mutates the stored one. */
export function withWarmupThreshold(
	thresholds: WarmupThresholds | null | undefined,
	cubeType: string | null | undefined,
	scrambleSubset: string | null | undefined,
	seconds: number | null
): WarmupThresholds {
	const next: WarmupThresholds = { ...(thresholds || {}) };
	const key = warmupBucketKey(cubeType, scrambleSubset);
	if (seconds && seconds > 0) {
		next[key] = seconds;
	} else {
		delete next[key];
	}
	return next;
}

/**
 * At or under the threshold, compared in hundredths: 12.99 entered and 12.99 stopped are equal
 * even when the float sums behind them (a +2) differ in the last bit.
 */
export function meetsWarmupThreshold(time: number, threshold: number): boolean {
	return Math.round(time * 100) <= Math.round(threshold * 100);
}

interface ReasonSolve {
	time: number;
	dnf?: boolean;
	cube_type?: string | null;
	scramble_subset?: string | null;
}

/** Why this solve should be auto-saved, or null. PB is checked first so the chip can say "PB". */
export function warmupAutoSaveReason(
	solve: ReasonSolve,
	mode: WarmupAutoSaveMode | null | undefined,
	thresholds: WarmupThresholds | null | undefined,
	beatsPb: () => boolean
): WarmupAutoSaveReason | null {
	if (mode !== 'pb' && mode !== 'threshold') return null;
	if (solve.dnf || !(solve.time > 0)) return null;

	if (beatsPb()) return 'pb';
	if (mode !== 'threshold') return null;

	const threshold = getWarmupThreshold(thresholds, solve.cube_type, solve.scramble_subset);
	return threshold !== null && meetsWarmupThreshold(solve.time, threshold) ? 'threshold' : null;
}
