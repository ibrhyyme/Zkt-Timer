import {catalogPuzzles, catalogSections, categoryDisplayName, categoryInfoKey, categoryLongName} from '../catalog';

const CATEGORIES = ['F2L', 'OLL', 'PLL', 'ZBLL', 'CMLL', '1LLL', 'VLS', '2x2 CLL', 'OLLCP', 'Pyraminx L4E', 'SQ1 CP', 'Sarah Advanced'];

describe('catalogPuzzles', () => {
	it('lists the puzzles that have categories, in the trainer order', () => {
		expect(catalogPuzzles(CATEGORIES, 'standard')).toEqual(['3x3', '3x3 Roux', '2x2', 'Pyraminx', 'Skewb', 'Square-1']);
	});

	it('Smart Cube mode keeps the 3x3 puzzles only', () => {
		expect(catalogPuzzles(CATEGORIES, 'smart')).toEqual(['3x3', '3x3 Roux']);
	});

	it('no categories yet, no tabs', () => {
		expect(catalogPuzzles([], 'standard')).toEqual([]);
	});
});

describe('catalogSections', () => {
	it('keeps library order and lists the large categories apart', () => {
		expect(catalogSections(CATEGORIES, '3x3')).toEqual({regular: ['F2L', 'OLL', 'PLL'], large: ['ZBLL', '1LLL', 'VLS', 'OLLCP']});
	});

	it('other puzzles have their own categories and no large section', () => {
		expect(catalogSections(CATEGORIES, '3x3 Roux')).toEqual({regular: ['CMLL'], large: []});
		expect(catalogSections(CATEGORIES, 'Skewb')).toEqual({regular: ['Sarah Advanced'], large: []});
	});
});

describe('category names', () => {
	it('drops the puzzle prefix the tab already says', () => {
		expect(categoryDisplayName('2x2 CLL')).toBe('CLL');
		expect(categoryDisplayName('Pyraminx L4E')).toBe('L4E');
		expect(categoryDisplayName('SQ1 CP')).toBe('CP');
		expect(categoryDisplayName('2-Look OLL')).toBe('2-Look OLL');
		expect(categoryDisplayName('OLL')).toBe('OLL');
	});

	it('a long name that only repeats the name is dropped', () => {
		expect(categoryLongName('2x2 EG1', '2x2 EG-1')).toBe('');
		expect(categoryLongName('2x2 Ortega OLL', '2x2 Ortega OLL')).toBe('');
		expect(categoryLongName('Anti PLL', 'Anti PLL')).toBe('');
		expect(categoryLongName('OLL', 'Son Katmanı Yönlendirme')).toBe('Son Katmanı Yönlendirme');
		expect(categoryLongName('2-Look PLL', '2 Adımlı PLL')).toBe('2 Adımlı PLL');
		expect(categoryLongName('ZBLS', 'Zborowski-Bruchem 最后槽位')).toBe('Zborowski-Bruchem 最后槽位');
	});

	it('info key matches the cat_info translation keys', () => {
		expect(categoryInfoKey('2-Look PLL')).toBe('2_look_pll');
		expect(categoryInfoKey('2x2 EG1')).toBe('2x2_eg1');
		expect(categoryInfoKey('OH-CMLL')).toBe('oh_cmll');
	});
});
