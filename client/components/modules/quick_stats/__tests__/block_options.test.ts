import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import {
	blockWindowIsTrimmed,
	getBlockCount,
	getBlockKind,
	getBlockValue,
	moveBlock,
	parseAverageCount,
	withBlockKind,
} from '../block_options';

const base: StatsModuleBlock = { statType: 'average', sortBy: 'current', session: true, colorName: 'green', averageCount: 12 };

describe('getBlockKind', () => {
	it('reads the stored fields', () => {
		expect(getBlockKind({ statType: 'single', averageCount: 0 })).toBe('single');
		expect(getBlockKind({ statType: 'average', averageCount: 5 })).toBe('ao');
		expect(getBlockKind({ statType: 'mean', averageCount: 3 })).toBe('mo');
		expect(getBlockKind({ statType: 'mean', averageCount: 0 })).toBe('mean');
		expect(getBlockKind({ statType: 'stdev', averageCount: 0 })).toBe('stdev');
		expect(getBlockKind({ statType: 'count', averageCount: 0 })).toBe('count');
	});

	it('takes an old average without a count for the mean its caption always said', () => {
		expect(getBlockKind({ statType: 'average', averageCount: 0 })).toBe('mean');
		expect(getBlockKind({ statType: 'average', averageCount: null })).toBe('mean');
	});
});

describe('getBlockValue', () => {
	it('keeps an offered value and replaces one the kind does not offer', () => {
		expect(getBlockValue({ ...base, sortBy: 'worst' })).toBe('worst');
		expect(getBlockValue({ ...base, statType: 'single', sortBy: 'current' })).toBe('best');
		expect(getBlockValue({ ...base, statType: 'mean', averageCount: 3, sortBy: 'wpa' })).toBe('current');
		expect(getBlockValue({ ...base, statType: 'count' })).toBeNull();
	});
});

describe('withBlockKind', () => {
	it('keeps scope, colour, count and a value that still applies', () => {
		const mo = withBlockKind({ ...base, sortBy: 'best' }, 'mo');
		expect(mo).toEqual({ ...base, statType: 'mean', averageCount: 12, sortBy: 'best' });
		expect(getBlockKind(mo)).toBe('mo');
	});

	it('gives an average or σ a count when switching from a kind without one', () => {
		expect(withBlockKind({ ...base, statType: 'single', averageCount: 0, sortBy: 'best' }, 'ao').averageCount).toBe(5);
		expect(withBlockKind({ ...base, statType: 'count', averageCount: 0 }, 'mo').averageCount).toBe(3);
		expect(withBlockKind({ ...base, statType: 'count', averageCount: 0 }, 'stdev').averageCount).toBe(12);
	});

	it('clears the count for kinds without one', () => {
		const mean = withBlockKind(base, 'mean');
		expect(mean.averageCount).toBe(0);
		expect(getBlockKind(mean)).toBe('mean');
		expect(getBlockCount(withBlockKind(base, 'count'))).toBe(0);
	});
});

describe('blockWindowIsTrimmed', () => {
	it('brackets the trimmed solves of an average window only', () => {
		expect(blockWindowIsTrimmed(base)).toBe(true);
		expect(blockWindowIsTrimmed({ ...base, statType: 'stdev' })).toBe(true);
		expect(blockWindowIsTrimmed({ ...base, statType: 'mean', averageCount: 12 })).toBe(false);
		expect(blockWindowIsTrimmed({ ...base, sortBy: 'target' })).toBe(false);
		expect(blockWindowIsTrimmed(undefined)).toBe(true);
	});
});

describe('parseAverageCount', () => {
	it('accepts whole numbers from 3 to 10,000', () => {
		expect(parseAverageCount(' 42 ')).toBe(42);
		expect(parseAverageCount('3')).toBe(3);
		expect(parseAverageCount('10000')).toBe(10000);
		expect(parseAverageCount('2')).toBeNull();
		expect(parseAverageCount('10001')).toBeNull();
		expect(parseAverageCount('4.5')).toBeNull();
		expect(parseAverageCount('ao5')).toBeNull();
		expect(parseAverageCount('')).toBeNull();
	});
});

describe('moveBlock', () => {
	it('moves one entry and ignores an out of range move', () => {
		expect(moveBlock(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
		expect(moveBlock(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
		const same = ['a', 'b'];
		expect(moveBlock(same, 1, 5)).toBe(same);
	});
});
