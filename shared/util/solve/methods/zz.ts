/**
 * ZZ method definition — Zkt-Timer original, no cstimer counterpart.
 *
 * cstimer cannot express ZZ: its engine reads the cube as a 54-character sticker
 * string, and edge orientation is not a colour property. We keep the cube as
 * cubejs piece arrays, so EO is a direct read of `eo`.
 *
 * Steps: EOLine, first block, second block, last layer.
 *
 * 24 orientations. EO is axis-dependent — measured: x / y / z rotations change
 * the reading, x2 / z2 preserve it — so which orientation the solver oriented
 * edges against has to be discovered rather than assumed.
 */

import { checkMask } from '../cube_progress';
import { SOLVED_MASK } from '../facelet_masks';
import { getMatchingPLLState, getMatchingCOLLState } from '../ll_identification';
import { MethodDefinition } from './types';

// cubejs piece order.
//   edges:   UR UF UL UB DR DF DL DB FR FL BL BR
//   corners: URF UFL ULB UBR DFR DLF DBL DRB
// Note BL is 10 and BR is 11 — the pair reads BL-then-BR, not the other way round.
const DF = 5;
const DB = 7;

const LEFT_BLOCK = { edges: [6, 9, 10], corners: [5, 6] }; // DL, FL, BL + DLF, DBL
const RIGHT_BLOCK = { edges: [4, 8, 11], corners: [4, 7] }; // DR, FR, BR + DFR, DRB

function blockSolved(cube: any, block: { edges: number[]; corners: number[] }): boolean {
	for (const i of block.edges) {
		if (cube.ep[i] !== i || cube.eo[i] !== 0) return false;
	}
	for (const i of block.corners) {
		if (cube.cp[i] !== i || cube.co[i] !== 0) return false;
	}
	return true;
}

/**
 * EOLine: every edge oriented, plus DF and DB placed.
 * Verified against the definition — a cube touched only by R/U/L/D keeps EO,
 * a single F breaks exactly four edges, F2 breaks none.
 */
export function isEOLineSolved(cube: any): boolean {
	for (let i = 0; i < 12; i++) {
		if (cube.eo[i] !== 0) return false;
	}
	return cube.ep[DF] === DF && cube.ep[DB] === DB;
}

/**
 * 4 = nothing, 3 = EOLine, 2 = one block, 1 = both blocks, 0 = solved.
 *
 * Block order is intentionally not pinned: ZZ solvers build left-first or
 * right-first by preference, so the ladder counts blocks rather than naming sides.
 */
export function getZZProgressOneAxis(facelet: string, cube: any): number {
	if (!isEOLineSolved(cube)) {
		return 4;
	}
	const left = blockSolved(cube, LEFT_BLOCK);
	const right = blockSolved(cube, RIGHT_BLOCK);
	if (!left && !right) {
		return 3;
	}
	if (!left || !right) {
		return 2;
	}
	if (checkMask(facelet, SOLVED_MASK)) {
		return 1;
	}
	return 0;
}

export const ZZ_METHOD: MethodDefinition = {
	id: 'zz',
	axisCount: 24,
	maxProgress: 4,
	steps: ['eoline', 'block_1', 'block_2', 'll'],
	progressToPhase(newProgress) {
		switch (newProgress) {
			case 3: return 'eoline';
			case 2: return 'block_1';
			case 1: return 'block_2';
			case 0: return 'll';
			default: return null;
		}
	},
	getProgress: (facelet, getCube) => getZZProgressOneAxis(facelet, getCube()),
	caseSpecs: [
		// ZZ enters the last layer with edges already oriented, which is exactly the
		// state COLL describes — so the corner case is readable even though the
		// 493-case ZBLL set is not dumped. PLL additionally resolves for solvers who
		// finish with OCLL + PLL.
		{ phase: 'll', set: 'coll', fromPhases: ['block_2', 'block_1'], identify: getMatchingCOLLState },
		{ phase: 'll', set: 'pll', fromPhases: ['block_2', 'block_1'], identify: getMatchingPLLState },
	],
};
