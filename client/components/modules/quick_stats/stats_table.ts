/**
 * What the stats table shows: its rows (window sizes) and its optional columns.
 *
 * The table follows cstimer's summary table: a single row, then one row per window size,
 * "current" and "best" for each, rows appearing as the session reaches their size. Sizes
 * below 5 trim nothing and read as a mean (mo3), the same way the solves grid labels them.
 *
 * Both lists are platform settings (`stats_table_rows`, `stats_table_columns`), so no
 * schema change. A user who never chose rows (null) is read from the stats blocks they
 * had customized before the table replaced them, else gets the default.
 */

import {StatsModuleBlock} from '../../../../server/schemas/StatsModule.schema';
import {UserAccount} from '../../../../server/schemas/UserAccount.schema';
import {isPro, isProEnabled} from '../../../lib/pro';
import {historyColumnLabel, MAX_HISTORY_COLUMN, MIN_HISTORY_COLUMN} from '../history/history_columns';
import {getBlockCount, getBlockKind, getBlockValue} from './block_options';

/**
 * The ready-made sizes, cstimer's longest list (stats.js, `statal`): the editor offers each
 * as a chip, and all of them are the default. Rows only appear once the session has that
 * many solves, so the default grows with the user.
 */
export const STATS_TABLE_SIZES = [3, 5, 12, 25, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

export const DEFAULT_STATS_TABLE_ROWS = STATS_TABLE_SIZES;

export const MAX_STATS_TABLE_ROWS = 16;

/** Columns beyond "current" and "best", which are always shown. */
export type StatsTableColumn = 'worst' | 'bpa' | 'wpa' | 'target';

export const STATS_TABLE_COLUMNS: StatsTableColumn[] = ['worst', 'bpa', 'wpa', 'target'];

/**
 * The extra columns are Pro (owner, 2026-11-23); the rows are open to everyone. Client only,
 * like the blocks' colour before them: the numbers are the user's own local solves, so
 * there is nothing for the server to hold back. With Pro switched off everyone has them.
 */
export function extraColumnsUnlocked(me?: UserAccount): boolean {
	return !isProEnabled() || isPro(me);
}

/** The columns that look at the next solve: their row shows one solve before its size. */
export function isOutlookColumn(column: StatsTableColumn): boolean {
	return column !== 'worst';
}

export function isValidTableRow(n: unknown): n is number {
	return typeof n === 'number' && Number.isInteger(n) && n >= MIN_HISTORY_COLUMN && n <= MAX_HISTORY_COLUMN;
}

/** Valid sizes, no duplicates, smallest first (cstimer sorts them too), at most MAX_STATS_TABLE_ROWS. */
export function sanitizeTableRows(raw: unknown): number[] {
	if (!Array.isArray(raw)) return [];
	const out: number[] = [];
	for (const value of raw) {
		const n = typeof value === 'string' ? Number(value) : value;
		if (!isValidTableRow(n) || out.includes(n)) continue;
		out.push(n);
	}
	return out.sort((a, b) => a - b).slice(0, MAX_STATS_TABLE_ROWS);
}

export function sanitizeTableColumns(raw: unknown): StatsTableColumn[] {
	if (!Array.isArray(raw)) return [];
	return STATS_TABLE_COLUMNS.filter((column) => raw.includes(column));
}

export function tableRowLabel(n: number): string {
	return historyColumnLabel(n);
}

function sameBlocks(a: StatsModuleBlock[], b: StatsModuleBlock[]): boolean {
	if (a.length !== b.length) return false;
	return a.every((block, i) => {
		const other = b[i];
		return (
			block.statType === other.statType &&
			block.sortBy === other.sortBy &&
			!!block.session === !!other.session &&
			(block.averageCount || 0) === (other.averageCount || 0)
		);
	});
}

/**
 * Rows to show. A stored list wins (an empty one included: it leaves the single row only).
 * Without one, the sizes of the old stats blocks a user had set up, so nobody's choice is
 * lost; untouched default blocks, or blocks without a size, give the default.
 */
export function resolveTableRows(
	stored: unknown,
	blocks: StatsModuleBlock[] | undefined,
	defaultBlocks: StatsModuleBlock[]
): number[] {
	if (Array.isArray(stored)) return sanitizeTableRows(stored);
	if (!blocks?.length || sameBlocks(blocks, defaultBlocks)) return DEFAULT_STATS_TABLE_ROWS.slice();

	const sizes: number[] = [];
	for (const block of blocks) {
		const kind = getBlockKind(block);
		if (kind === 'ao' || kind === 'mo' || kind === 'stdev') sizes.push(getBlockCount(block));
	}
	const rows = sanitizeTableRows(sizes);
	return rows.length ? rows : DEFAULT_STATS_TABLE_ROWS.slice();
}

/** Extra columns to show: the stored list, else the values the old blocks used. */
export function resolveTableColumns(stored: unknown, blocks: StatsModuleBlock[] | undefined): StatsTableColumn[] {
	if (Array.isArray(stored)) return sanitizeTableColumns(stored);
	const used = (blocks || [])
		.filter((block) => {
			const kind = getBlockKind(block);
			return kind === 'ao' || kind === 'mo';
		})
		.map((block) => getBlockValue(block));
	return sanitizeTableColumns(used);
}

/**
 * Whether a row is shown with `solveCount` solves in the session: from its size on, or one
 * solve earlier when a next-solve column is on (cstimer's rule), since then BPA, WPA and the
 * target time already say something.
 */
export function isTableRowVisible(n: number, solveCount: number, columns: StatsTableColumn[]): boolean {
	if (solveCount >= n) return true;
	return solveCount === n - 1 && columns.some(isOutlookColumn);
}
