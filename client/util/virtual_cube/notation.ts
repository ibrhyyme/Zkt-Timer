import type { VrcFace, VrcMove } from './types';

/**
 * Move notation and classification. Port of twistynnn.js:545-608.
 */

const FACE_ORDER = 'URFDLB';
/** Power suffix table. Index comes from `(power + 3) % 4`. */
const POWER_SUFFIX = " 2'";

/**
 * True when the move spans the whole cube, i.e. it is an x/y/z rotation.
 *
 * cstimer calls this `isInspectionLegalMove` because that is what it is used for:
 * rotations are allowed during inspection and do not start the timer, whereas any
 * real turn does. Same predicate, clearer name.
 */
export function isRotation(move: VrcMove, dimension: number): boolean {
	return move[0] <= 1 && move[1] >= dimension;
}

/**
 * True when two moves turn about the same axis, so they can animate at the same
 * time (R and L, U and D, F and B). twistynnn.js:549-551.
 */
export function isParallelMove(move1: VrcMove, move2: VrcMove): boolean {
	return FACE_ORDER.indexOf(move1[2]) % 3 === FACE_ORDER.indexOf(move2[2]) % 3;
}

/**
 * Render a move in standard notation. twistynnn.js:590-602.
 *
 * Three shapes come out of this:
 *   whole-cube span  -> "x", "y2", "z'"
 *   outer block      -> "R", "Rw2", "3Rw'"
 *   inner block      -> "2-3Rw", i.e. an explicit layer range
 *
 * Quarter turns get a trailing space from the suffix table. That is deliberate in
 * the reference; the recorder trims it (`moveSeq2str` does `val[0].trim()`), so
 * callers that want a clean token must trim too.
 */
export function move2str(move: VrcMove, dimension: number): string {
	const axis = move[2];
	const nlayer = move[1];
	const pow = (move[3] + 3) % 4;

	if (nlayer >= dimension) {
		// Rotation. D/L/B turn opposite to U/R/F about the same axis, so their
		// power is mirrored to keep the emitted x/y/z direction correct.
		const axisChar = 'yxz'.charAt(FACE_ORDER.indexOf(axis) % 3);
		const powChar = POWER_SUFFIX.charAt('URF'.indexOf(axis) === -1 ? 2 - pow : pow);
		return axisChar + powChar;
	}

	if (move[0] === 1) {
		return (nlayer > 2 ? String(nlayer) : '') + axis + (nlayer >= 2 ? 'w' : '') + POWER_SUFFIX.charAt(pow);
	}

	return `${move[0]}-${move[1]}${axis}w${POWER_SUFFIX.charAt(pow)}`;
}

/** Invert a move by negating its power. twistynnn.js:604-608. */
export function moveInv(move: VrcMove): VrcMove {
	return [move[0], move[1], move[2], -move[3]];
}

/** Narrowing helper for the face letter. */
export function isVrcFace(value: string): value is VrcFace {
	return FACE_ORDER.indexOf(value) !== -1;
}
