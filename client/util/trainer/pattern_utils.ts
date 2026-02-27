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
