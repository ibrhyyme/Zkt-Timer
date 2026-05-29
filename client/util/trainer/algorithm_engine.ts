import {faceletsToPattern} from './pattern_utils';

// Lazy-loaded cubing modules (ESM-only, cannot be statically imported in SSR)
let _Alg: any;
let _experimentalCountMovesETM: any;
let _cube3x3x3: any;

/**
 * Lazily load cubing modules. Must be called before using countMovesETM,
 * isSymmetricOLL, or simplifyAlg.
 */
export async function ensureCubingReady(): Promise<void> {
	if (_Alg) return;
	const [algMod, notMod, puzMod] = await Promise.all([
		import('cubing/alg'),
		import('cubing/notation'),
		import('cubing/puzzles'),
	]);
	_Alg = algMod.Alg;
	_experimentalCountMovesETM = notMod.experimentalCountMovesETM;
	_cube3x3x3 = puzMod.cube3x3x3;
}

const SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * Normalize and expand cube algorithm notation.
 * Cleans up various quote characters, brackets, spacing, and ensures consistent format.
 */
export function expandNotation(input: string): string {
	// SQ1 notation uses different format (/ -3,0 / 3,3 /) — cube cleanup breaks it
	if (input.includes('/')) {
		return input.replace(/\s+/g, ' ').trim();
	}

	let output = input
		.replace(/["´`']/g, "'")
		.replace(/\[/g, '(')
		.replace(/\]/g, ')')
		.replace(/XYZ/g, 'xyz');

	// Remove characters not allowed
	output = output.replace(/[^RLFBUDMESrlfbudxyz2()']/g, '');

	// Spacing rules
	output = output.replace(/\(/g, ' (');
	output = output.replace(/\)(?!\s)/g, ') ');
	output = output.replace(/'(?![\s)])/g, "' ");
	output = output.replace(/2(?![\s')])/g, '2 ');
	output = output.replace(/([RLFBUDMESrlfbudxyz])(?![\s)'2])/g, '$1 ');

	// No space before 2
	output = output.replace(/(\s)(?=2)/g, '');

	// R'2 must be R2' instead
	output = output.replace(/'2/g, "2'");

	// No multiple spaces
	output = output.replace(/\s+/g, ' ');

	return output.trim();
}

/**
 * Convert an algorithm string to a URL-safe/DOM-safe ID.
 */
export function algToId(alg: string): string {
	let id = alg
		?.trim()
		.replace(/\s+/g, '-')
		.replace(/[']/g, 'p')
		.replace(/[(]/g, 'o')
		.replace(/[)]/g, 'c');
	if (id == null || id.length === 0) {
		id = 'default-alg-id';
	}
	return id;
}

/**
 * Get the inverse of a cube move notation.
 */
export function getInverseMove(move: string): string {
	const inverseMoves: {[key: string]: string} = {
		U: "U'",
		"U'": 'U',
		D: "D'",
		"D'": 'D',
		L: "L'",
		"L'": 'L',
		R: "R'",
		"R'": 'R',
		F: "F'",
		"F'": 'F',
		B: "B'",
		"B'": 'B',
		u: "u'",
		"u'": 'u',
		d: "d'",
		"d'": 'd',
		l: "l'",
		"l'": 'l',
		r: "r'",
		"r'": 'r',
		f: "f'",
		"f'": 'f',
		b: "b'",
		"b'": 'b',
		M: "M'",
		"M'": 'M',
		E: "E'",
		"E'": 'E',
		S: "S'",
		"S'": 'S',
		x: "x'",
		"x'": 'x',
		y: "y'",
		"y'": 'y',
		z: "z'",
		"z'": 'z',
		// 180° moves are their own inverse
		U2: 'U2',
		D2: 'D2',
		R2: 'R2',
		L2: 'L2',
		F2: 'F2',
		B2: 'B2',
		u2: 'u2',
		d2: 'd2',
		r2: 'r2',
		l2: 'l2',
		f2: 'f2',
		b2: 'b2',
		M2: 'M2',
		E2: 'E2',
		S2: 'S2',
		x2: 'x2',
		y2: 'y2',
		z2: 'z2',
	};
	return inverseMoves[move] || move;
}

/**
 * Get the opposite face move (U<->D, R<->L, F<->B).
 */
export function getOppositeMove(move: string): string {
	const oppositeMoves: {[key: string]: string} = {
		U: 'D',
		D: 'U',
		"U'": "D'",
		"D'": "U'",
		L: 'R',
		R: 'L',
		"L'": "R'",
		"R'": "L'",
		F: 'B',
		B: 'F',
		"F'": "B'",
		"B'": "F'",
	};
	return oppositeMoves[move] || move;
}

/**
 * Count moves in Execution Turn Metric.
 */
export function countMovesETM(alg: string): number {
	if (!_Alg) return 0;
	try {
		return _experimentalCountMovesETM(_Alg.fromString(alg));
	} catch {
		return 0;
	}
}

/**
 * Check if an OLL algorithm is symmetric (i.e., adding a U move before it gives the same result).
 * Used to determine whether random AUF should be applied.
 */
export function isSymmetricOLL(alg: string): boolean {
	if (!_Alg) return false;
	const pattern = faceletsToPattern(SOLVED_STATE);
	if (!pattern) return false;

	const algs = [
		_Alg.fromString('U ' + alg),
		_Alg.fromString("U' " + alg),
		_Alg.fromString('U2 ' + alg),
	];

	const scramble = pattern.applyAlg(_Alg.fromString(alg).invert());

	for (const item of algs) {
		const result = scramble.applyAlg(item);
		const edgesOriented = arraysEqual(result.patternData.EDGES.orientation, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
		const cornersOriented = arraysEqual(result.patternData.CORNERS.orientation, [0, 0, 0, 0, 0, 0, 0, 0]);
		const centersOriented = arraysEqual(result.patternData.CENTERS.orientation, [0, 0, 0, 0, 0, 0]);
		if (edgesOriented && cornersOriented && centersOriented) {
			return true;
		}
	}
	return false;
}

function arraysEqual(arr1: number[], arr2: number[]): boolean {
	if (arr1.length !== arr2.length) return false;
	for (let i = 0; i < arr1.length; i++) {
		if (arr1[i] !== arr2[i]) return false;
	}
	return true;
}

/**
 * Determine the appropriate stickering mode for a given category.
 */
export function getStickering(category: string): string {
	// Categories without direct match in cubing.js aliased here
	const STICKERING_ALIASES: Record<string, string> = {
		'vhls': 'VLS',
	};

	const validStickering = [
		'OLLCP', 'EOcross', 'LSOCLL', 'EOline', 'LSOLL', 'Daisy', 'Cross', 'ZBLL',
		'WVLS', 'OCLL', 'L6EO', 'L10P', 'EPLL', 'EOLL', 'CPLL', 'COLL', 'CMLL',
		'VLS', 'PLL', 'OLL', 'L6E', 'F2L', 'ELS', 'ELL', 'CLS', 'CLL', 'LS', 'LL', 'EO',
	];

	const categoryClean = category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

	// Alias check
	if (STICKERING_ALIASES[categoryClean]) return STICKERING_ALIASES[categoryClean];

	// Direct match
	for (const item of validStickering) {
		if (categoryClean === item.toLowerCase()) {
			return item;
		}
	}

	// Word match
	const categoryWords = category.toLowerCase().split(/[^a-zA-Z0-9]+/);
	for (const item of validStickering) {
		for (const word of categoryWords) {
			if (word === item.toLowerCase()) {
				return item;
			}
		}
	}

	return 'full';
}

/**
 * Determine the cubing.js puzzle identifier for a given category.
 */
const CATEGORY_PUZZLE_TYPE: Record<string, string> = {
	'Sarah Intermediate': 'skewb',
	'Sarah Advanced': 'skewb',
};

export function getPuzzleType(category: string): string {
	if (CATEGORY_PUZZLE_TYPE[category]) return CATEGORY_PUZZLE_TYPE[category];
	if (category.startsWith('2x2')) return '2x2x2';
	if (category.startsWith('4x4')) return '4x4x4';
	if (category.startsWith('Pyraminx')) return 'pyraminx';
	if (category.startsWith('SQ1')) return 'square1';
	return '3x3x3';
}

const CUBE_SHAPE_PUZZLES = new Set(['3x3x3', '2x2x2', '4x4x4', 'skewb']);

/**
 * Cube-shaped puzzles support x,y,z rotations (orientation change).
 * Pyraminx (tetrahedron) and Square-1 (bandaged) do not.
 */
export function isCubeShapePuzzle(category: string): boolean {
	return CUBE_SHAPE_PUZZLES.has(getPuzzleType(category));
}

import type {CubeFace} from '../../components/trainer/types';

const OPPOSITE_FACE: Record<CubeFace, CubeFace> = {
	U: 'D', D: 'U', F: 'B', B: 'F', R: 'L', L: 'R',
};

const ROTATION_TABLE: Record<string, string> = {
	'U,F': '',     'U,R': 'y',     'U,B': 'y2',    'U,L': "y'",
	'D,B': 'x2',   'D,R': 'x2 y',  'D,F': 'x2 y2', 'D,L': "x2 y'",
	'F,D': 'x',    'F,R': 'x y',   'F,U': 'x y2',  'F,L': "x y'",
	'B,U': "x'",   'B,R': "x' y",  'B,D': "x' y2", 'B,L': "x' y'",
	'R,F': "z'",   'R,D': "z' y",  'R,B': "z' y2", 'R,U': "z' y'",
	'L,F': 'z',    'L,U': 'z y',   'L,B': 'z y2',  'L,D': "z y'",
};

/**
 * Returns the rotation string to orient the cube with the given top and front faces.
 * Standard orientation (U,F) returns empty string.
 */
export function getOrientationRotation(topFace: CubeFace, frontFace: CubeFace): string {
	return ROTATION_TABLE[`${topFace},${frontFace}`] || '';
}

const ALL_FACES: CubeFace[] = ['U', 'D', 'F', 'B', 'R', 'L'];

/**
 * Returns valid front face options for a given top face
 * (all faces except the top face and its opposite).
 */
export function getAdjacentFaces(topFace: CubeFace): CubeFace[] {
	const opposite = OPPOSITE_FACE[topFace];
	return ALL_FACES.filter((f) => f !== topFace && f !== opposite);
}

/**
 * Default front face for a given top face.
 */
const DEFAULT_FRONT: Record<CubeFace, CubeFace> = {
	U: 'F', D: 'B', F: 'D', B: 'U', R: 'F', L: 'F',
};

export function getDefaultFrontFace(topFace: CubeFace): CubeFace {
	return DEFAULT_FRONT[topFace];
}

/**
 * Returns the effective top/front face orientation. If `whiteOnBottom` is active,
 * uses D/F preset instead of user selection (orientation used by ~80% of cubers).
 */
export function getEffectiveOrientation(opts: {
	topFace: CubeFace;
	frontFace: CubeFace;
	whiteOnBottom?: boolean;
}): {topFace: CubeFace; frontFace: CubeFace} {
	if (opts.whiteOnBottom) return {topFace: 'D', frontFace: 'F'};
	return {topFace: opts.topFace, frontFace: opts.frontFace};
}

/**
 * Check if a category is a Last Layer category (OLL, PLL, COLL, OLLCP, ZBLL, etc.)
 * LL categories don't need front face selection — only top face matters.
 */
export function isLLCategory(category: string): boolean {
	if (!category) return false;
	const puzzleType = getPuzzleType(category);
	if (puzzleType !== '3x3x3') return false;
	const stickering = getStickering(category);
	if (category.toLowerCase().includes('ll')) return true;
	if (stickering === 'OLL') return true;
	if (stickering === 'WVLS' || stickering === 'VLS') return true;
	return false;
}

/**
 * Categories using isometric 3-face 2D view.
 * Currently unused — LL pattern switched to WVLS/VHLS.
 */
export function isIsometricCategory(_category: string): boolean {
	return false;
}

/**
 * Categories using 2D pattern rendering.
 * 3x3 LL uses separate LLPatternView; these come from puzzle_patterns.json.
 */
export function is2DPatternCategory(category: string): boolean {
	if (!category) return false;
	const puzzleType = getPuzzleType(category);
	if (puzzleType === '2x2x2') {
		// PBL stays 3D, other 2x2 subsets are 2D
		return !category.includes('PBL');
	}
	return ['4x4x4', 'pyraminx', 'skewb', 'square1'].includes(puzzleType);
}

/**
 * Categories where only top face can be selected (front face selector hidden).
 * 3x3 LL + 2x2 non-PBL + 4x4
 */
export function isTopFaceOnlyCategory(category: string): boolean {
	if (isLLCategory(category)) return true;
	if (isIsometricCategory(category)) return true;
	const puzzleType = getPuzzleType(category);
	if (puzzleType === '2x2x2' && !category.includes('PBL')) return true;
	if (puzzleType === '4x4x4') return true;
	if (puzzleType === 'skewb') return true;
	return false;
}

/**
 * Returns the puzzle pattern type (puzzle-patterns.json key).
 * null → 2D puzzle pattern is not used.
 */
export function getPuzzlePatternType(category: string): '2x2' | '4x4' | 'pyraminx' | 'skewb' | 'sq1' | null {
	if (!is2DPatternCategory(category)) return null;
	const puzzleType = getPuzzleType(category);
	switch (puzzleType) {
		case '2x2x2': return '2x2';
		case '4x4x4': return '4x4';
		case 'pyraminx': return 'pyraminx';
		case 'skewb': return 'skewb';
		case 'square1': return 'sq1';
		default: return null;
	}
}

/**
 * Whether SQ1 categories need bottom face mirroring.
 */
export function isSQ1MirrorCategory(category: string): boolean {
	return category === 'SQ1 Cube Shape' || category === 'SQ1 CSP';
}

/**
 * Invert a rotation string (reverse order + invert each move).
 */
export function invertRotation(rotation: string): string {
	if (!rotation) return '';
	return rotation.split(' ')
		.reverse()
		.map(move => {
			if (move.endsWith("'")) return move.slice(0, -1);
			if (move.endsWith('2')) return move;
			return move + "'";
		})
		.join(' ');
}

/**
 * Simplify an algorithm by cancelling redundant moves.
 */
export function simplifyAlg(alg: string): string {
	if (!_Alg) return alg;
	try {
		return _Alg.fromString(alg)
			.experimentalSimplify({cancel: true, puzzleLoader: _cube3x3x3})
			.toString();
	} catch {
		return alg;
	}
}

/**
 * Build algorithm move array with optional random AUF (Adjustment of U Face).
 * Port of cubedex drawAlgInCube() random AUF logic (lines 186-233).
 *
 * @param algMoves Original algorithm moves
 * @param category Algorithm category (e.g. "PLL", "OLL", "ZBLL")
 * @param randomizeAUF Whether to apply random AUF
 * @returns Modified move array with AUF applied
 */
export function buildRandomAUFAlg(
	algMoves: string[],
	category: string,
	randomizeAUF: boolean
): string[] {
	if (!randomizeAUF || !_Alg) return [...algMoves];

	const AUF = ['U', "U'", 'U2', ''];
	const randomAUF = AUF[Math.floor(Math.random() * AUF.length)];
	if (randomAUF.length === 0) return [...algMoves];

	let result = [...algMoves];
	const kpattern = faceletsToPattern(SOLVED_STATE);
	if (!kpattern) return result;

	const algStr = result.join(' ');
	const resultWithStartU = kpattern.applyAlg(_Alg.fromString('U ' + algStr));
	const resultWithEndU = kpattern.applyAlg(_Alg.fromString(algStr + " U'"));
	const resultWithStartU2 = kpattern.applyAlg(_Alg.fromString('U2 ' + algStr));
	const resultWithEndU2 = kpattern.applyAlg(_Alg.fromString(algStr + " U2'"));

	const catLower = category.toLowerCase();
	const isOLL = catLower.includes('oll');
	const areNotIdentical =
		!resultWithStartU.isIdentical(resultWithEndU) && !resultWithStartU2.isIdentical(resultWithEndU2);

	// Post AUF for PLL and ZBLL
	if (catLower.includes('pll') || catLower.includes('zbll')) {
		const randomPostAUF = AUF[Math.floor(Math.random() * AUF.length)];
		if (randomPostAUF.length > 0) {
			result.push(randomPostAUF);
		}
	}

	if ((areNotIdentical && !isOLL) || (isOLL && !isSymmetricOLL(result.join(' ')))) {
		result.unshift(randomAUF);
		// Simplify to cancel possible adjacent U moves
		result = simplifyAlg(result.join(' ')).split(/\s+/);
	}

	return result;
}

/**
 * Format a timestamp (in ms) to a display string M:SS.mmm
 */
export function formatTime(ms: number): string {
	if (ms <= 0) return '0:00.000';
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const milliseconds = Math.floor(ms % 1000);
	return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Format a time value for statistics display (S.mmm).
 */
export function formatTimeShort(ms: number | null): string {
	if (!ms) return '-';
	const totalSeconds = Math.floor(ms / 1000);
	const milliseconds = Math.floor(ms % 1000);
	return `${totalSeconds}.${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Clean algorithm input for cubing.js parsing.
 * Handles wide moves (Rw→r), smart quotes, single-move parens.
 * Port of generate-ll-patterns.mjs cleanAlgorithm().
 */
export function cleanAlgorithmForCubing(alg: string): string {
	let s = alg
		.replace(/\+/g, ' ')
		.replace(/’/g, "'")
		.replace(/["“”]/g, "'")
		.replace(/'2/g, "2'");

	s = s.replace(/([RLFBUD])w/g, (_, m: string) => m.toLowerCase());
	s = s.replace(/\(([RLFBUDMESrlfbudxyz][2']?)\)/g, '$1');
	s = expandNotation(s);
	return s;
}

/**
 * Compute setup algorithm as inverse of the given algorithm.
 * Uses cubing.js Alg.invert() for correctness (handles groupings).
 */
export async function computeSetupInverse(algorithm: string): Promise<string> {
	await ensureCubingReady();
	const cleaned = cleanAlgorithmForCubing(algorithm);
	return _Alg.fromString(cleaned).invert().toString();
}
