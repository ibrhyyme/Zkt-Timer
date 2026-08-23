/**
 * Cube orientation scanning + CFOP progress detection.
 *
 * Progress level convention (cstimer): a level counts DOWN as the solve advances,
 * and every drop marks one completed phase. Each method defines its own ladder;
 * this file owns the shared orientation machinery plus the CFOP ladders ported
 * from cstimer cubeutil.js.
 *
 * CFOP (cstimer getCF4OPProgress):
 *   7 = nothing, 6 = cross, 5..2 = nth F2L pair, 1 = OLL, 0 = solved
 *
 * CFOP 2-look (cstimer getCF4O2P2Progress):
 *   9 = nothing, 8 = cross, 7..4 = nth F2L pair, 3 = EO, 2 = full OLL, 1 = CP, 0 = solved
 *
 * Orientation scanning: a method is checked across N orientations and the one
 * with the LOWEST progress wins (most-solved reading). CFOP and ZZ need 6 (only
 * "which face is down" matters, y turns are irrelevant). Roux needs all 24
 * because its blocks keep their integrity under whole-block rotation, so the
 * y position matters too.
 */

import Cube from 'cubejs';
import {
	CROSS_MASK,
	F2L1_MASK,
	F2L2_MASK,
	F2L3_MASK,
	F2L4_MASK,
	F2L_MASK,
	OLL_MASK,
	EOLL_MASK,
	CPLL_MASK,
	SOLVED_MASK,
	EquivalenceClass,
} from './facelet_masks';

/**
 * Is mask satisfied? cstimer convention: 0 = satisfied, 1 = NOT satisfied.
 */
export function checkMask(facelet: string, mask: EquivalenceClass[]): number {
	for (const equ of mask) {
		const col = facelet[equ[0]];
		for (let j = 1; j < equ.length; j++) {
			if (facelet[equ[j]] !== col) {
				return 1;
			}
		}
	}
	return 0;
}

/**
 * cstimer getCF4OPProgress port. Progress level calculation for single orientation.
 */
export function getCF4OPProgressOneAxis(facelet: string): number {
	if (checkMask(facelet, CROSS_MASK)) {
		return 7;
	}
	if (checkMask(facelet, F2L_MASK)) {
		return (
			2 +
			checkMask(facelet, F2L1_MASK) +
			checkMask(facelet, F2L2_MASK) +
			checkMask(facelet, F2L3_MASK) +
			checkMask(facelet, F2L4_MASK)
		);
	}
	if (checkMask(facelet, OLL_MASK)) {
		return 2;
	}
	if (checkMask(facelet, SOLVED_MASK)) {
		return 1;
	}
	return 0;
}

/**
 * cstimer getCF4O2P2Progress port (cubeutil.js:125). Splits the last layer into
 * EO -> CO -> CP -> EP so a two-look solver sees each look separately.
 */
export function getCF4O2P2ProgressOneAxis(facelet: string): number {
	if (checkMask(facelet, CROSS_MASK)) {
		return 9;
	}
	if (checkMask(facelet, F2L_MASK)) {
		return (
			4 +
			checkMask(facelet, F2L1_MASK) +
			checkMask(facelet, F2L2_MASK) +
			checkMask(facelet, F2L3_MASK) +
			checkMask(facelet, F2L4_MASK)
		);
	}
	if (checkMask(facelet, EOLL_MASK)) {
		return 4;
	}
	if (checkMask(facelet, OLL_MASK)) {
		return 3;
	}
	if (checkMask(facelet, CPLL_MASK)) {
		return 2;
	}
	if (checkMask(facelet, SOLVED_MASK)) {
		return 1;
	}
	return 0;
}

/**
 * Which face sits on the bottom for orientation index i (i % 6).
 * Index order is fixed — the first six entries must keep this order because
 * `crossFace` labels and the existing CFOP tests depend on it.
 */
export const CROSS_AXIS_LABELS: Array<'D' | 'U' | 'F' | 'B' | 'R' | 'L'> = [
	'D', // identity
	'U', // x2
	'F', // x'
	'B', // x
	'R', // z
	'L', // z'
];

const FACE_ROTATIONS: Array<string | null> = [
	null, // D: identity
	'x2', // U->D
	"x'", // F->D
	'x', // B->D
	'z', // R->D
	"z'", // L->D
];

const Y_ROTATIONS: Array<string | null> = [null, 'y', 'y2', "y'"];

/**
 * All 24 orientations. Index layout is deliberate: 0..5 are the y-free
 * orientations in the historical order, so a 6-axis scan reads the same as it
 * always did, and 6..23 add the y variants needed by Roux.
 */
const AXIS_ROTATIONS: Array<string | null> = (() => {
	const out: Array<string | null> = [];
	for (const y of Y_ROTATIONS) {
		for (const face of FACE_ROTATIONS) {
			const parts = [face, y].filter(Boolean) as string[];
			out.push(parts.length ? parts.join(' ') : null);
		}
	}
	return out;
})();

export const AXIS_COUNT_ALL = AXIS_ROTATIONS.length; // 24

export function rotateFacelet(facelet: string, rotMove: string | null): string {
	if (!rotMove) return facelet;
	try {
		const c = Cube.fromString(facelet);
		for (const m of rotMove.split(' ')) c.move(m);
		return c.asString();
	} catch {
		return facelet;
	}
}

/** Rotated cube object — used by methods that need piece-level data (ZZ edge orientation). */
export function rotateCube(facelet: string, rotMove: string | null): any {
	const c = Cube.fromString(facelet);
	if (rotMove) {
		for (const m of rotMove.split(' ')) c.move(m);
	}
	return c;
}

export interface AxisProgress {
	progress: number;
	axisIndex: number;
	crossFace: 'D' | 'U' | 'F' | 'B' | 'R' | 'L';
}

/**
 * Scans `axisCount` orientations and returns the most-solved reading.
 * `progressFn` receives the rotated facelet, and lazily the rotated cube object
 * for methods that need piece-level state.
 */
export function scanAxes(
	facelet: string,
	progressFn: (rotated: string, getCube: () => any) => number,
	axisCount: number
): AxisProgress {
	let minProg = Infinity;
	let minAxis = 0;
	for (let a = 0; a < axisCount; a++) {
		const rot = AXIS_ROTATIONS[a];
		const rotated = rotateFacelet(facelet, rot);
		let cached: any;
		const getCube = () => {
			if (!cached) cached = rotateCube(facelet, rot);
			return cached;
		};
		const p = progressFn(rotated, getCube);
		if (p < minProg) {
			minProg = p;
			minAxis = a;
			if (p === 0) break;
		}
	}
	return {
		progress: minProg,
		axisIndex: minAxis,
		crossFace: CROSS_AXIS_LABELS[minAxis % 6],
	};
}

/**
 * 6 axis CFOP check. Returns minimum progress (most solved axis) and which axis it is.
 */
export function getCFOPProgress(facelet: string): AxisProgress {
	return scanAxes(facelet, getCF4OPProgressOneAxis, 6);
}

/**
 * Progress calculation for given axis (fixed cross face). Continues working after cross phase is detected,
 * provides axis-locked progress.
 */
export function getCFOPProgressOnAxis(facelet: string, axisIndex: number): number {
	const rotated = rotateFacelet(facelet, AXIS_ROTATIONS[axisIndex]);
	return getCF4OPProgressOneAxis(rotated);
}

/**
 * Progress level → CFOP phase name. data[--progress] logic:
 *   progress 7→6 = cross
 *   6→5 = f2l_1, 5→4 = f2l_2, 4→3 = f2l_3, 3→2 = f2l_4
 *   2→1 = oll
 *   1→0 = pll
 */
export function progressToPhaseName(
	newProgress: number
): 'cross' | 'f2l_1' | 'f2l_2' | 'f2l_3' | 'f2l_4' | 'oll' | 'pll' | null {
	switch (newProgress) {
		case 6:
			return 'cross';
		case 5:
			return 'f2l_1';
		case 4:
			return 'f2l_2';
		case 3:
			return 'f2l_3';
		case 2:
			return 'f2l_4';
		case 1:
			return 'oll';
		case 0:
			return 'pll';
		default:
			return null;
	}
}

export function getAxisRotationMove(axisIndex: number): string | null {
	return AXIS_ROTATIONS[axisIndex] ?? null;
}
