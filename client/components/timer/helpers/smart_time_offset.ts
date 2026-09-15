import { getSetting } from '../../../db/settings/query';

/**
 * "İlave süre": a fixed amount added to every smart cube solve, for users who do not
 * trust the cube's own stop (it ends the solve on the last turn, a timer ends it when
 * the hands come down). It is not a penalty and leaves no trace on the solve: the
 * recorded time simply includes it, so +2 and DNF work on top of it exactly as they do
 * on any other time.
 *
 * Every place that turns a smart cube measurement into a time goes through
 * applySmartCubeTimeOffset: the early display freeze, endTimer (and with it the save,
 * the time list, stats and the solve card) and the friendly room review screen. If one
 * of them skipped it, the digits the user sees at the stop would disagree with the time
 * that gets recorded.
 */

export const SMART_CUBE_TIME_OFFSET_MIN = 0;
export const SMART_CUBE_TIME_OFFSET_MAX = 5;
export const SMART_CUBE_TIME_OFFSET_STEP = 0.01;
export const SMART_CUBE_TIME_OFFSET_DECIMALS = 2;

/**
 * Brings a stored or typed value into range, in hundredths of a second. Anything that
 * is not a usable number reads as 0, i.e. no offset. A comma is accepted as the decimal
 * separator, since that is what a Turkish keyboard types.
 */
export function normalizeSmartCubeTimeOffset(value: unknown): number {
	let n: number;
	if (typeof value === 'string') {
		n = parseFloat(value.trim().replace(',', '.'));
	} else if (typeof value === 'number') {
		n = value;
	} else {
		return SMART_CUBE_TIME_OFFSET_MIN;
	}

	if (!Number.isFinite(n) || n <= SMART_CUBE_TIME_OFFSET_MIN) {
		return SMART_CUBE_TIME_OFFSET_MIN;
	}

	return Math.round(Math.min(n, SMART_CUBE_TIME_OFFSET_MAX) * 100) / 100;
}

/** The offset in whole milliseconds. */
export function smartCubeTimeOffsetMs(offsetSeconds: unknown): number {
	return Math.round(normalizeSmartCubeTimeOffset(offsetSeconds) * 1000);
}

/**
 * A measured smart cube time with the offset added, both in milliseconds.
 *
 * A time of zero or less is returned as it is: that is the aborted-solve DNF, whose raw
 * time of 0 is what keeps it from being toggled back into a normal solve.
 */
export function applySmartCubeTimeOffset(timeMs: number, offsetSeconds: unknown): number {
	if (typeof timeMs !== 'number' || !Number.isFinite(timeMs) || timeMs <= 0) {
		return timeMs;
	}
	return timeMs + smartCubeTimeOffsetMs(offsetSeconds);
}

/** The current setting, normalized, in seconds. */
export function getSmartCubeTimeOffset(): number {
	return normalizeSmartCubeTimeOffset(getSetting('smart_cube_time_offset'));
}
