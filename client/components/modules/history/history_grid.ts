/**
 * Formatting for the solves grid's number column.
 *
 * The list used to print `(index + 1).toLocaleString()` plus a period, so in Turkish
 * solve 12007 read "12.007." right next to a time like "12.88": two dotted numbers in a
 * row, and the number overflowed its fixed 40px cell into the time (feedback 1.9-e).
 * The grid gives the number its own column sized to the longest number in the list, and
 * groups thousands with a narrow no-break space, which no locale reads as a decimal mark.
 */

/** U+202F NARROW NO-BREAK SPACE: groups digits without looking like a decimal point. */
export const SOLVE_NUMBER_GROUP = ' ';

export function formatSolveNumber(n: number): string {
	const digits = String(Math.max(0, Math.floor(n)));
	if (digits.length <= 4) return digits; // "1204" reads fine, cstimer does the same
	return digits.replace(/\B(?=(\d{3})+(?!\d))/g, SOLVE_NUMBER_GROUP);
}

/**
 * Width of the number column in `ch`, enough for the largest number in a list of
 * `count` solves. Every row is its own grid (the list is virtualized), so the column
 * cannot size itself to its content; it is given this width instead.
 */
export function solveNumberColumnCh(count: number): number {
	const text = formatSolveNumber(Math.max(1, count));
	// A narrow space is roughly half a digit wide.
	const groups = text.length - String(Math.max(1, Math.floor(count))).length;
	const digits = text.length - groups;
	return Math.max(2, digits + groups * 0.5);
}

/**
 * The grid's `grid-template-columns`, shared by the header and every row through one CSS
 * variable. Built here rather than in the stylesheet because the column count varies
 * and `repeat(0, ...)` is invalid CSS.
 *
 * Desktop: number, time, then one column per average. Phone: number, time, delete.
 */
export function historyGridTemplate(solveCount: number, averageColumns: number, mobile: boolean): string {
	const index = `calc(${solveNumberColumnCh(solveCount)}ch + ${mobile ? 12 : 16}px)`;
	if (mobile) return `${index} minmax(0, 1fr) 44px`;
	const averages = averageColumns > 0 ? ` repeat(${averageColumns}, minmax(4.8em, 1fr))` : '';
	return `${index} minmax(5.2em, 1.2fr)${averages}`;
}
