import {DEFAULT_SLUG_MAX_LENGTH, idFromSlugWithId, slugify, slugWithId} from '../url_slug';

describe('slugify', () => {
	it('lowercases and joins words with single dashes', () => {
		expect(slugify('2-Look OLL')).toBe('2-look-oll');
		expect(slugify('  ---PLL!! Full set??  ')).toBe('pll-full-set');
		expect(slugify('a___b...c')).toBe('a-b-c');
	});

	it('maps Turkish letters without folding ASCII I into dotless i', () => {
		expect(slugify('Öğrenmem Gerekenler')).toBe('ogrenmem-gerekenler');
		expect(slugify('ÇĞİÖŞÜ çğıöşü')).toBe('cgiosu-cgiosu');
		expect(slugify('BIG III')).toBe('big-iii');
	});

	it('strips accents and maps letters NFKD keeps whole', () => {
		expect(slugify('Café Münchén')).toBe('cafe-munchen');
		expect(slugify('Straße Ærø')).toBe('strasse-aero');
		expect(slugify('Algoritmos básicos, señal')).toBe('algoritmos-basicos-senal');
	});

	it('transliterates Cyrillic', () => {
		expect(slugify('Мои алгоритмы')).toBe('moi-algoritmy');
		expect(slugify('Щука Юла Ёж')).toBe('shchuka-yula-ezh');
	});

	it('folds full-width digits and letters', () => {
		expect(slugify('ＯＬＬ ２')).toBe('oll-2');
	});

	it('is empty when nothing usable is left', () => {
		expect(slugify('公式集')).toBe('');
		expect(slugify('!!! 🧩')).toBe('');
		expect(slugify('')).toBe('');
		expect(slugify(null)).toBe('');
		expect(slugify(undefined)).toBe('');
	});

	it('cuts a long name at a word boundary in the second half of the limit', () => {
		const slug = slugify('word '.repeat(30));
		expect(slug.length).toBeLessThanOrEqual(DEFAULT_SLUG_MAX_LENGTH);
		expect(slug.endsWith('-')).toBe(false);
		expect(slug.split('-').every((w) => w === 'word')).toBe(true);
	});

	it('cuts hard when the only boundary is too early', () => {
		const slug = slugify('ab ' + 'c'.repeat(100), 20);
		expect(slug).toBe('ab-' + 'c'.repeat(17));
	});
});

describe('slugWithId / idFromSlugWithId', () => {
	it('puts the name in front of the id and reads the id back', () => {
		const segment = slugWithId('2-Look OLL', 'DEURpUGSLE');
		expect(segment).toBe('2-look-oll-DEURpUGSLE');
		expect(idFromSlugWithId(segment)).toBe('DEURpUGSLE');
	});

	it('falls back to the bare id when the name has no slug', () => {
		expect(slugWithId('公式集', 'DEURpUGSLE')).toBe('DEURpUGSLE');
		expect(slugWithId(null, 'DEURpUGSLE')).toBe('DEURpUGSLE');
	});

	it('reads a bare id unchanged', () => {
		expect(idFromSlugWithId('DEURpUGSLE')).toBe('DEURpUGSLE');
	});

	it('ignores whatever slug is in front', () => {
		expect(idFromSlugWithId('old-name-DEURpUGSLE')).toBe('DEURpUGSLE');
		expect(idFromSlugWithId('anything-at-all-DEURpUGSLE')).toBe('DEURpUGSLE');
	});
});
