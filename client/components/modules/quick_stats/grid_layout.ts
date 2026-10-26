/**
 * Layout of the stats module: equal cells in rows, the column count picked from the module's
 * size so the values come out as large as they can.
 *
 * It replaced a fixed 4x4 grid that grew the first blocks until the 16 cells were full: three
 * blocks made one 4x2 and two 2x2, five made three 2x2 and two 2x1, so the same kind of number
 * had a different size in every block.
 */

// Roboto Mono's advance width as a share of the font size.
const MONO_ADVANCE = 0.6;
// Room a cell needs besides its value: the caption line and the padding.
const CAPTION_PX = 18;
const PAD_X = 16;
const PAD_Y = 10;
// Share of the height left under the caption the digits may take; the rest is breathing room.
const HEIGHT_SHARE = 0.78;
const MIN_FONT = 12;
const MAX_FONT = 72;
// The value width the layout plans for ("12.34", "1:02.34" is wider and shrinks its own row).
const PLANNED_CHARS = 6;
const CELL_ASPECT = 2;
// Below this a value is too small to read at a glance; whole captions are not worth that.
const MIN_READABLE_FONT = 20;

/** The largest value font that fits a cell, for a value `chars` characters long. */
export function fitValueFontSize(cellWidth: number, cellHeight: number, chars: number): number {
	const byHeight = (cellHeight - CAPTION_PX - PAD_Y) * HEIGHT_SHARE;
	const byWidth = (cellWidth - PAD_X) / (Math.max(chars, 4) * MONO_ADVANCE);
	return Math.round(Math.max(MIN_FONT, Math.min(MAX_FONT, byHeight, byWidth)));
}

export interface StatsGrid {
	columns: number;
	/** Blocks per row, top to bottom. Only the last row can be shorter; its cells widen. */
	rows: number[];
}

/**
 * The column count that gives the largest value font. On a tie (a big module reaches the font
 * cap with several counts) the one leaving fewer empty slots wins, then the one whose cells
 * are closest to a reading shape, a caption over a number: about twice as wide as tall.
 *
 * `minCellWidth` keeps the captions whole: a cell narrower than the longest caption cut
 * "Session best ao5" and "Session best ao12" down to the same "Session best ...". The number
 * comes first, though: when whole captions would push it below a readable size, the captions
 * give way (they end in an ellipsis, with the full text on hover).
 */
export function pickStatsGrid(count: number, width: number, height: number, gap = 0, minCellWidth = 0): StatsGrid {
	if (count <= 0) {
		return {columns: 0, rows: []};
	}

	// Not measured yet (first render, server render): two columns, the old default look.
	let columns = Math.min(2, count);
	if (width > 0 && height > 0) {
		const whole = bestColumns(count, width, height, gap, minCellWidth);
		columns = whole.columns;
		if (whole.font < MIN_READABLE_FONT) {
			const any = bestColumns(count, width, height, gap, 0);
			if (any.font > whole.font) {
				columns = any.columns;
			}
		}
	}

	const rows: number[] = [];
	for (let left = count; left > 0; left -= columns) {
		rows.push(Math.min(columns, left));
	}
	return {columns, rows};
}

/** The column count with the largest value font among those whose cells are at least `minCellWidth` wide. */
function bestColumns(count: number, width: number, height: number, gap: number, minCellWidth: number) {
	let best = {columns: 1, font: -1, empty: Infinity, shape: Infinity};
	for (let columns = 1; columns <= count; columns++) {
		const rowCount = Math.ceil(count / columns);
		const cellWidth = (width - gap * (columns - 1)) / columns;
		const cellHeight = (height - gap * (rowCount - 1)) / rowCount;
		// One column is always a candidate, however narrow.
		if (columns > 1 && cellWidth < minCellWidth) {
			break;
		}
		const font = fitValueFontSize(cellWidth, cellHeight, PLANNED_CHARS);
		const empty = columns * rowCount - count;
		const shape = Math.abs(Math.log(cellWidth / cellHeight / CELL_ASPECT));
		const better =
			font > best.font ||
			(font === best.font && (empty < best.empty || (empty === best.empty && shape < best.shape)));
		if (better) {
			best = {columns, font, empty, shape};
		}
	}
	return best;
}
