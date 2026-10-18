// How the desktop time row fits its centre column.
//
// The row puts the digits and a companion side by side: the smart cube with its connect
// column, the virtual cube, or a hardware timer's connect control. Between two module
// rails the centre can be narrower than that pair (a tablet in landscape, a laptop at
// 1024 to 1280 px), and the pair used to spill out of both sides of the column, digits
// cut on the left and the connect button on the right.
//
// Two ways out, in order:
//  - folded: the smart cube shrinks and its connect column moves under it, the pair stays
//    a row;
//  - stacked: the companion moves under the digits, the smart cube at its smaller size
//    (and folded too if even that is wide). The smaller cube keeps the taller stack inside
//    a 768 px high screen.
//
// Pure, so it runs in node tests. useTimeRowFit measures and calls it.

/** The time the digits are sized for. "12.34": a 3x3 time past ten seconds. */
export const REFERENCE_GLYPHS = 5;

/** Advance of one glyph, in em, of Roboto Mono (the default timer font, monospaced). */
export const GLYPH_ADVANCE_EM = 0.6;

/**
 * Size of the folded smart cube against the cube in a row: zoom 0.3 against 0.4
 * (SmartCube.scss `__cube`, Timer.scss `&--folded`).
 */
export const FOLDED_CUBE_SCALE = 0.75;

/**
 * The smart cube's widths: cube and connect column in a line, the same line with the
 * smaller cube (as drawn under the digits), and folded (smaller cube, column under it).
 */
export function smartCubeWidths(
	cube: number,
	innerGap: number,
	side: number
): { line: number; stacked: number; folded: number } {
	const c = Math.max(0, cube || 0);
	const s = Math.max(0, side || 0);
	const g = c > 0 && s > 0 ? Math.max(0, innerGap || 0) : 0;
	const small = c * FOLDED_CUBE_SCALE;
	return { line: c + g + s, stacked: small + g + s, folded: Math.max(small, s) };
}

export interface TimeRowWidths {
	/** Width the row may use. */
	available: number;
	/** Width of the digits, for the reference time at least. */
	digits: number;
	/** Gap between the digits and the companion. */
	gap: number;
	/** The companion laid out in one line. 0 when there is none. */
	companion: number;
	/** The companion as drawn under the digits, when that differs (the smaller smart cube). */
	companionStacked?: number;
	/** The companion folded on itself. Absent when it cannot fold. */
	companionFolded?: number;
}

export interface TimeRowFit {
	stacked: boolean;
	folded: boolean;
}

export const TIME_ROW_FITS: TimeRowFit = { stacked: false, folded: false };

/** Width of the digits for the reference time at this font size. */
export function referenceDigitsWidth(fontSizePx: number): number {
	return fontSizePx * GLYPH_ADVANCE_EM * REFERENCE_GLYPHS;
}

export function timeRowFit(w: TimeRowWidths): TimeRowFit {
	const valid = (n: number | undefined) => typeof n === 'number' && Number.isFinite(n) && n > 0;

	if (!valid(w.companion) || !valid(w.available)) return TIME_ROW_FITS;

	const digits = valid(w.digits) ? w.digits : 0;
	const gap = valid(w.gap) ? w.gap : 0;
	const canFold = valid(w.companionFolded) && w.companionFolded < w.companion;

	if (digits + gap + w.companion <= w.available) return TIME_ROW_FITS;

	if (canFold && digits + gap + w.companionFolded <= w.available) {
		return { stacked: false, folded: true };
	}

	const underDigits = valid(w.companionStacked) ? w.companionStacked : w.companion;
	return { stacked: true, folded: canFold && underDigits > w.available };
}
