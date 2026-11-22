import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import { defaultStatsModuleBlocks } from '../../../../reducers/stats';
import {
	DEFAULT_STATS_TABLE_ROWS,
	isTableRowVisible,
	MAX_STATS_TABLE_ROWS,
	resolveTableColumns,
	resolveTableRows,
	sanitizeTableRows,
	tableRowLabel,
} from '../stats_table';

const block = (statType: StatsModuleBlock['statType'], sortBy: StatsModuleBlock['sortBy'], averageCount: number): StatsModuleBlock => ({
	statType,
	sortBy,
	averageCount,
	session: true,
	colorName: 'text',
});

describe('sanitizeTableRows', () => {
	it('keeps valid sizes once, smallest first, up to the limit', () => {
		expect(sanitizeTableRows([12, 5, 12, '100', 2, 10001, 4.5, 'x'])).toEqual([5, 12, 100]);
		expect(sanitizeTableRows(null)).toEqual([]);
		const many = Array.from({ length: 30 }, (_, i) => i + 3);
		expect(sanitizeTableRows(many)).toHaveLength(MAX_STATS_TABLE_ROWS);
	});
});

describe('resolveTableRows', () => {
	it('uses a stored list, an empty one included', () => {
		expect(resolveTableRows([5, 12], undefined, defaultStatsModuleBlocks)).toEqual([5, 12]);
		expect(resolveTableRows([], undefined, defaultStatsModuleBlocks)).toEqual([]);
	});

	it('gives the default to a user who never customized the old blocks', () => {
		expect(resolveTableRows(null, undefined, defaultStatsModuleBlocks)).toEqual(DEFAULT_STATS_TABLE_ROWS);
		expect(resolveTableRows(null, defaultStatsModuleBlocks, defaultStatsModuleBlocks)).toEqual(DEFAULT_STATS_TABLE_ROWS);
	});

	it('carries over the sizes of customized blocks', () => {
		const blocks = [
			block('single', 'best', 0),
			block('average', 'best', 50),
			block('average', 'current', 5),
			block('mean', 'current', 3),
			block('stdev', 'current', 12),
			block('count', 'current', 0),
		];
		expect(resolveTableRows(null, blocks, defaultStatsModuleBlocks)).toEqual([3, 5, 12, 50]);
	});

	it('falls back to the default when customized blocks hold no size', () => {
		const blocks = [block('single', 'best', 0), block('mean', 'current', 0)];
		expect(resolveTableRows(null, blocks, defaultStatsModuleBlocks)).toEqual(DEFAULT_STATS_TABLE_ROWS);
	});
});

describe('resolveTableColumns', () => {
	it('turns on the columns the old blocks showed, in table order', () => {
		const blocks = [block('average', 'target', 12), block('average', 'worst', 5), block('single', 'worst', 0)];
		expect(resolveTableColumns(null, blocks)).toEqual(['worst', 'target']);
		expect(resolveTableColumns(null, defaultStatsModuleBlocks)).toEqual([]);
		expect(resolveTableColumns(['target', 'nope', 'bpa'], blocks)).toEqual(['bpa', 'target']);
	});
});

describe('isTableRowVisible', () => {
	it('shows a row from its size on, one solve earlier with a next-solve column', () => {
		expect(isTableRowVisible(12, 11, [])).toBe(false);
		expect(isTableRowVisible(12, 12, [])).toBe(true);
		expect(isTableRowVisible(12, 11, ['worst'])).toBe(false);
		expect(isTableRowVisible(12, 11, ['bpa'])).toBe(true);
		expect(isTableRowVisible(12, 10, ['target'])).toBe(false);
	});
});

describe('labels', () => {
	it('labels sizes below 5 as means', () => {
		expect(tableRowLabel(3)).toBe('mo3');
		expect(tableRowLabel(100)).toBe('ao100');
	});
});
