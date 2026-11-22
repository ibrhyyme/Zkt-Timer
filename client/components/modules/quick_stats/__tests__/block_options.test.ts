import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import {
	blockWindowIsTrimmed,
	getBlockCount,
	getBlockKind,
	getBlockValue,
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

describe('blockWindowIsTrimmed', () => {
	it('brackets the trimmed solves of an average window only', () => {
		expect(blockWindowIsTrimmed(base)).toBe(true);
		expect(blockWindowIsTrimmed({ ...base, statType: 'stdev' })).toBe(true);
		expect(blockWindowIsTrimmed({ ...base, statType: 'mean', averageCount: 12 })).toBe(false);
		expect(blockWindowIsTrimmed({ ...base, sortBy: 'target' })).toBe(false);
		expect(blockWindowIsTrimmed(undefined)).toBe(true);
	});
});
