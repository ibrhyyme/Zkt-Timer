import {isBuiltinPuzzleKey} from '../cube_puzzle';
import {
	ALG_SET_CODE_ALPHABET,
	ALG_SET_CODE_LENGTH,
	ALG_SET_LIMITS,
	ALG_SET_VISIBILITIES,
	CUBE_TYPE_ORDER,
	algSetCaseKey,
	algSetTextLength,
	canonAlg,
	categoryPuzzle,
	checkAlgSetDescription,
	checkAlgSetName,
	cleanAlgSetDescription,
	cleanAlgSetName,
	commaListNeedle,
	cubeTypeOfCategory,
	isAlgSetCode,
	isAlgSetVisibility,
	isMoveSequence,
	isSharedVisibility,
	packCommaList,
	parseAlgSetCaseKey,
	unpackCommaList,
} from '../trainer/alg_sets';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library: Record<string, Array<{subset: string; algorithms: Array<{name: string; algorithm: string; alternatives?: string[]}>}>> = require('../../public/trainer/default-algs.json');

// What getCubeType in AlgorithmSelector.tsx returned for every library category before the
// rule moved here. A new category must be added on purpose.
const EXPECTED_CUBE_TYPE: Record<string, string> = {
	PLL: '3x3',
	OLL: '3x3',
	F2L: '3x3',
	'2-Look PLL': '3x3',
	'2-Look OLL': '3x3',
	COLL: '3x3',
	OLLCP: '3x3',
	ZBLL: '3x3',
	ZBLS: '3x3',
	WVLS: '3x3',
	VHLS: '3x3',
	CMLL: '3x3 Roux',
	'2-Look CMLL': '3x3 Roux',
	'OH-CMLL': '3x3 Roux',
	'L6E-EO': '3x3 Roux',
	'L6E-EOLR': '3x3 Roux',
	'2x2 CLL': '2x2',
	'2x2 EG1': '2x2',
	'2x2 EG2': '2x2',
	'2x2 PBL': '2x2',
	'4x4 PLL Parity': '4x4',
	'Pyraminx LL': 'Pyraminx',
	'Pyraminx L4E': 'Pyraminx',
	'Sarah Intermediate': 'Skewb',
	'Sarah Advanced': 'Skewb',
	'SQ1 Cube Shape': 'Square-1',
	'SQ1 CP': 'Square-1',
	'SQ1 CSP': 'Square-1',
	'SQ1 EO': 'Square-1',
	'SQ1 EP': 'Square-1',
	'SQ1 OBL': 'Square-1',
};

const EXPECTED_PUZZLE: Record<string, string> = {
	'3x3': '333',
	'3x3 Roux': '333',
	'2x2': '222',
	'4x4': '444',
	Pyraminx: 'pyram',
	Skewb: 'skewb',
	'Square-1': 'sq1',
};

function libraryAlgorithms(): Array<{category: string; text: string}> {
	const out: Array<{category: string; text: string}> = [];
	for (const [category, groups] of Object.entries(library)) {
		for (const group of groups) {
			for (const alg of group.algorithms) {
				out.push({category, text: alg.algorithm});
				for (const alt of alg.alternatives || []) out.push({category, text: alt});
			}
		}
	}
	return out;
}

describe('cubeTypeOfCategory and categoryPuzzle', () => {
	it('covers all 31 library categories with the old selector rule', () => {
		const categories = Object.keys(library);
		expect(categories).toHaveLength(31);
		for (const category of categories) {
			expect({category, cubeType: cubeTypeOfCategory(category)}).toEqual({
				category,
				cubeType: EXPECTED_CUBE_TYPE[category],
			});
		}
	});

	it('maps every category to a built-in puzzle key', () => {
		for (const category of Object.keys(library)) {
			const puzzle = categoryPuzzle(category);
			expect(puzzle).toBe(EXPECTED_PUZZLE[EXPECTED_CUBE_TYPE[category]]);
			expect(isBuiltinPuzzleKey(puzzle)).toBe(true);
		}
	});

	it('treats an unknown category as 3x3, like the selector did', () => {
		expect(cubeTypeOfCategory('Something New')).toBe('3x3');
		expect(categoryPuzzle('Something New')).toBe('333');
	});

	it('lists every cube type a category can produce, in display order', () => {
		const produced = new Set(Object.keys(library).map(cubeTypeOfCategory));
		expect(CUBE_TYPE_ORDER.filter((ct) => produced.has(ct))).toEqual([...CUBE_TYPE_ORDER]);
	});
});

describe('canonAlg', () => {
	it('turns quote lookalikes into an apostrophe', () => {
		expect(canonAlg('R U’ R‘ F´ D` B′')).toBe("R U' R' F' D' B'");
	});

	it('turns square brackets into parentheses', () => {
		expect(canonAlg("[R U R' U'] y")).toBe("(R U R' U') y");
	});

	it('collapses whitespace and trims', () => {
		expect(canonAlg("  R   U\tR'\n U'  ")).toBe("R U R' U'");
	});

	it('folds full width characters to ASCII', () => {
		expect(canonAlg('Ｒ Ｕ２')).toBe('R U2');
	});

	it('keeps wide moves, layer prefixes and suffixes as written', () => {
		expect(canonAlg("Rw U Rw'")).toBe("Rw U Rw'");
		expect(canonAlg('2R2 U2 2R2 Uw2')).toBe('2R2 U2 2R2 Uw2');
		expect(canonAlg("3Rw' r u2")).toBe("3Rw' r u2");
		expect(canonAlg("U2'")).toBe("U2'");
		expect(canonAlg("U2'")).not.toBe(canonAlg('U2'));
	});

	it('leaves a Square-1 sequence intact', () => {
		expect(canonAlg('/ -3,0 / 3,3 / 0,-3 /')).toBe('/ -3,0 / 3,3 / 0,-3 /');
		expect(canonAlg('/ (0,3) / (-3,-3) /')).toBe('/ (0,3) / (-3,-3) /');
	});

	it('returns an empty string for empty input', () => {
		expect(canonAlg('')).toBe('');
		expect(canonAlg(null)).toBe('');
		expect(canonAlg(undefined)).toBe('');
		expect(canonAlg('   ')).toBe('');
	});

	it('is idempotent on the whole library', () => {
		for (const {text} of libraryAlgorithms()) {
			expect(canonAlg(canonAlg(text))).toBe(canonAlg(text));
		}
	});
});

describe('isMoveSequence', () => {
	it('accepts every library algorithm and alternative for its puzzle', () => {
		const all = libraryAlgorithms();
		// 2 241 main algorithms and 1 666 alternatives, measured in the design.
		expect(all).toHaveLength(2241 + 1666);
		const rejected = all.filter(({category, text}) => !isMoveSequence(text, categoryPuzzle(category)));
		expect(rejected).toEqual([]);
	});

	it('accepts the common ways people write 3x3 algorithms', () => {
		for (const alg of [
			"R U R' U'",
			"(R U R' U')2",
			"[R U R' U'] x2",
			"r U R' U' M2'",
			"Rw U2 Rw'",
			"R2' U R3",
			"R'2 U",
			"x' y2 z",
			"S E M'",
			'R U’ R’',
		]) {
			expect({alg, ok: isMoveSequence(alg, '333')}).toEqual({alg, ok: true});
		}
	});

	it('accepts 4x4 layer prefixes', () => {
		expect(isMoveSequence("2R2 U2 2R2 Uw2 3Rw' 2-3Rw", '444')).toBe(true);
	});

	it('accepts Square-1 with and without parentheses', () => {
		expect(isMoveSequence('/ -3,0 / 3,3 / 0,-3 /', 'sq1')).toBe(true);
		expect(isMoveSequence('/(0,3)/(-3,-3)/', 'sq1')).toBe(true);
		expect(isMoveSequence('(1,0) / (-1,-1)', 'sq1')).toBe(true);
	});

	it('refuses text that is not a move sequence', () => {
		for (const text of [
			'',
			'   ',
			'hello world',
			'R U R\' U\' <script>',
			'R U, R',
			'R U R\' https://example.com',
			'()',
			'R ()',
			'(R U',
			'R U)',
			"R U R' U'.",
			'R4x',
			'Q U',
		]) {
			expect({text, ok: isMoveSequence(text, '333')}).toEqual({text, ok: false});
		}
	});

	it('refuses move words of another puzzle', () => {
		expect(isMoveSequence('2R2 U2', '333')).toBe(false);
		expect(isMoveSequence("M U M'", '222')).toBe(false);
		expect(isMoveSequence("R U F'", 'pyram')).toBe(false);
		expect(isMoveSequence("R U R'", 'sq1')).toBe(false);
		expect(isMoveSequence('/ 3,0 /', '333')).toBe(false);
		expect(isMoveSequence("R U R'", 'clock')).toBe(false);
	});

	it('refuses Square-1 garbage', () => {
		expect(isMoveSequence('', 'sq1')).toBe(false);
		expect(isMoveSequence('/ 3,0 / hello', 'sq1')).toBe(false);
		expect(isMoveSequence('/ (3,0 /', 'sq1')).toBe(false);
		expect(isMoveSequence('/ 30 /', 'sq1')).toBe(false);
	});

	it('refuses text longer than the limit', () => {
		const long = Array(ALG_SET_LIMITS.ALGORITHM_MAX_LENGTH).fill('R').join(' ');
		expect(long.length).toBeGreaterThan(ALG_SET_LIMITS.ALGORITHM_MAX_LENGTH);
		expect(isMoveSequence(long, '333')).toBe(false);
		expect(isMoveSequence('R U'.padEnd(ALG_SET_LIMITS.ALGORITHM_MAX_LENGTH, ' ') + 'R', '333')).toBe(true);
	});
});

describe('visibility, code, case key and comma lists', () => {
	it('knows the three visibilities', () => {
		expect([...ALG_SET_VISIBILITIES]).toEqual(['private', 'link', 'public']);
		expect(isAlgSetVisibility('link')).toBe(true);
		expect(isAlgSetVisibility('friends')).toBe(false);
		expect(isAlgSetVisibility(null)).toBe(false);
		expect(isSharedVisibility('private')).toBe(false);
		expect(isSharedVisibility('link')).toBe(true);
		expect(isSharedVisibility('public')).toBe(true);
	});

	it('validates the share code shape', () => {
		expect(ALG_SET_CODE_ALPHABET).toHaveLength(62);
		expect(isAlgSetCode('aB3dE5gH9k')).toBe(true);
		expect(isAlgSetCode('aB3dE5gH9')).toBe(false);
		expect(isAlgSetCode('aB3dE5gH9k1')).toBe(false);
		expect(isAlgSetCode('aB3dE5gH9-')).toBe(false);
		expect(isAlgSetCode('x'.repeat(ALG_SET_CODE_LENGTH))).toBe(true);
		expect(isAlgSetCode(undefined)).toBe(false);
	});

	it('round trips the case key', () => {
		const key = algSetCaseKey('PLL', 'Aa perm');
		expect(key).toBe('PLL::Aa perm');
		expect(parseAlgSetCaseKey(key)).toEqual({category: 'PLL', caseName: 'Aa perm'});
		expect(parseAlgSetCaseKey('F2L::F2L 1 - Front Right')).toEqual({category: 'F2L', caseName: 'F2L 1 - Front Right'});
		expect(parseAlgSetCaseKey('PLL')).toBeNull();
		expect(parseAlgSetCaseKey('::Aa perm')).toBeNull();
		expect(parseAlgSetCaseKey('PLL::')).toBeNull();
	});

	it('keeps case names unique inside each library category', () => {
		for (const [category, groups] of Object.entries(library)) {
			const names = groups.flatMap((g) => g.algorithms.map((a) => a.name));
			expect({category, dupes: names.length - new Set(names).size}).toEqual({category, dupes: 0});
			for (const name of names) expect(name.includes('::')).toBe(false);
		}
	});

	it('packs comma lists sorted, distinct and wrapped', () => {
		expect(packCommaList(['PLL', 'OLL', 'PLL'])).toBe(',OLL,PLL,');
		expect(packCommaList([])).toBe('');
		expect(unpackCommaList(',OLL,PLL,')).toEqual(['OLL', 'PLL']);
		expect(unpackCommaList('')).toEqual([]);
		expect(unpackCommaList(null)).toEqual([]);
		expect(packCommaList(['333', '222']).includes(commaListNeedle('333'))).toBe(true);
		expect(packCommaList(['2-Look OLL']).includes(commaListNeedle('OLL'))).toBe(false);
	});
});

describe('set name and description', () => {
	it('cleans a name to one line without invisible characters', () => {
		expect(cleanAlgSetName('  Öğrenme\nsırası ​  PLL\t ')).toBe('Öğrenme sırası PLL');
		expect(cleanAlgSetName('‮evil‬')).toBe('evil');
		expect(cleanAlgSetName(null)).toBe('');
	});

	it('cleans a description and keeps line breaks', () => {
		expect(cleanAlgSetDescription('\n\nBirinci  satır\r\n\n\n\nİkinci\u0007 satır\n\n')).toBe('Birinci satır\n\nİkinci satır');
	});

	it('checks the name limits in code points', () => {
		expect(checkAlgSetName('')).toBe('NAME_EMPTY');
		expect(checkAlgSetName('a'.repeat(ALG_SET_LIMITS.NAME_MAX_LENGTH))).toBeNull();
		expect(checkAlgSetName('a'.repeat(ALG_SET_LIMITS.NAME_MAX_LENGTH + 1))).toBe('NAME_TOO_LONG');
		const emoji = '\u{1F9E9}'.repeat(ALG_SET_LIMITS.NAME_MAX_LENGTH);
		expect(algSetTextLength(emoji)).toBe(ALG_SET_LIMITS.NAME_MAX_LENGTH);
		expect(checkAlgSetName(emoji)).toBeNull();
	});

	it('checks the description limits', () => {
		expect(checkAlgSetDescription('')).toBeNull();
		expect(checkAlgSetDescription('a'.repeat(ALG_SET_LIMITS.DESCRIPTION_MAX_LENGTH + 1))).toBe('DESCRIPTION_TOO_LONG');
		expect(checkAlgSetDescription(Array(ALG_SET_LIMITS.DESCRIPTION_MAX_LINES).fill('x').join('\n'))).toBeNull();
		expect(checkAlgSetDescription(Array(ALG_SET_LIMITS.DESCRIPTION_MAX_LINES + 1).fill('x').join('\n'))).toBe(
			'DESCRIPTION_TOO_MANY_LINES'
		);
	});
});
