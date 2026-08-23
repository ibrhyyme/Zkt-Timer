/**
 * CFOP method definitions — ported from cstimer cubeutil.js.
 *
 * `cfop`  = cstimer cf4op   (cross, four F2L pairs, OLL, PLL)
 * `cfop2` = cstimer cf4o2p2 (same F2L, last layer split into EO / CO / CP / EP)
 *
 * Both scan 6 orientations: for a cross-based method only the down face matters,
 * y rotations leave the cross intact.
 */

import { getCF4OPProgressOneAxis, getCF4O2P2ProgressOneAxis } from '../cube_progress';
import { getMatchingOLLState, getMatchingPLLState, getMatchingCOLLState } from '../ll_identification';
import { MethodDefinition } from './types';

const F2L_STEPS = ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4'];

/** Earlier phases to fall back on when reading the state a last-layer phase started from. */
const BEFORE_LL = ['f2l_4', 'f2l_3', 'f2l_2', 'f2l_1', 'cross'];

export const CFOP_METHOD: MethodDefinition = {
	id: 'cfop',
	axisCount: 6,
	maxProgress: 7,
	steps: ['cross', ...F2L_STEPS, 'oll', 'pll'],
	progressToPhase(newProgress) {
		switch (newProgress) {
			case 6: return 'cross';
			case 5: return 'f2l_1';
			case 4: return 'f2l_2';
			case 3: return 'f2l_3';
			case 2: return 'f2l_4';
			case 1: return 'oll';
			case 0: return 'pll';
			default: return null;
		}
	},
	getProgress: (facelet) => getCF4OPProgressOneAxis(facelet),
	caseSpecs: [
		{ phase: 'oll', set: 'oll', fromPhases: BEFORE_LL, identify: getMatchingOLLState },
		{ phase: 'pll', set: 'pll', fromPhases: ['oll'], identify: getMatchingPLLState },
	],
};

/**
 * Two-look CFOP. The ladder splits the last layer four ways so a solver who
 * does EO and CO separately (and CP before EP) sees each look timed on its own.
 *
 * Step ids reuse `oll` and `pll` for the full-orientation and solved points so
 * rows written by this method stay comparable with plain CFOP in the DB.
 */
export const CFOP2_METHOD: MethodDefinition = {
	id: 'cfop2',
	axisCount: 6,
	maxProgress: 9,
	steps: ['cross', ...F2L_STEPS, 'eo', 'oll', 'cp', 'pll'],
	progressToPhase(newProgress) {
		switch (newProgress) {
			case 8: return 'cross';
			case 7: return 'f2l_1';
			case 6: return 'f2l_2';
			case 5: return 'f2l_3';
			case 4: return 'f2l_4';
			case 3: return 'eo';
			case 2: return 'oll';
			case 1: return 'cp';
			case 0: return 'pll';
			default: return null;
		}
	},
	getProgress: (facelet) => getCF4O2P2ProgressOneAxis(facelet),
	caseSpecs: [
		// Full OLL is still recognized from the state F2L ended in, exactly as in plain CFOP.
		{ phase: 'oll', set: 'oll', fromPhases: BEFORE_LL, identify: getMatchingOLLState },
		// COLL describes the corners once edges are oriented, i.e. from the EO end state.
		{ phase: 'cp', set: 'coll', fromPhases: ['eo'], identify: getMatchingCOLLState },
		{ phase: 'pll', set: 'pll', fromPhases: ['oll', 'eo'], identify: getMatchingPLLState },
	],
};
