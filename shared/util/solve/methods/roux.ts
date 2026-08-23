/**
 * Roux method definition.
 *
 * Steps: first block (FB), second block (SB), corners of last layer (CMLL),
 * last six edges (LSE). cstimer does not break LSE into EO / UL-UR / L4C either.
 *
 * 24 orientations. Roux blocks keep their integrity under whole-block rotation
 * (an L turn carries the first block around without breaking it), so the y
 * position matters and every orientation has to be considered.
 *
 * DELIBERATE DEVIATION FROM cstimer
 * ---------------------------------
 * cstimer detects the blocks with colour-equivalence facelet masks
 * (cubeutil.js:33-35). Those masks only ask "do these stickers match each
 * other", not "is the right piece in the right place", and they produce false
 * positives: measured on a constructed solve, cstimer's own getProgress reports
 * "first block done" at a point where no 1x2x3 block exists on the cube in any
 * of the 24 orientations. Reporting a block the solver has not built would
 * misattribute that block's moves and time to the next step.
 *
 * We therefore check blocks at the piece level (cp/co/ep/eo), the same way the
 * ZZ definition does. The masks remain in facelet_masks.ts for the CMLL case
 * lookup, where the equivalence-class behaviour is what is wanted.
 */

import { checkMask } from '../cube_progress';
import { SOLVED_MASK } from '../facelet_masks';
import { getMatchingCMLLState } from '../ll_identification';
import { MethodDefinition } from './types';

// cubejs piece order.
//   edges:   UR UF UL UB DR DF DL DB FR FL BL BR  (BL is 10, BR is 11)
//   corners: URF UFL ULB UBR DFR DLF DBL DRB
const FIRST_BLOCK = { edges: [6, 9, 10], corners: [5, 6] }; // DL, FL, BL + DLF, DBL
const SECOND_BLOCK = { edges: [4, 8, 11], corners: [4, 7] }; // DR, FR, BR + DFR, DRB
const LL_CORNERS = [0, 1, 2, 3]; // URF, UFL, ULB, UBR

function blockSolved(cube: any, block: { edges: number[]; corners: number[] }): boolean {
	for (const i of block.edges) {
		if (cube.ep[i] !== i || cube.eo[i] !== 0) return false;
	}
	for (const i of block.corners) {
		if (cube.cp[i] !== i || cube.co[i] !== 0) return false;
	}
	return true;
}

function llCornersSolved(cube: any): boolean {
	for (const i of LL_CORNERS) {
		if (cube.cp[i] !== i || cube.co[i] !== 0) return false;
	}
	return true;
}

/**
 * 4 = nothing, 3 = FB, 2 = SB, 1 = CMLL, 0 = solved.
 *
 * Mirrors cstimer's getRouxProgress ladder (cubeutil.js:205); only the block
 * test differs, see the deviation note above.
 */
export function getRouxProgressOneAxis(facelet: string, cube: any): number {
	if (!blockSolved(cube, FIRST_BLOCK)) {
		return 4;
	}
	if (!blockSolved(cube, SECOND_BLOCK)) {
		return 3;
	}
	if (!llCornersSolved(cube)) {
		return 2;
	}
	if (checkMask(facelet, SOLVED_MASK)) {
		return 1;
	}
	return 0;
}

export const ROUX_METHOD: MethodDefinition = {
	id: 'roux',
	axisCount: 24,
	maxProgress: 4,
	steps: ['fb', 'sb', 'cmll', 'lse'],
	progressToPhase(newProgress) {
		switch (newProgress) {
			case 3: return 'fb';
			case 2: return 'sb';
			case 1: return 'cmll';
			case 0: return 'lse';
			default: return null;
		}
	},
	getProgress: (facelet, getCube) => getRouxProgressOneAxis(facelet, getCube()),
	caseSpecs: [
		{ phase: 'cmll', set: 'cmll', fromPhases: ['sb', 'fb'], identify: getMatchingCMLLState },
	],
};
