import {
	buildSplitSessionName,
	createSplitBucketMatcher,
	MAX_SPLIT_BUCKETS,
	normalizeSplitBuckets,
	orderAfterSource,
	validateSplitBuckets,
} from '../session_split';

describe('normalizeSplitBuckets', () => {
	it('treats the empty subset and null as the same bucket', () => {
		expect(
			normalizeSplitBuckets([
				{cube_type: '333cfop', scramble_subset: ''},
				{cube_type: '333cfop', scramble_subset: null},
				{cube_type: '333cfop', scramble_subset: 'pll'},
			])
		).toEqual([
			{cube_type: '333cfop', scramble_subset: null},
			{cube_type: '333cfop', scramble_subset: 'pll'},
		]);
	});

	it('drops rows without a cube type', () => {
		expect(normalizeSplitBuckets([{cube_type: '', scramble_subset: 'pll'}, null as any])).toEqual([]);
	});
});

describe('validateSplitBuckets', () => {
	it('needs at least one bucket', () => {
		expect(validateSplitBuckets([])).not.toBeNull();
	});

	it('refuses oversized input', () => {
		const many = Array.from({length: MAX_SPLIT_BUCKETS + 1}, (_, i) => ({cube_type: `c${i}`, scramble_subset: null}));
		expect(validateSplitBuckets(many)).not.toBeNull();
		expect(validateSplitBuckets([{cube_type: 'x'.repeat(101), scramble_subset: null}])).not.toBeNull();
		expect(validateSplitBuckets([{cube_type: 'wca', scramble_subset: 'y'.repeat(101)}])).not.toBeNull();
	});

	it('accepts a normal selection', () => {
		expect(validateSplitBuckets([{cube_type: 'wca', scramble_subset: '333'}, {cube_type: '333cfop', scramble_subset: null}])).toBeNull();
	});
});

describe('createSplitBucketMatcher', () => {
	const matches = createSplitBucketMatcher([
		{cube_type: '333cfop', scramble_subset: 'pll'},
		{cube_type: 'wca', scramble_subset: '222'},
		{cube_type: '333', scramble_subset: null},
	]);

	it('moves only the chosen buckets', () => {
		expect(matches({cube_type: '333cfop', scramble_subset: 'pll'})).toBe(true);
		expect(matches({cube_type: '333cfop', scramble_subset: 'oll'})).toBe(false);
		expect(matches({cube_type: '333cfop', scramble_subset: null})).toBe(false);
		expect(matches({cube_type: 'wca', scramble_subset: '222'})).toBe(true);
		expect(matches({cube_type: 'wca', scramble_subset: '333'})).toBe(false);
	});

	it('matches a default-subset bucket whether the solve stores null, undefined or an empty string', () => {
		expect(matches({cube_type: '333', scramble_subset: null})).toBe(true);
		expect(matches({cube_type: '333'})).toBe(true);
		expect(matches({cube_type: '333', scramble_subset: ''})).toBe(true);
		expect(matches({cube_type: '333', scramble_subset: '333oh'})).toBe(false);
	});
});

describe('buildSplitSessionName', () => {
	it('puts the moved types in brackets after the original name', () => {
		expect(buildSplitSessionName('3x3', ['PLL'])).toBe('3x3 (PLL)');
		expect(buildSplitSessionName('Antrenman', ['2x2', 'Pyraminx', '2x2'])).toBe('Antrenman (2x2, Pyraminx)');
	});

	it('falls back to whichever part exists', () => {
		expect(buildSplitSessionName('', ['PLL'])).toBe('PLL');
		expect(buildSplitSessionName('3x3', [])).toBe('3x3');
	});

	it('stays within the length cap and keeps the original name whole', () => {
		const name = buildSplitSessionName('Sezon', ['a'.repeat(300)], 50);
		expect(name.length).toBeLessThanOrEqual(50);
		expect(name.startsWith('Sezon (')).toBe(true);
		expect(name.endsWith('…)')).toBe(true);
	});
});

describe('orderAfterSource', () => {
	it('places the new session right after its source', () => {
		expect(orderAfterSource(['a', 'b', 'c'], 'b', 'n')).toEqual(['a', 'b', 'n', 'c']);
		expect(orderAfterSource(['a', 'b', 'n', 'c'], 'c', 'n')).toEqual(['a', 'b', 'c', 'n']);
	});

	it('appends when the source is unknown', () => {
		expect(orderAfterSource(['a'], 'x', 'n')).toEqual(['a', 'n']);
	});
});
