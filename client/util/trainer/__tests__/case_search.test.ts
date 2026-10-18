/**
 * Set picker search (trainer-sets 5.3): ASCII folding on both sides, translated and raw subset
 * names, category names, ranking and the result limit.
 */
import {buildCaseIndex, CASE_SEARCH_LIMIT, foldSearchText, searchCases} from '../case_search';
import type {AlgorithmSubset} from '../../../components/trainer/types';

const TR: Record<string, string> = {
	'trainer.subset_names.p_shape': 'P şekli',
	'trainer.subset_names.adj_corners': 'Komşu köşe değişimi',
	'trainer.subset_names.dot': 'Nokta',
};

const t = (key: string, options?: any) => (key in TR ? TR[key] : options?.defaultValue ?? key);

const LIBRARY: Record<string, AlgorithmSubset[]> = {
	PLL: [
		{subset: 'Adj corners', algorithms: [{name: 'Aa perm', algorithm: "x R' U R' D2 R U' R' D2 R2 x'"}, {name: 'Ab perm', algorithm: "x R2 D2 R U R' D2 R U' R x'"}]},
	],
	OLL: [
		{subset: 'Dot', algorithms: [{name: 'OLL 1', algorithm: "R U2 R2 F R F' U2 R' F R F'"}]},
		{subset: 'P shape', algorithms: [{name: 'OLL 31', algorithm: "R' U' F U R U' R' F' R"}, {name: 'OLL 32', algorithm: "S R U R' U' R' F R f'"}, {name: 'OLL 43', algorithm: "F' U' L' U L F"}, {name: 'OLL 44', algorithm: "F U R U' R' F'"}, {name: 'OLL 45', algorithm: "F R U R' U' F'"}]},
	],
	'2-Look OLL': [{subset: 'Corners', algorithms: [{name: 'Sune', algorithm: "R U R' U R U2 R'"}]}],
	'2x2 CLL': [{subset: 'Sune', algorithms: [{name: 'CLL S 1', algorithm: "R U R' U R U2 R'"}]}],
};

describe('foldSearchText', () => {
	it('folds Turkish letters to ASCII and lowers case without the Turkish locale', () => {
		expect(foldSearchText('P Şekli')).toBe('p sekli');
		expect(foldSearchText('KOMŞU KÖŞE')).toBe('komsu kose');
		expect(foldSearchText('İkisi de yuvada')).toBe('ikisi de yuvada');
		expect(foldSearchText('ığüöç')).toBe('iguoc');
		// "OLL" in capitals stays ASCII ("I" does not become a dotless i)
		expect(foldSearchText('OLL')).toBe('oll');
		expect(foldSearchText('PI')).toBe('pi');
	});

	it('strips accents and collapses spaces', () => {
		expect(foldSearchText('  Café   au  lait ')).toBe('cafe au lait');
		expect(foldSearchText('')).toBe('');
		expect(foldSearchText(null)).toBe('');
	});
});

describe('searchCases', () => {
	const index = buildCaseIndex(LIBRARY, t);

	it('indexes every case once with its category::name key', () => {
		expect(index).toHaveLength(10);
		expect(index[0].key).toBe('PLL::Aa perm');
	});

	it('finds by case name', () => {
		const {results} = searchCases(index, 'aa perm');
		expect(results.map((r) => r.key)).toEqual(['PLL::Aa perm']);
		expect(searchCases(index, 'OLL 45').results[0].key).toBe('OLL::OLL 45');
	});

	it('finds by the translated subset name, with or without Turkish letters', () => {
		const keys = (q: string) => searchCases(index, q).results.map((r) => r.key);
		const pShape = ['OLL::OLL 31', 'OLL::OLL 32', 'OLL::OLL 43', 'OLL::OLL 44', 'OLL::OLL 45'];
		expect(keys('P şekli')).toEqual(pShape);
		expect(keys('p sekli')).toEqual(pShape);
		expect(keys('P ŞEKLİ')).toEqual(pShape);
	});

	it('finds by the raw subset name too', () => {
		expect(searchCases(index, 'p shape').total).toBe(5);
		expect(searchCases(index, 'adj corners').total).toBe(2);
		expect(searchCases(index, 'komsu').total).toBe(2);
	});

	it('finds by category name', () => {
		expect(searchCases(index, '2x2').results.map((r) => r.key)).toEqual(['2x2 CLL::CLL S 1']);
		expect(searchCases(index, 'pll').results.map((r) => r.category)).toEqual(['PLL', 'PLL']);
	});

	it('ranks a name match above a subset match', () => {
		// "Sune" is a case of 2-Look OLL and a subset of 2x2 CLL
		const {results} = searchCases(index, 'sune');
		expect(results.map((r) => r.key)).toEqual(['2-Look OLL::Sune', '2x2 CLL::CLL S 1']);
	});

	it('needs every word to match', () => {
		expect(searchCases(index, 'oll 31 dot').total).toBe(0);
		expect(searchCases(index, 'oll nokta').results.map((r) => r.key)).toEqual(['OLL::OLL 1']);
	});

	it('returns nothing for an empty query', () => {
		expect(searchCases(index, '   ')).toEqual({results: [], total: 0});
	});

	it('cuts at the limit but reports the full count', () => {
		const big: Record<string, AlgorithmSubset[]> = {
			ZBLL: [{subset: 'T1', algorithms: Array.from({length: 300}, (_, i) => ({name: `ZBLL ${i + 1}`, algorithm: 'R U'}))}],
		};
		const res = searchCases(buildCaseIndex(big, t), 'zbll');
		expect(res.results).toHaveLength(CASE_SEARCH_LIMIT);
		expect(res.total).toBe(300);
	});

	it('follows the given category order', () => {
		const ordered = buildCaseIndex(LIBRARY, t, ['OLL', 'PLL']);
		expect(ordered[0].category).toBe('OLL');
		expect(ordered.some((e) => e.category === '2x2 CLL')).toBe(false);
	});
});
