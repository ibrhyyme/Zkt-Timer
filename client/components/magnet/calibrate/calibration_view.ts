// What the calibration page shows for a state of the measurement (design
// .feedback/designs/magnet-cubes.md 5.7, 6.5). Pure: no React, no i18n instance, no DOM. The
// page passes the CalibrationMeter's progress in and gets translation keys and bar geometry
// back, so every message rule is tested without a phone.
import type {
	CalibrationFailReason,
	CalibrationMeasurement,
	CalibrationProgress,
	CalibrationStep,
} from '../../../util/magnet-start/calibration';

export const CAL_NS = 'magnet_calibration';

/** The three numbered steps of the page; the away step belongs to step 3 ("put it back"). */
export function stepNumber(step: CalibrationStep): 1 | 2 | 3 | null {
	switch (step) {
		case 'steady':
			return 1;
		case 'sweep':
			return 2;
		case 'rest':
		case 'away':
			return 3;
		default:
			return null;
	}
}

/** Title key of a step. */
export function stepTitleKey(step: CalibrationStep): string {
	switch (step) {
		case 'steady':
			return `${CAL_NS}.step_steady_title`;
		case 'sweep':
			return `${CAL_NS}.step_sweep_title`;
		case 'rest':
			return `${CAL_NS}.step_rest_title`;
		case 'away':
			return `${CAL_NS}.step_away_title`;
		case 'done':
			return `${CAL_NS}.result_title`;
		default:
			return `${CAL_NS}.failed_title`;
	}
}

/** Instruction key of a step. */
export function stepBodyKey(step: CalibrationStep): string | null {
	switch (step) {
		case 'steady':
			return `${CAL_NS}.step_steady_body`;
		case 'sweep':
			return `${CAL_NS}.step_sweep_body`;
		case 'rest':
			return `${CAL_NS}.step_rest_body`;
		case 'away':
			return `${CAL_NS}.step_away_body`;
		default:
			return null;
	}
}

/**
 * The one sentence under the step, or null. The step's own problem (the issue) comes first; a
 * phone still waiting for its first samples says so; in step 1 a known baseline that the
 * reading is off tells the person to take the cube away.
 */
export function hintKey(p: Pick<CalibrationProgress, 'step' | 'issue' | 'rateHz' | 'cubeAway' | 'steady'>): string | null {
	switch (p.issue) {
		case 'noisy':
			return `${CAL_NS}.issue_noisy`;
		case 'moving':
			return `${CAL_NS}.issue_moving`;
		case 'no_sweep':
			return `${CAL_NS}.issue_no_sweep`;
		case 'not_back':
			return `${CAL_NS}.issue_not_back`;
	}
	if (p.step === 'steady') {
		if (p.rateHz === null) return `${CAL_NS}.waiting_sensor`;
		if (p.steady && p.cubeAway === false) return `${CAL_NS}.issue_cube_near`;
	}
	return null;
}

/** Message key of a failed measurement. */
export function failureKey(reason: CalibrationFailReason | null): string {
	switch (reason) {
		case 'rate':
			return `${CAL_NS}.fail_rate`;
		case 'too_weak':
			return `${CAL_NS}.fail_too_weak`;
		case 'phone_moved':
			return `${CAL_NS}.fail_phone_moved`;
		case 'timeout':
			return `${CAL_NS}.fail_timeout`;
		default:
			return `${CAL_NS}.fail_short`;
	}
}

/** A slow sensor stays slow: trying again would only fail the same way. */
export function canRetry(reason: CalibrationFailReason | null): boolean {
	return reason !== 'rate';
}

/**
 * Scale of the live bar during the measurement, uT: a little above the highest value seen so
 * far, so the bar never sits pinned at the end, and never under `minScale` so the noise of a
 * cube far away does not fill it.
 */
export function measureBarScale(peak: number | null, live: number | null, minScale = 100): number {
	const top = Math.max(peak ?? 0, live ?? 0);
	return Math.max(minScale, top * 1.1);
}

/** Share of the bar, 0..1. */
export function barFill(value: number | null, scale: number): number {
	if (value === null || !(scale > 0) || !Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value / scale));
}

/**
 * The result bar (5.7 result and 5.8): scaled so the resting cube fills about 80 %, the line at
 * the ready threshold. Same scale rule as the timer's live bar (liveBarScaleUt).
 */
export function resultBar(m: Pick<CalibrationMeasurement, 'rest_ut' | 'near_min_ut'>): { fill: number; line: number } {
	const scale = Math.max(1.25 * m.rest_ut, 2 * m.near_min_ut);
	return { fill: barFill(m.rest_ut, scale), line: barFill(m.near_min_ut, scale) };
}

/** The sweep's progress ring: time spent toward the automatic end. */
export function sweepRing(sweepMs: number, sweepMaxMs: number): number {
	if (!(sweepMaxMs > 0)) return 0;
	return Math.min(1, Math.max(0, sweepMs / sweepMaxMs));
}

/** The calibration page of a cube: /magnet/calibrate?cube=<id> (cube profile, timer guide). */
export function calibrateLink(cubeId: string): string {
	return `/magnet/calibrate?${new URLSearchParams({ cube: cubeId }).toString()}`;
}

/** Reads calibrateLink's cube back; null when missing. */
export function parseCalibrateLink(search: string | null | undefined): { cubeId: string | null } {
	const id = new URLSearchParams(search || '').get('cube');
	return { cubeId: id && id.trim() ? id.trim() : null };
}
