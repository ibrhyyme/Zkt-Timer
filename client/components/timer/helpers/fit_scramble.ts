// Desktop scramble size against the height of the timer area.
//
// The timer area between the picker bar and the daily goal bar (or a bottom module bar)
// centres its content and clips what does not fit. With a large scramble font, a narrow
// centre column (wide rails) and a bottom bar on a 1280x800 screen, the scramble wrapped to
// four lines and the content outgrew the area: the Previous / Next row at the top was cut
// off behind the picker bar, and the bottom of the digits with it. The scramble is the one
// part that can give, so it shrinks from the user's size until the area fits.
//
// The size itself comes from util/text-fit.ts (canvas measurement, nothing rendered at a
// trial size). Measuring the live element instead does not work: the scramble field sizes
// its height after React renders, so a trial size read back the old height every time.
//
// Pure, so it runs in node tests. TimerScramble measures and calls it.

/** Smallest desktop scramble size the fit goes down to. */
export const DESKTOP_SCRAMBLE_MIN_PX = 14;

/** The scramble's line height for a font size (TimerScramble.tsx draws it at 1.6). */
export const SCRAMBLE_LINE_HEIGHT_RATIO = 1.6;

/**
 * The text the size is worked out for: the scramble's moves, each as wide as its widest
 * move, line breaks kept. Fitting the scramble itself gave each new one a slightly
 * different size (15 to 18 px in the same layout), so the text jumped on every Next. With
 * every move at the widest width, only the move count matters, and `minMoves` (the most
 * moves seen for this puzzle so far) evens that out too.
 * 'W' is the widest letter in a proportional font; in a monospaced one all are equal.
 */
export function fitReferenceText(scramble: string, minMoves = 0): string {
	const all = scramble.split(/\s+/).filter(Boolean);
	if (!all.length) return '';
	const widest = Math.max(...all.map((move) => move.length));
	const wide = 'W'.repeat(widest);
	const lines = scramble.split('\n').map((line) => line.split(/\s+/).filter(Boolean).map(() => wide));
	// Missing moves go on the last line, where a longer scramble would have them.
	for (let missing = minMoves - all.length; missing > 0; missing--) {
		lines[lines.length - 1].push(wide);
	}
	return lines.map((line) => line.join(' ')).join('\n');
}

/** Moves in a scramble, for `fitReferenceText`'s `minMoves`. */
export function countMoves(scramble: string): number {
	return scramble.split(/\s+/).filter(Boolean).length;
}

/**
 * Height left for the scramble's lines: the area, minus everything else in the content
 * (the content's height without the scramble block), minus the block's own padding and
 * border. Never negative.
 */
export function scrambleLinesBudget(
	areaHeight: number,
	contentHeight: number,
	scrambleBlockHeight: number,
	scrambleBlockChrome: number
): number {
	const rest = Math.max(0, contentHeight - scrambleBlockHeight);
	return Math.max(0, areaHeight - rest - Math.max(0, scrambleBlockChrome));
}

/**
 * Shortest the timer column may get: what it holds besides the timer area (the daily
 * goal bar and its gap), plus the timer area's content with the scramble at its smallest
 * size. A column shorter than that cuts the digits off however small the scramble is, so
 * the module bar under it stops growing there instead (TimerLayout.scss, `--zt-timer-floor`).
 *
 * Nothing in it depends on the area's own height, which is what keeps the floor from
 * feeding back into the fit that reads it.
 */
export function timerColumnFloor(
	columnHeight: number,
	areaHeight: number,
	contentHeight: number,
	scrambleBlockHeight: number,
	scrambleBlockChrome: number,
	smallestLinesHeight: number
): number {
	const around = Math.max(0, columnHeight - areaHeight);
	const rest = Math.max(0, contentHeight - scrambleBlockHeight);
	return Math.ceil(around + rest + Math.max(0, scrambleBlockChrome) + Math.max(0, smallestLinesHeight));
}
