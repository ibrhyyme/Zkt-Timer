/**
 * The solves grid's average columns (desktop). Stored as a plain list of window sizes in
 * the `history_columns` platform setting, so the layout follows the user across PCs
 * without a schema change. The solve number and the time are fixed and never listed.
 */

/** The ready-made choices in "Customize solves". Anything else can be typed in. */
export const HISTORY_COLUMN_PRESETS = [5, 12, 25, 50, 100, 250, 500, 1000, 2000, 5000];

/** cstimer's default: ao5 and ao12 next to the time. */
export const DEFAULT_HISTORY_COLUMNS = [5, 12];

/** Same bounds the stats module's custom average accepts. */
export const MIN_HISTORY_COLUMN = 3;
export const MAX_HISTORY_COLUMN = 10000;

/** Enough for a wide bottom bar; past this the grid is a spreadsheet nobody reads. */
export const MAX_HISTORY_COLUMNS = 12;

export function isValidHistoryColumn(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n >= MIN_HISTORY_COLUMN && n <= MAX_HISTORY_COLUMN;
}

/**
 * Whatever came out of storage, as a usable column list: integers in range, no
 * duplicates, at most MAX_HISTORY_COLUMNS, order kept. A missing value (a user who never
 * opened the menu) gets the default; an empty list stays empty, because removing every
 * average column is a valid choice.
 */
export function sanitizeHistoryColumns(raw: unknown): number[] {
	if (!Array.isArray(raw)) return DEFAULT_HISTORY_COLUMNS.slice();

	const out: number[] = [];
	for (const value of raw) {
		const n = typeof value === 'string' ? Number(value) : value;
		if (!isValidHistoryColumn(n) || out.includes(n)) continue;
		out.push(n);
		if (out.length >= MAX_HISTORY_COLUMNS) break;
	}
	return out;
}

/** "ao12", or "mo3" below 5 where nothing is trimmed and it is a plain mean. */
export function historyColumnLabel(n: number): string {
	return `${n < 5 ? 'mo' : 'ao'}${n}`;
}

export function addHistoryColumn(columns: number[], n: number): number[] {
	if (!isValidHistoryColumn(n) || columns.includes(n) || columns.length >= MAX_HISTORY_COLUMNS) return columns;
	return [...columns, n];
}

export function removeHistoryColumn(columns: number[], index: number): number[] {
	if (index < 0 || index >= columns.length) return columns;
	return columns.filter((_, i) => i !== index);
}

/** Swaps a column with its neighbour; `direction` -1 moves it left, 1 right. */
export function moveHistoryColumn(columns: number[], index: number, direction: -1 | 1): number[] {
	const target = index + direction;
	if (index < 0 || index >= columns.length || target < 0 || target >= columns.length) return columns;
	const next = columns.slice();
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

/** Parses the custom count field. Returns null for anything that is not a valid size. */
export function parseHistoryColumnInput(text: string): number | null {
	const trimmed = (text || '').trim().replace(/^(ao|mo)/i, '');
	if (!/^\d+$/.test(trimmed)) return null;
	const n = Number(trimmed);
	return isValidHistoryColumn(n) ? n : null;
}
