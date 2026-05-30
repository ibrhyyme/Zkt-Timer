import {categoryToSlug, slugToCategory} from '../category_slug';

describe('categoryToSlug', () => {
	it('basit', () => expect(categoryToSlug('PLL')).toBe('pll'));
	it('bosluk + rakam', () => expect(categoryToSlug('2x2 L3C')).toBe('2x2-l3c'));
	it('tire/ozel karakter', () => {
		expect(categoryToSlug('2-Look OLL')).toBe('2-look-oll');
		expect(categoryToSlug('OH-CMLL')).toBe('oh-cmll');
	});
	it('bas/son tire kirpilir', () => expect(categoryToSlug('  F2L  ')).toBe('f2l'));
});

describe('slugToCategory', () => {
	const cats = ['PLL', 'OLL', '2x2 L3C', 'F2L', 'OH-CMLL', 'ZBLL'];
	it('round-trip', () => {
		cats.forEach((c) => expect(slugToCategory(categoryToSlug(c), cats)).toBe(c));
	});
	it('cozulemeyen → null', () => {
		expect(slugToCategory('nonexistent', cats)).toBeNull();
	});
	it('case-insensitive slug (ZBLL → ZBLL)', () => {
		expect(slugToCategory('ZBLL', cats)).toBe('ZBLL');
		expect(slugToCategory('zbll', cats)).toBe('ZBLL');
	});
});
