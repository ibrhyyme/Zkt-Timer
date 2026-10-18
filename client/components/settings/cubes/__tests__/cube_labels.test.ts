import {
	calendarDaysAgo,
	cubeAddLink,
	cubeProfileLink,
	filterCubes,
	formatLastUsed,
	formPuzzleOptions,
	orderPuzzles,
	parseAddLink,
	puzzleLabel,
} from '../cube_labels';

const custom = [
	{ id: 'c-uuid-2', name: 'Zz Mirror' },
	{ id: 'c-uuid-1', name: '8x8' },
];

describe('puzzleLabel', () => {
	it('uses the timer names for built-in puzzles and the custom name for custom ones', () => {
		expect(puzzleLabel('333')).toBe('3x3');
		expect(puzzleLabel('pyram')).toBe('Pyraminx');
		expect(puzzleLabel('c-uuid-1', custom)).toBe('8x8');
		expect(puzzleLabel('gone-id', custom)).toBe('gone-id');
	});
});

describe('orderPuzzles', () => {
	it('follows PUZZLE_KEYS, then custom types by name, without duplicates', () => {
		expect(orderPuzzles(['c-uuid-2', 'pyram', '222', '333', 'c-uuid-1', '333'], custom)).toEqual([
			'333',
			'222',
			'pyram',
			'c-uuid-1',
			'c-uuid-2',
		]);
	});
});

describe('formPuzzleOptions', () => {
	it('lists every physical puzzle and the custom types, never WCA or method types', () => {
		const ids = formPuzzleOptions(custom).map((o) => o.id);
		expect(ids.slice(0, 3)).toEqual(['333', '222', '444']);
		expect(ids).toContain('fto');
		expect(ids.slice(-2)).toEqual(['c-uuid-1', 'c-uuid-2']);
		expect(ids).not.toContain('wca');
		expect(ids).not.toContain('333cfop');
		expect(ids).not.toContain('other');
	});
});

describe('filterCubes', () => {
	const cubes = [
		{ id: 'a', name: 'GAN 12 UI', brand: 'GAN' },
		{ id: 'b', name: 'RS3M', brand: 'MoYu' },
		{ id: 'c', name: 'Işık', brand: null },
	];

	it('matches every word against name and brand, case and accent free', () => {
		expect(filterCubes(cubes, 'gan ui').map((c) => c.id)).toEqual(['a']);
		expect(filterCubes(cubes, 'moyu').map((c) => c.id)).toEqual(['b']);
		expect(filterCubes(cubes, 'isik').map((c) => c.id)).toEqual(['c']);
		expect(filterCubes(cubes, '  ').map((c) => c.id)).toEqual(['a', 'b', 'c']);
		expect(filterCubes(cubes, 'qiyi')).toEqual([]);
	});
});

describe('add link', () => {
	it('round-trips the timer parameters', () => {
		const link = cubeAddLink({ puzzle: '222', from: 'magnet' });
		expect(link.startsWith('/settings/cubes?')).toBe(true);
		expect(parseAddLink(link.slice(link.indexOf('?')))).toEqual({ open: true, puzzle: '222', from: 'magnet' });
	});

	it('opens nothing without add=1 and ignores unknown sources', () => {
		expect(parseAddLink('')).toEqual({ open: false, puzzle: null, from: null });
		expect(parseAddLink('?add=1&from=elsewhere')).toEqual({ open: true, puzzle: null, from: null });
	});

	it('builds the profile address', () => {
		expect(cubeProfileLink('abc-1')).toBe('/settings/cubes/abc-1');
	});
});

describe('last used', () => {
	const now = new Date(2026, 9, 6, 15, 0).getTime();

	it('counts calendar days, not 24 hour blocks', () => {
		expect(calendarDaysAgo(new Date(2026, 9, 6, 0, 5).getTime(), now)).toBe(0);
		expect(calendarDaysAgo(new Date(2026, 9, 5, 23, 55).getTime(), now)).toBe(1);
		expect(calendarDaysAgo(new Date(2026, 9, 3, 12, 0).getTime(), now)).toBe(3);
	});

	it('reads as today / yesterday / days ago, then a date', () => {
		expect(formatLastUsed(new Date(2026, 9, 6, 9, 0).getTime(), 'en', now)).toBe('today');
		expect(formatLastUsed(new Date(2026, 9, 5, 9, 0).getTime(), 'en', now)).toBe('yesterday');
		expect(formatLastUsed(new Date(2026, 9, 3, 9, 0).getTime(), 'en', now)).toBe('3 days ago');
		expect(formatLastUsed(new Date(2026, 9, 6, 9, 0).getTime(), 'tr', now)).toBe('bugün');
		expect(formatLastUsed(new Date(2026, 6, 1, 9, 0).getTime(), 'en', now)).toBe('Jul 1, 2026');
	});

	it('treats a future time (clock skew) as today and nothing as empty', () => {
		expect(formatLastUsed(now + 3 * 86_400_000, 'en', now)).toBe('today');
		expect(formatLastUsed(null, 'en', now)).toBe('');
	});
});
