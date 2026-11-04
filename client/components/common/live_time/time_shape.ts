/**
 * How much the running digits grow. Mirrors $timer-running-scale in tokens.scss, which
 * draws the growth; this copy is only for code that has to size the digits so the grown
 * time still fits (the timer page on a phone). Change both together.
 */
export const TIMER_RUNNING_SCALE = 1.3;

// The digit shape LiveTime.scss draws (csTimer's look, owner 2026-11-04): each glyph of
// Roboto Mono advances 0.6 em less the 0.05 em letter-spacing, the point's cell loses
// 0.14 em on both sides, and the decimals are drawn at 0.75. Change both files together.
const GLYPH_EM = 0.6 - 0.05;
const POINT_EM = 0.6 - 0.05 - 2 * 0.14;
const FRACTION_SCALE = 0.75;

export interface TimeParts {
	/** Seconds, with minutes in front when there are any ("1:02"). Any other text whole. */
	whole: string;
	point: string;
	fraction: string;
}

/**
 * Splits a time into the part drawn full size and the decimals drawn smaller. Only a
 * time is split; a word or a mark ("DNF", "+2", a countdown, a translated "Solve") stays
 * whole, so a translation that happens to contain a full stop is never cut in two.
 */
export function splitTime(text: string): TimeParts {
	const match = /^(.*\d)\.(\d+)$/.exec(text);
	if (!match) return {whole: text, point: '', fraction: ''};
	return {whole: match[1], point: '.', fraction: match[2]};
}

/**
 * Width of a time in em of the full-size digits, as LiveTime draws it. Room is kept for
 * two whole digits, so a time does not get narrower and jump in size below ten seconds.
 */
export function timeWidthEm(text: string): number {
	const {whole, point, fraction} = splitTime(text);
	if (!point) return 0.6 * Math.max(whole.length, 4);
	return GLYPH_EM * Math.max(whole.length, 2) + POINT_EM + GLYPH_EM * FRACTION_SCALE * fraction.length;
}
