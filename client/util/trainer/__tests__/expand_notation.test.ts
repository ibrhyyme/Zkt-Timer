/**
 * expandNotation keeps wide moves, layer prefixes and turn counts (trainer-sets B-1), and every
 * other text comes out exactly as before, because algToId() keys the trainer stats by it.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {expandNotation} from '../algorithm_engine';
import {legacyExpandNotation} from '../migrate_alg_ids';

type Library = Record<string, Array<{subset: string; algorithms: Array<{name: string; algorithm: string; alternatives?: string[]}>}>>;

const library: Library = JSON.parse(
	readFileSync(join(__dirname, '../../../../public/trainer/default-algs.json'), 'utf8')
);

interface LibraryText {
	category: string;
	name: string;
	kind: 'main' | 'alt';
	text: string;
}

const texts: LibraryText[] = [];
for (const [category, subsets] of Object.entries(library)) {
	for (const subset of subsets) {
		for (const entry of subset.algorithms) {
			texts.push({category, name: entry.name, kind: 'main', text: entry.algorithm});
			for (const alt of entry.alternatives || []) texts.push({category, name: entry.name, kind: 'alt', text: alt});
		}
	}
}

// Measured on default-algs.json: the texts the old expansion broke.
const CHANGED_MAIN = [
	'ZBLS::ZBLS 8',
	...[
		'OPP Parity', 'Adj Parity', 'CwO', 'CcwO', 'W', 'Pj', 'Ba', 'Bb', 'Ca', 'Cb', 'Da', 'Db', 'Ka', 'Kb',
		'M', 'Pa', 'Pb', 'Diag C', 'Q', 'Sa', 'Sb', 'X',
	].map((name) => `4x4 PLL Parity::${name}`),
];
const CHANGED_ALT = [
	"PLL::Ub perm::R2' U R U R' U' R3 U' R' U R'",
	"2-Look PLL::Ub perm::R2' U R U R' U' R3 U' R' U R'",
	"ZBLS::ZBLS 27::U Rw' R2 U' R' U Rw U' R'",
];

describe('expandNotation on the library', () => {
	const changed = texts.filter((t) => expandNotation(t.text) !== legacyExpandNotation(t.text));
	const unchanged = texts.filter((t) => expandNotation(t.text) === legacyExpandNotation(t.text));

	it('changes exactly the 23 main algorithms and 3 alternatives the old expansion broke', () => {
		const main = changed.filter((t) => t.kind === 'main').map((t) => `${t.category}::${t.name}`);
		const alt = changed.filter((t) => t.kind === 'alt').map((t) => `${t.category}::${t.name}::${t.text}`);
		expect(main.sort()).toEqual([...CHANGED_MAIN].sort());
		expect(alt.sort()).toEqual([...CHANGED_ALT].sort());
	});

	it('keeps every other library text exactly as before (2 218 main algorithms)', () => {
		expect(texts.filter((t) => t.kind === 'main')).toHaveLength(2241);
		expect(unchanged.filter((t) => t.kind === 'main')).toHaveLength(2218);
		expect(unchanged.filter((t) => t.kind === 'alt')).toHaveLength(1663);
	});

	it('writes each changed library text as it is written in the library', () => {
		for (const t of changed) expect(expandNotation(t.text)).toBe(t.text);
	});

	it('is idempotent on the whole library', () => {
		for (const t of texts) {
			const once = expandNotation(t.text);
			expect(expandNotation(once)).toBe(once);
		}
	});
});

describe('expandNotation moves', () => {
	it.each([
		["Rw U Rw' U' R U' M' U Rw'", "Rw U Rw' U' R U' M' U Rw'"],
		['2R2 U2 2R2 Uw2 2R2 Uw2', '2R2 U2 2R2 Uw2 2R2 Uw2'],
		["U' 3Rw U' L D2", "U' 3Rw U' L D2"],
		["3Lw' U R'", "3Lw' U R'"],
		["2-3Rw U 2-3Rw'", "2-3Rw U 2-3Rw'"],
		["Uw2' R2", "Uw2' R2"],
		["F' 2R2 U2", "F' 2R2 U2"],
		['(2R2 U2) 2L2', '(2R2 U2) 2L2'],
		["R2' U R U R' U' R3 U' R' U R'", "R2' U R U R' U' R3 U' R' U R'"],
		["(R U R' U')3", "(R U R' U')3"],
		["R'3", "R3'"],
		["RwURw'", "Rw U Rw'"],
	])('keeps %s', (input, expected) => {
		expect(expandNotation(input)).toBe(expected);
	});

	it.each([
		["RUR'U'", "R U R' U'"],
		["R'2 U", "R2' U"],
		['[R U] x2y', '(R U) x2 y'],
		["(R U R' U')2 x", "(R U R' U')2 x"],
		['  R   U  ', 'R U'],
		["R` U´ R\"", "R' U' R'"],
		['XYZ', 'x y z'],
		['', ''],
	])('spaces and cleans %s like before', (input, expected) => {
		expect(expandNotation(input)).toBe(expected);
		expect(legacyExpandNotation(input)).toBe(expected);
	});

	it('only reads a layer prefix at the start of a move', () => {
		// "U22R2" has no space to tell "U2 2R2" from "U22 R2"; it keeps the old reading.
		expect(expandNotation('U22R2')).toBe(legacyExpandNotation('U22R2'));
		expect(expandNotation('U2 2R2')).toBe('U2 2R2');
	});

	it('leaves Square-1 notation alone', () => {
		expect(expandNotation('(1,0) / (-1,-1)  /')).toBe('(1,0) / (-1,-1) /');
	});

	it('drops private use characters from the input instead of reading them as moves', () => {
		expect(expandNotation('R  U')).toBe('R U');
	});
});

describe('pattern and setup data for the changed texts', () => {
	const readJson = (name: string) =>
		JSON.parse(readFileSync(join(__dirname, '../../../../public/trainer', name), 'utf8'));
	const llPatterns: Record<string, string> = readJson('ll-patterns.json');
	const puzzlePatterns: Record<string, Record<string, unknown>> = readJson('puzzle-patterns.json');
	const changed = texts.filter((t) => expandNotation(t.text) !== legacyExpandNotation(t.text));

	it('has every 2D pattern the old key had under the new key too', () => {
		for (const t of changed) {
			const before = legacyExpandNotation(t.text);
			const after = expandNotation(t.text);
			if (llPatterns[before] !== undefined) expect(llPatterns[after]).toBeDefined();
			for (const byKey of Object.values(puzzlePatterns)) {
				if (byKey[`${t.category}::${before}`] !== undefined) {
					expect(byKey[`${t.category}::${after}`]).toBeDefined();
				}
			}
		}
		// 3 LL texts and the 22 4x4 parity cases
		expect(changed.filter((t) => llPatterns[expandNotation(t.text)] !== undefined)).toHaveLength(4);
		expect(Object.keys(puzzlePatterns['4x4']).filter((k) => k.startsWith('4x4 PLL Parity::'))).toHaveLength(44);
	});

	it('gives the 4x4 parity cases a setup without the broken "22" turns', () => {
		for (const subset of library['4x4 PLL Parity']) {
			for (const entry of subset.algorithms as Array<{name: string; setup?: string}>) {
				expect(entry.setup).toBeTruthy();
				expect(entry.setup).not.toMatch(/22|(^| )2( |$)/);
			}
		}
	});
});
