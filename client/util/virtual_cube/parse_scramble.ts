import { parseScramble as parseMoveSeq } from '../cross-solver/parse-scramble';

import type { VrcFace, VrcMove } from './types';

/**
 * Scramble parsing. Port of `parseScramble` (twistynnn.js:553-570).
 *
 * The tokenizer itself is already in the repo: `client/util/cross-solver/parse-scramble.ts`
 * is the same cstimer function, ported earlier for the solvers. This file only
 * converts its output tuples into the [startLayer, endLayer, face, power] moves
 * the cube engine speaks.
 */

const FACE_ORDER = 'URFDLB';

/** Tokenizer power (1, 2, 3) to engine power (1, 2, -1). */
const POWER_MAP = [1, 2, -1];

/**
 * Parse a scramble string into engine moves.
 * Returns an empty array for a blank scramble; callers that want cstimer's random
 * fallback should use `generateRandomMoves` explicitly.
 */
export function parseVirtualScramble(scramble: string): VrcMove[] {
	if (!scramble || /^\s*$/.test(scramble)) {
		return [];
	}

	const moves = parseMoveSeq(scramble, FACE_ORDER);
	const out: VrcMove[] = [];

	for (let i = 0; i < moves.length; i++) {
		const [faceIndex, width, power, rangeStart] = moves[i];
		const face = FACE_ORDER.charAt(faceIndex) as VrcFace;

		if (width > 0) {
			// A normal turn. `width` is the outer layer count; `rangeStart` is the
			// low end when the token was an explicit range like "3-4Rw", otherwise
			// -1, which collapses the range to "layer 1 through width".
			const l1 = width;
			const l2 = rangeStart === -1 || rangeStart === undefined ? 1 : rangeStart;
			out.push([Math.min(l1, l2), Math.max(l1, l2), face, POWER_MAP[power - 1]]);
		} else {
			// A rotation. End layer 100 is cstimer's way of saying "past the far
			// side", which makes the layer window sweep every sticker whatever the
			// cube dimension is. The tokenizer signals rotations with a negative
			// power, so the power index is negated back here.
			out.push([1, 100, face, POWER_MAP[-power - 1]]);
		}
	}

	return out;
}

/**
 * Random move sequence used when the cube is asked to scramble itself with no
 * scramble string available. Port of `generateScramble` (twistynnn.js:322-341).
 *
 * Not a WCA scramble and not meant to be one: it produces 32 arbitrary ranged
 * turns purely so the cube is not left solved. The face order here really is
 * ULFRBD in the reference, not URFDLB.
 */
export function generateRandomMoves(dimension: number): VrcMove[] {
	const faces: VrcFace[] = ['U', 'L', 'F', 'R', 'B', 'D'];
	const powers = [-2, -1, 1, 2];
	const out: VrcMove[] = [];

	for (let i = 0; i < 32; i++) {
		const start = 1 + ~~((Math.random() * dimension) / 2);
		const end = start + ~~((Math.random() * dimension) / 2);
		out.push([start, end, faces[~~(Math.random() * 6)], powers[~~(Math.random() * 4)]]);
	}

	return out;
}
