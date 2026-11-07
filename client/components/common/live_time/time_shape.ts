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

/** One character of a rolling time. `from` is null when it did not change, '' when it is new. */
export interface RollCell {
	char: string;
	from: string | null;
}

export interface TimeRoll {
	whole: RollCell[];
	point: string;
	fraction: RollCell[];
}

// Lined up from the right, where the digits mean the same thing: going from 9.50 to 12.30 the
// 2 replaces the 9 and the 1 is new.
function rollCells(from: string, to: string): RollCell[] {
	const offset = from.length - to.length;
	return Array.from(to, (char, i) => {
		const previous = from[i + offset] ?? '';
		return {char, from: previous === char ? null : previous};
	});
}

/**
 * What LiveTime draws when one resting time gives way to another. Null when either side is
 * not a time: a word has no digits to roll, so it simply changes.
 */
export function rollTime(from: string, to: string): TimeRoll | null {
	const before = splitTime(from);
	const after = splitTime(to);
	if (!before.point || !after.point) return null;
	return {
		whole: rollCells(before.whole, after.whole),
		point: after.point,
		fraction: rollCells(before.fraction, after.fraction),
	};
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
