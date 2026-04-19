/**
 * Minimal NxN cube simulator used for drawing scramble preview diagrams.
 * Faces are stored row-major, top-left to bottom-right when the face is
 * viewed from outside the cube.
 *
 * Face indices follow WCA/Singmaster convention:
 *   0: U (white),  1: R (red),  2: F (green),
 *   3: D (yellow), 4: L (orange), 5: B (blue)
 *
 * Colours are hex strings so the PDF renderer can use them directly.
 */

export const FACE_NAMES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export type FaceIdx = 0 | 1 | 2 | 3 | 4 | 5;

export const DEFAULT_FACE_COLORS: Record<string, string> = {
	U: '#FFFFFF',
	R: '#EF3E33',
	F: '#00A651',
	D: '#FFD600',
	L: '#FF8A00',
	B: '#1E49BF',
};

export interface CubeState {
	size: number;
	// faces[f][row * size + col] → face letter (single char matching FACE_NAMES)
	faces: string[][];
}

export function createSolvedCube(size: number): CubeState {
	const faces: string[][] = [];
	for (const f of FACE_NAMES) {
		const arr = new Array(size * size).fill(f);
		faces.push(arr);
	}
	return {size, faces};
}

/** In-place: rotate a single face by 90° clockwise. */
function rotateFaceCW(face: string[], size: number) {
	const copy = face.slice();
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			face[c * size + (size - 1 - r)] = copy[r * size + c];
		}
	}
}

/** Apply a single 90°-CW slice turn for the `axis` on the given `depth`.
 * `depth` 0 = outermost slice facing the positive axis, 1 = one layer in, etc.
 *
 * This is the only primitive we need — all other moves compose out of it.
 */
function cycle(a: string[], b: string[], c: string[], d: string[], idxA: number[], idxB: number[], idxC: number[], idxD: number[]) {
	// Rotate a → b → c → d → a (CW when viewed from axis's positive direction).
	const savedA = idxA.map((i) => a[i]);
	for (let k = 0; k < idxA.length; k++) a[idxA[k]] = d[idxD[k]];
	for (let k = 0; k < idxB.length; k++) d[idxD[k]] = c[idxC[k]];
	for (let k = 0; k < idxC.length; k++) c[idxC[k]] = b[idxB[k]];
	for (let k = 0; k < idxD.length; k++) b[idxB[k]] = savedA[k];
}

const U_IDX = 0,
	R_IDX = 1,
	F_IDX = 2,
	D_IDX = 3,
	L_IDX = 4,
	B_IDX = 5;

function row(size: number, rowIdx: number): number[] {
	const out: number[] = [];
	for (let c = 0; c < size; c++) out.push(rowIdx * size + c);
	return out;
}
function col(size: number, colIdx: number): number[] {
	const out: number[] = [];
	for (let r = 0; r < size; r++) out.push(r * size + colIdx);
	return out;
}
function colReversed(size: number, colIdx: number): number[] {
	return col(size, colIdx).reverse();
}
function rowReversed(size: number, rowIdx: number): number[] {
	return row(size, rowIdx).reverse();
}

/**
 * Apply one 90° CW move on a given face+depth.
 * depth=0 means the face layer itself, depth=size-1 is the opposite face layer.
 */
function doTurn(state: CubeState, face: 'U' | 'R' | 'F' | 'D' | 'L' | 'B', depth: number) {
	const n = state.size;
	const f = state.faces;
	if (depth === 0) {
		// Rotate the face's own stickers.
		const faceIdx = {U: U_IDX, R: R_IDX, F: F_IDX, D: D_IDX, L: L_IDX, B: B_IDX}[face];
		rotateFaceCW(f[faceIdx], n);
	}
	// Cycle the 4 surrounding strips for this layer.
	switch (face) {
		case 'U': {
			// CW viewed from top: F → L → B → R → F, row = depth
			const ri = depth;
			cycle(f[F_IDX], f[L_IDX], f[B_IDX], f[R_IDX],
				row(n, ri), row(n, ri), row(n, ri), row(n, ri));
			break;
		}
		case 'D': {
			// CW viewed from bottom: F → R → B → L → F, row = n-1-depth on F/R/B/L
			const ri = n - 1 - depth;
			cycle(f[F_IDX], f[R_IDX], f[B_IDX], f[L_IDX],
				row(n, ri), row(n, ri), row(n, ri), row(n, ri));
			break;
		}
		case 'R': {
			// CW viewed from right: U → B → D → F → U, col = n-1-depth on U/F/D; col = depth on B (reversed)
			const ci = n - 1 - depth;
			cycle(f[U_IDX], f[B_IDX], f[D_IDX], f[F_IDX],
				col(n, ci), colReversed(n, depth), col(n, ci), col(n, ci));
			break;
		}
		case 'L': {
			// CW viewed from left: U → F → D → B → U, col = depth on U/F/D, col = n-1-depth on B (reversed)
			const ci = depth;
			cycle(f[U_IDX], f[F_IDX], f[D_IDX], f[B_IDX],
				col(n, ci), col(n, ci), col(n, ci), colReversed(n, n - 1 - depth));
			break;
		}
		case 'F': {
			// CW viewed from front: U-bottom → R-left → D-top(reversed) → L-right(reversed) → U-bottom
			const ri = n - 1 - depth; // row on U
			const ri2 = depth; // row on D
			cycle(f[U_IDX], f[R_IDX], f[D_IDX], f[L_IDX],
				row(n, ri), col(n, depth), rowReversed(n, ri2), colReversed(n, n - 1 - depth));
			break;
		}
		case 'B': {
			// CW viewed from back: U-top → L-left(reversed) → D-bottom(reversed) → R-right → U-top
			const ri = depth;
			const ri2 = n - 1 - depth;
			cycle(f[U_IDX], f[L_IDX], f[D_IDX], f[R_IDX],
				row(n, ri), colReversed(n, depth), rowReversed(n, ri2), col(n, n - 1 - depth));
			break;
		}
	}
}

/**
 * Apply scramble string to a solved cube of given size. Accepts WCA-style
 * notation: U/R/F/D/L/B with ' or 2, wide moves (lowercase r, u, etc. and
 * Rw, Uw notation) and numeric layer prefixes (3Rw etc.).
 * Unknown tokens are ignored so the preview stays robust.
 */
export function applyScramble(size: number, scramble: string): CubeState {
	const state = createSolvedCube(size);
	const tokens = scramble.trim().split(/\s+/).filter(Boolean);
	for (const raw of tokens) {
		const parsed = parseMove(raw, size);
		if (!parsed) continue;
		const {face, depth, count} = parsed;
		// Apply `count` 90°CW primitive turns across layers 0..depth.
		const turns = ((count % 4) + 4) % 4;
		for (let t = 0; t < turns; t++) {
			for (let d = 0; d < depth; d++) {
				doTurn(state, face, d);
			}
		}
	}
	return state;
}

interface ParsedMove {
	face: 'U' | 'R' | 'F' | 'D' | 'L' | 'B';
	/** Number of layers from the face side (1 = outer layer only, 2 = outer + second, …). */
	depth: number;
	/** 1 = CW, -1 = CCW, 2 = 180°. */
	count: number;
}

function parseMove(token: string, size: number): ParsedMove | null {
	// Pattern: optional numeric layer prefix, face letter (upper or lower),
	// optional 'w', suffix ' or 2.
	// Examples: R, R', R2, r, r', 3Rw, 3Rw2, Rw, Rw'.
	const m = token.match(/^(\d+)?([URFDLB])([w]?)('|2)?$/i);
	if (!m) return null;
	const [, numStr, letterRaw, wStr, suffix] = m;
	const letterUpper = letterRaw.toUpperCase() as ParsedMove['face'];
	const isLower = letterRaw !== letterUpper;
	const hasW = wStr === 'w' || wStr === 'W';

	// Resolve layer depth.
	let depth = 1;
	if (numStr) {
		depth = parseInt(numStr, 10);
	} else if (hasW || isLower) {
		// Default wide move: 2 layers (outer + 2nd) for NxN with n >= 3.
		// For 2x2, treat as single layer since there's no second slice.
		depth = size >= 3 ? 2 : 1;
	}
	depth = Math.min(Math.max(depth, 1), size);

	let count = 1;
	if (suffix === "'") count = -1;
	else if (suffix === '2') count = 2;

	return {face: letterUpper, depth, count};
}
