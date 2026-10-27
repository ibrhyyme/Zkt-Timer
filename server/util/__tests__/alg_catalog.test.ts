// Algorithm catalog against the real public/trainer/default-algs.json (design trainer-sets 4.3, 4.8).

import {
	buildAlgCatalog,
	casesNeedingPool,
	getAlgCatalog,
	getCatalogCase,
	Library,
	matchSetItems,
	PoolRow,
} from '../alg_catalog';
import {algSetCaseKey} from '../../../shared/trainer/alg_sets';
import {buildTrainerLibrary, setTrainerLibraryForTests} from '../trainer_library';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library: Library = require('../../../public/trainer/default-algs.json');

// The private library (data/trainer, outside git) may sit on this machine; the catalog under
// test is the public one, the same on every checkout.
setTrainerLibraryForTests(buildTrainerLibrary(JSON.stringify(library), false));
const catalog = getAlgCatalog();

describe('catalog index', () => {
	it('indexes every library case (2 241) from the file on disk', () => {
		let cases = 0;
		for (const category of Object.keys(library)) {
			for (const sub of library[category]) cases += sub.algorithms.length;
		}
		expect(cases).toBe(2241);
		expect(catalog.size).toBe(cases);
	});

	it('fills subset and puzzle from the library', () => {
		const aa = getCatalogCase(catalog, 'PLL', 'Aa perm');
		expect(aa).not.toBeNull();
		expect(aa!.subset).toBe('Adj corners');
		expect(aa!.puzzle).toBe('333');
		expect(getCatalogCase(catalog, '2x2 CLL', library['2x2 CLL'][0].algorithms[0].name)!.puzzle).toBe('222');
		expect(getCatalogCase(catalog, 'Pyraminx LL', library['Pyraminx LL'][0].algorithms[0].name)!.puzzle).toBe('pyram');
		expect(getCatalogCase(catalog, 'SQ1 CP', library['SQ1 CP'][0].algorithms[0].name)!.puzzle).toBe('sq1');
	});

	it('does not know made up cases or oversized keys', () => {
		expect(getCatalogCase(catalog, 'PLL', 'Zz perm')).toBeNull();
		expect(getCatalogCase(catalog, 'NOPE', 'Aa perm')).toBeNull();
		expect(getCatalogCase(catalog, 'PLL', 'x'.repeat(500))).toBeNull();
		expect(getCatalogCase(catalog, undefined as any, 'Aa perm')).toBeNull();
	});
});

describe('matchSetItems', () => {
	const ja = library.PLL[0].algorithms.find((a) => a.name === 'Ja perm')!;

	it('accepts the main algorithm and every library alternative, every category', () => {
		const items = [];
		for (const category of Object.keys(library)) {
			for (const sub of library[category]) {
				for (const entry of sub.algorithms) {
					for (const text of [entry.algorithm, ...(entry.alternatives || [])]) {
						items.push({category, case_name: entry.name, algorithm: text});
					}
				}
			}
		}
		const res = matchSetItems(catalog, items, []);
		expect(res.unknownCases).toEqual([]);
		expect(res.unknownAlgorithms).toEqual([]);
		expect(res.accepted).toHaveLength(2241 + 1666);
	});

	it('stores the library text, not the client spelling', () => {
		const sloppy = ja.alternatives![0].replace(/'/g, '’').replace(/ /g, '   ');
		const res = matchSetItems(catalog, [{category: 'PLL', case_name: 'Ja perm', algorithm: `  ${sloppy} `}], []);
		expect(res.accepted).toEqual([
			{category: 'PLL', case_name: 'Ja perm', subset: 'Adj corners', puzzle: '333', algorithm: ja.alternatives![0]},
		]);
	});

	it('accepts a pool row of the same case and stores its typed text', () => {
		const pool: PoolRow[] = [
			{category: 'PLL', case_name: 'Ja perm', algorithm: "R U R' F' R U R' U' R' F R2 U' R'", original_input: "[R U R' F'] (R U R' U') R' F R2 U' R'"},
		];
		const res = matchSetItems(catalog, [{category: 'PLL', case_name: 'Ja perm', algorithm: "(R U R' F') (R U R' U') R' F R2 U' R'"}], pool);
		expect(res.unknownAlgorithms).toEqual([]);
		expect(res.accepted[0].algorithm).toBe(pool[0].original_input);
	});

	it('matches the pool algorithm field too (expandNotation output)', () => {
		const pool: PoolRow[] = [
			{category: 'PLL', case_name: 'Ja perm', algorithm: "R U R' F' R U R' U' R' F R2 U' R'", original_input: "R U R' F' R U R' U' R' F R2 U' R' // mine"},
		];
		const res = matchSetItems(catalog, [{category: 'PLL', case_name: 'Ja perm', algorithm: "R U R' F' R U R' U' R' F R2 U' R'"}], pool);
		expect(res.accepted[0].algorithm).toBe("R U R' F' R U R' U' R' F R2 U' R'");
	});

	it('rejects a pool row that is not a move sequence', () => {
		const junk = 'visit my site example com';
		const pool: PoolRow[] = [{category: 'PLL', case_name: 'Ja perm', algorithm: junk, original_input: junk}];
		const res = matchSetItems(catalog, [{category: 'PLL', case_name: 'Ja perm', algorithm: junk}], pool);
		expect(res.accepted).toEqual([]);
		expect(res.unknownAlgorithms).toEqual([algSetCaseKey('PLL', 'Ja perm')]);
	});

	it('ignores pool rows of another case', () => {
		const alg = "R U R' F' R U R' U' R' F R2 U' R'";
		const pool: PoolRow[] = [{category: 'PLL', case_name: 'Jb perm', algorithm: alg, original_input: alg}];
		const res = matchSetItems(catalog, [{category: 'PLL', case_name: 'Ja perm', algorithm: alg}], pool);
		expect(res.unknownAlgorithms).toEqual(['PLL::Ja perm']);
	});

	it('rejects made up text and unknown cases, naming each', () => {
		const res = matchSetItems(
			catalog,
			[
				{category: 'PLL', case_name: 'Aa perm', algorithm: "R U R' U'"},
				{category: 'PLL', case_name: 'Zz perm', algorithm: "R U R' U'"},
				{category: 'PLL', case_name: 'Ab perm', algorithm: ''},
			],
			[]
		);
		expect(res.accepted).toEqual([]);
		expect(res.unknownCases).toEqual(['PLL::Zz perm']);
		expect(res.unknownAlgorithms).toEqual(['PLL::Aa perm', 'PLL::Ab perm']);
	});

	it('asks the pool only for cases the library cannot answer', () => {
		const need = casesNeedingPool(catalog, [
			{category: 'PLL', case_name: 'Aa perm', algorithm: library.PLL[0].algorithms[0].algorithm},
			{category: 'OLL', case_name: 'OLL 21', algorithm: "R2 D R2 D' R2 B2"},
			{category: 'PLL', case_name: 'Zz perm', algorithm: 'R'},
		]);
		expect(need.caseNames).toEqual(['OLL 21']);
		expect(need.categories).toEqual(['OLL']);
	});
});

describe('buildAlgCatalog', () => {
	it('keeps the main algorithm first and drops duplicate spellings', () => {
		const c = buildAlgCatalog({PLL: [{subset: 'S', algorithms: [{name: 'X', algorithm: "R U R'", alternatives: ["R  U  R’", "L"]}]}]});
		const x = c.get('PLL::X')!;
		expect(Array.from(x.algorithms.values())).toEqual(["R U R'", 'L']);
	});
});
