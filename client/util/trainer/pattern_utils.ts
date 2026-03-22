import type {KPattern, KPatternData, KPuzzle} from 'cubing/kpuzzle';

// Lazy-loaded cubing modules (ESM-only, cannot be statically imported in SSR)
let KPUZZLE_333: KPuzzle;
let _KPattern: any;

/**
 * Lazily load cubing kpuzzle modules and initialize the 3x3x3 puzzle.
 * Must be called before using faceletsToPattern.
 */
export async function ensureKPuzzleReady(): Promise<void> {
	if (KPUZZLE_333) return;
	const [{cube3x3x3}, {KPattern}] = await Promise.all([
		import('cubing/puzzles'),
		import('cubing/kpuzzle'),
	]);
	_KPattern = KPattern;
	KPUZZLE_333 = await cube3x3x3.kpuzzle();
}

export function getKPuzzle(): KPuzzle | null {
	return KPUZZLE_333 || null;
}

const REID_EDGE_ORDER = 'UF UR UB UL DF DR DB DL FR FL BR BL'.split(' ');
const REID_CORNER_ORDER = 'UFR URB UBL ULF DRF DFL DLB DBR'.split(' ');
const REID_CENTER_ORDER = 'U L F R B D'.split(' ');

const REID_TO_FACELETS_MAP: [number, number, number][] = [
	[1, 2, 0], [0, 2, 0], [1, 1, 0], [0, 3, 0], [2, 0, 0], [0, 1, 0],
	[1, 3, 0], [0, 0, 0], [1, 0, 0], [1, 0, 2], [0, 1, 1], [1, 1, 1],
	[0, 8, 1], [2, 3, 0], [0, 10, 1], [1, 4, 1], [0, 5, 1], [1, 7, 2],
	[1, 3, 2], [0, 0, 1], [1, 0, 1], [0, 9, 0], [2, 2, 0], [0, 8, 0],
	[1, 5, 1], [0, 4, 1], [1, 4, 2], [1, 5, 0], [0, 4, 0], [1, 4, 0],
	[0, 7, 0], [2, 5, 0], [0, 5, 0], [1, 6, 0], [0, 6, 0], [1, 7, 0],
	[1, 2, 2], [0, 3, 1], [1, 3, 1], [0, 11, 1], [2, 1, 0], [0, 9, 1],
	[1, 6, 1], [0, 7, 1], [1, 5, 2], [1, 1, 2], [0, 2, 1], [1, 2, 1],
	[0, 10, 0], [2, 4, 0], [0, 11, 0], [1, 7, 1], [0, 6, 1], [1, 6, 2],
];

const CORNER_MAPPING = [
	[0, 21, 15], [5, 13, 47], [7, 45, 39], [2, 37, 23],
	[29, 10, 16], [31, 18, 32], [26, 34, 40], [24, 42, 8],
];

const EDGE_MAPPING = [
	[1, 22], [3, 14], [6, 46], [4, 38],
	[30, 17], [27, 9], [25, 41], [28, 33],
	[19, 12], [20, 35], [44, 11], [43, 36],
];

const FACE_ORDER = 'URFDLB';

interface PieceInfo {
	piece: number;
	orientation: number;
}

const PIECE_MAP: {[s: string]: PieceInfo} = {};

function rotateLeft(s: string, i: number): string {
	return s.slice(i) + s.slice(0, i);
}

REID_EDGE_ORDER.forEach((edge, idx) => {
	for (let i = 0; i < 2; i++) {
		PIECE_MAP[rotateLeft(edge, i)] = {piece: idx, orientation: i};
	}
});

REID_CORNER_ORDER.forEach((corner, idx) => {
	for (let i = 0; i < 3; i++) {
		PIECE_MAP[rotateLeft(corner, i)] = {piece: idx, orientation: i};
	}
});

function toReid333Struct(pattern: KPattern): string[][] {
	const output: string[][] = [[], []];
	for (let i = 0; i < 6; i++) {
		if (pattern.patternData['CENTERS'].pieces[i] !== i) {
			throw new Error('non-oriented puzzles are not supported');
		}
	}
	for (let i = 0; i < 12; i++) {
		output[0].push(
			rotateLeft(
				REID_EDGE_ORDER[pattern.patternData['EDGES'].pieces[i]],
				pattern.patternData['EDGES'].orientation[i]
			)
		);
	}
	for (let i = 0; i < 8; i++) {
		output[1].push(
			rotateLeft(
				REID_CORNER_ORDER[pattern.patternData['CORNERS'].pieces[i]],
				pattern.patternData['CORNERS'].orientation[i]
			)
		);
	}
	output.push(REID_CENTER_ORDER);
	return output;
}

/**
 * Convert cubing.js KPattern to Kociemba facelet string (54 characters).
 */
export function patternToFacelets(pattern: KPattern): string {
	const reid = toReid333Struct(pattern);
	return REID_TO_FACELETS_MAP.map(([orbit, perm, ori]) => reid[orbit][perm][ori]).join('');
}

/**
 * Convert KPattern to Kociemba facelets for GAN cube comparison.
 * Unlike patternToFacelets, does NOT throw for non-canonical centers.
 * Output always has canonical centers (matching GAN FACELETS behavior).
 * Edge/corner data is extracted from piece positions — no center dependency.
 */
export function patternToGANFacelets(pattern: KPattern): string {
	const output: string[][] = [[], []];
	for (let i = 0; i < 12; i++) {
		output[0].push(
			rotateLeft(
				REID_EDGE_ORDER[pattern.patternData['EDGES'].pieces[i]],
				pattern.patternData['EDGES'].orientation[i]
			)
		);
	}
	for (let i = 0; i < 8; i++) {
		output[1].push(
			rotateLeft(
				REID_CORNER_ORDER[pattern.patternData['CORNERS'].pieces[i]],
				pattern.patternData['CORNERS'].orientation[i]
			)
		);
	}
	output.push(REID_CENTER_ORDER);
	return REID_TO_FACELETS_MAP.map(([orbit, perm, ori]) => output[orbit][perm][ori]).join('');
}

/**
 * Convert Kociemba facelet string (54 characters) to cubing.js KPattern.
 */
export function faceletsToPattern(facelets: string): KPattern | null {
	if (!KPUZZLE_333) return null;

	const stickers: number[] = [];
	facelets.match(/.{9}/g)?.forEach((face) => {
		face
			.split('')
			.reverse()
			.forEach((s, i) => {
				if (i !== 4) stickers.push(FACE_ORDER.indexOf(s));
			});
	});

	const patternData: KPatternData = {
		CORNERS: {
			pieces: [],
			orientation: [],
		},
		EDGES: {
			pieces: [],
			orientation: [],
		},
		CENTERS: {
			pieces: [0, 1, 2, 3, 4, 5],
			orientation: [0, 0, 0, 0, 0, 0],
			orientationMod: [1, 1, 1, 1, 1, 1],
		},
	};

	for (const cm of CORNER_MAPPING) {
		const pi: PieceInfo = PIECE_MAP[cm.map((i) => FACE_ORDER[stickers[i]]).join('')];
		patternData.CORNERS.pieces.push(pi.piece);
		patternData.CORNERS.orientation.push(pi.orientation);
	}

	for (const em of EDGE_MAPPING) {
		const pi: PieceInfo = PIECE_MAP[em.map((i) => FACE_ORDER[stickers[i]]).join('')];
		patternData.EDGES.pieces.push(pi.piece);
		patternData.EDGES.orientation.push(pi.orientation);
	}

	return new _KPattern(KPUZZLE_333, patternData);
}

/**
 * Fix the orientation of a KPattern so that center pieces are in canonical position.
 * Applies x/y/z rotations until centers are [0,1,2,3,4,5].
 */
/**
 * Compare two KPatterns ignoring the CENTERS orbit.
 * GAN cubes report edges/corners correctly via CP/CO/EP/EO but hardcode
 * centers to canonical position. After M/E/S moves, algPatternStates have
 * actual center positions. By ignoring centers, we compare only the data
 * that GAN accurately reports.
 */
export function isIdenticalIgnoringCenters(a: KPattern, b: KPattern): boolean {
	const ad = a.patternData;
	const bd = b.patternData;
	for (let i = 0; i < 8; i++) {
		if (ad['CORNERS'].pieces[i] !== bd['CORNERS'].pieces[i]) return false;
		if (ad['CORNERS'].orientation[i] !== bd['CORNERS'].orientation[i]) return false;
	}
	for (let i = 0; i < 12; i++) {
		if (ad['EDGES'].pieces[i] !== bd['EDGES'].pieces[i]) return false;
		if (ad['EDGES'].orientation[i] !== bd['EDGES'].orientation[i]) return false;
	}
	return true;
}

export function fixOrientation(pattern: KPattern): KPattern {
	if (
		JSON.stringify(pattern.patternData['CENTERS'].pieces) ===
		JSON.stringify([0, 1, 2, 3, 4, 5])
	) {
		return pattern;
	}
	for (const letter of ['x', 'y', 'z']) {
		let result = pattern;
		for (let i = 0; i < 4; i++) {
			result = result.applyAlg(letter);
			if (
				JSON.stringify(result.patternData['CENTERS'].pieces) ===
				JSON.stringify([0, 1, 2, 3, 4, 5])
			) {
				return result;
			}
		}
	}
	return pattern;
}

// --- Custom Algorithm Validation & Pattern Generation ---

/**
 * Kociemba facelet indices for the 21 visible 2D-LL positions.
 * Ported from generate-ll-patterns.mjs.
 * Top face (9): U0-U8
 * Front top row (3): F18, F19, F20
 * Right top row (3): R11, R10, R9 (back→front from above)
 * Back top row (3): B47, B46, B45 (left→right from above)
 * Left top row (3): L36, L37, L38
 */
export const LL_FACELET_INDICES = [
	0, 1, 2, 3, 4, 5, 6, 7, 8,
	18, 19, 20,
	11, 10, 9,
	47, 46, 45,
	36, 37, 38,
];

/**
 * Generate 21-char LL pattern for an algorithm on the client side.
 * Uses patternToGANFacelets (center-independent — no fixOrientation needed).
 */
export async function generateLLPattern(algorithm: string): Promise<string | null> {
	await ensureKPuzzleReady();
	const kpuzzle = getKPuzzle();
	if (!kpuzzle) return null;

	try {
		const [{Alg}, {cleanAlgorithmForCubing}] = await Promise.all([
			import('cubing/alg'),
			import('./algorithm_engine'),
		]);
		const cleaned = cleanAlgorithmForCubing(algorithm);
		const inverse = Alg.fromString(cleaned).invert();
		const solved = kpuzzle.defaultPattern();
		const setupState = solved.applyAlg(inverse);
		const facelets = patternToGANFacelets(setupState);
		return LL_FACELET_INDICES.map(i => facelets[i]).join('');
	} catch {
		return null;
	}
}

/**
 * Rotate a 21-char LL pattern by U CW (90 degrees).
 * Top face: standard 3x3 CW rotation.
 * Sides: newF=oldL, newR=reverse(oldF), newB=oldR, newL=reverse(oldB).
 * The alternating reversal comes from LL_FACELET_INDICES using different
 * ordering directions per face (F/L normal, R/B reversed Kociemba order).
 */
export function rotateLLPatternCW(pattern: string): string {
	const top = [6, 3, 0, 7, 4, 1, 8, 5, 2].map(i => pattern[i]).join('');
	const F = pattern.slice(9, 12);
	const R = pattern.slice(12, 15);
	const B = pattern.slice(15, 18);
	const L = pattern.slice(18, 21);

	const newF = L;
	const newR = F[2] + F[1] + F[0];
	const newB = R;
	const newL = B[2] + B[1] + B[0];

	return top + newF + newR + newB + newL;
}

/**
 * Validate whether a candidate algorithm solves the same case as the original.
 * Pre-AUF: pattern rotation (4x CW) ile kontrol edilir.
 * Post-AUF: candidate algoritmaya U/U2/U' eklenerek 4 varyasyon uretilir.
 * Toplam 16 kombinasyon (4 post-AUF x 4 pre-AUF rotation) tam AUF coverage saglar.
 * OLL/2-Look OLL: orientation mask karsilastirmasi (U vs non-U).
 * PLL/ZBLL/COLL/CMLL/OLLCP/diger: full 21-char pattern karsilastirmasi.
 */
export async function validateSameCase(
	originalAlg: string,
	candidateAlg: string,
	category: string
): Promise<{valid: boolean; error?: string}> {
	// Original + candidate'in 4 post-AUF varyasyonu paralel uretilir
	const [origPattern, ...candPatterns] = await Promise.all([
		generateLLPattern(originalAlg),
		generateLLPattern(candidateAlg),
		generateLLPattern(candidateAlg + ' U'),
		generateLLPattern(candidateAlg + ' U2'),
		generateLLPattern(candidateAlg + " U'"),
	]);

	if (!origPattern) return {valid: false, error: 'original_parse_error'};
	if (candPatterns.every(p => p === null)) return {valid: false, error: 'candidate_parse_error'};

	const lower = category.toLowerCase();
	const isOLL = (lower === 'oll' || lower === '2-look oll');
	const compare = isOLL ? compareOLLMasks : compareFullPatterns;

	for (const candPattern of candPatterns) {
		if (!candPattern) continue;

		// 4 pre-AUF rotasyonu dene
		let rotated = candPattern;
		for (let i = 0; i < 4; i++) {
			if (compare(origPattern, rotated)) return {valid: true};
			rotated = rotateLLPatternCW(rotated);
		}
	}

	return {valid: false, error: 'different_case'};
}

function compareFullPatterns(a: string, b: string): boolean {
	return a === b;
}

function compareOLLMasks(a: string, b: string): boolean {
	for (let i = 0; i < 21; i++) {
		if ((a[i] === 'U') !== (b[i] === 'U')) return false;
	}
	return true;
}
