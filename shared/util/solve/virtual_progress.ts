/**
 * Virtual cube progress detection — port of cstimer cubeutil.js:105-217, 462-503.
 *
 * The virtual cube asks "is it solved, and if not how many phases remain" after
 * every single move, so this is the hot path of a live solve. Two consequences
 * shape the implementation:
 *
 *   1. Orientation scanning permutes MASK INDICES through cstimer's precomputed
 *      `CUBE_ROTS` table rather than rebuilding a rotated facelet. `cube_progress.ts`
 *      takes the cubejs route, which is fine for post-solve analysis but far too
 *      slow to run 24 times per move on a phone.
 *   2. The scan short-circuits on 0, the same as `scanAxes`.
 *
 * Progress convention (cstimer): the number counts DOWN as the solve advances and
 * 0 means solved. Every drop marks one completed phase, which is what drives the
 * multi-phase splits.
 */

import {
	CPLL_MASK,
	CROSS_MASK,
	EOLL_MASK,
	EquivalenceClass,
	F2L1_MASK,
	F2L2_MASK,
	F2L3_MASK,
	F2L4_MASK,
	F2L_MASK,
	OLL_MASK,
	ROUX_CMLL_MASK,
	ROUX_FB_MASK,
	ROUX_SB_MASK,
	SOLVED_MASK,
} from './facelet_masks';
import { CUBE_ROTS } from './ll_identification';

/** The multi-phase methods the virtual cube offers, matching cstimer's `vrcMP`. */
export type VirtualProgressMethod = 'n' | 'cfop' | 'fp' | 'cf4op' | 'cf4o2p2' | 'roux';

export const VIRTUAL_PROGRESS_METHODS: VirtualProgressMethod[] = [
	'n',
	'cfop',
	'fp',
	'cf4op',
	'cf4o2p2',
	'roux',
];

/**
 * Is the mask satisfied under rotation `rotIndex`?
 * cstimer convention, inherited by every ladder below: 0 = satisfied, 1 = not.
 *
 * Port of `solvedProgress` (cubeutil.js:105-122).
 */
function solvedProgress(facelet: string, rotIndex: number, mask: EquivalenceClass[] = SOLVED_MASK): number {
	const cubeRot = CUBE_ROTS[rotIndex];
	for (let i = 0; i < mask.length; i++) {
		const equ = mask[i];
		const col = facelet[cubeRot[equ[0]]];
		for (let j = 1; j < equ.length; j++) {
			if (facelet[cubeRot[equ[j]]] !== col) {
				return 1;
			}
		}
	}
	return 0;
}

type LadderFn = (facelet: string, rotIndex: number) => number;

/** 4: nothing, 3: cross, 2: f2l, 1: oll, 0: solved. cubeutil.js:163. */
function getCFOPProgress(facelet: string, rot: number): number {
	if (solvedProgress(facelet, rot, CROSS_MASK)) return 4;
	if (solvedProgress(facelet, rot, F2L_MASK)) return 3;
	if (solvedProgress(facelet, rot, OLL_MASK)) return 2;
	if (solvedProgress(facelet, rot)) return 1;
	return 0;
}

/** 2: nothing, 1: f2l, 0: solved. cubeutil.js:194. */
function getFPProgress(facelet: string, rot: number): number {
	if (solvedProgress(facelet, rot, F2L_MASK)) return 2;
	if (solvedProgress(facelet, rot)) return 1;
	return 0;
}

/** 7: nothing, 6: cross, 2-5: nth f2l pair, 1: oll, 0: solved. cubeutil.js:145. */
function getCF4OPProgress(facelet: string, rot: number): number {
	if (solvedProgress(facelet, rot, CROSS_MASK)) return 7;
	if (solvedProgress(facelet, rot, F2L_MASK)) {
		return (
			2 +
			solvedProgress(facelet, rot, F2L1_MASK) +
			solvedProgress(facelet, rot, F2L2_MASK) +
			solvedProgress(facelet, rot, F2L3_MASK) +
			solvedProgress(facelet, rot, F2L4_MASK)
		);
	}
	if (solvedProgress(facelet, rot, OLL_MASK)) return 2;
	if (solvedProgress(facelet, rot)) return 1;
	return 0;
}

/** 9: nothing, 8: cross, 4-7: nth f2l pair, 3-4: eo/oll, 1: cpll, 0: solved. cubeutil.js:125. */
function getCF4O2P2Progress(facelet: string, rot: number): number {
	if (solvedProgress(facelet, rot, CROSS_MASK)) return 9;
	if (solvedProgress(facelet, rot, F2L_MASK)) {
		return (
			4 +
			solvedProgress(facelet, rot, F2L1_MASK) +
			solvedProgress(facelet, rot, F2L2_MASK) +
			solvedProgress(facelet, rot, F2L3_MASK) +
			solvedProgress(facelet, rot, F2L4_MASK)
		);
	}
	if (solvedProgress(facelet, rot, EOLL_MASK)) return 4;
	if (solvedProgress(facelet, rot, OLL_MASK)) return 3;
	if (solvedProgress(facelet, rot, CPLL_MASK)) return 2;
	if (solvedProgress(facelet, rot)) return 1;
	return 0;
}

/** 4: nothing, 3: first block, 2: second block, 1: cmll, 0: solved. cubeutil.js:207. */
function getRouxProgress(facelet: string, rot: number): number {
	if (solvedProgress(facelet, rot, ROUX_FB_MASK)) return 4;
	if (solvedProgress(facelet, rot, ROUX_SB_MASK)) return 3;
	if (solvedProgress(facelet, rot, ROUX_CMLL_MASK)) return 2;
	if (solvedProgress(facelet, rot)) return 1;
	return 0;
}

/**
 * Take the most-solved reading across `axisCount` orientations.
 * Port of `getProgressNAxis` (cubeutil.js:246-252), plus a short circuit on 0.
 */
function getProgressNAxis(facelet: string, ladder: LadderFn, axisCount: number): number {
	let minRet = 99;
	for (let a = 0; a < axisCount; a++) {
		const p = ladder(facelet, a);
		if (p < minRet) {
			minRet = p;
			if (p === 0) break;
		}
	}
	return minRet;
}

/**
 * Remaining phase count for a facelet under a method. 0 means solved.
 * Port of `getProgress` (cubeutil.js:462-479).
 *
 * Roux scans all 24 orientations rather than 6, because its blocks keep their
 * integrity under whole-block rotation so the y position matters too.
 *
 * cstimer also ships a `cf3zb` ladder, but it is not offered in the `vrcMP`
 * setting, so it is deliberately not exposed here.
 */
export function getVirtualProgress(facelet: string, method: VirtualProgressMethod): number {
	switch (method) {
		case 'cfop':
			return getProgressNAxis(facelet, getCFOPProgress, 6);
		case 'fp':
			return getProgressNAxis(facelet, getFPProgress, 6);
		case 'cf4op':
			return getProgressNAxis(facelet, getCF4OPProgress, 6);
		case 'roux':
			return getProgressNAxis(facelet, getRouxProgress, 24);
		case 'cf4o2p2':
			return getProgressNAxis(facelet, getCF4O2P2Progress, 6);
		case 'n':
		default:
			return getProgressNAxis(facelet, (f, r) => solvedProgress(f, r), 1);
	}
}

/**
 * Phase labels, last phase first — the same order cstimer emits.
 * Port of `getStepNames` (cubeutil.js:481-499).
 *
 * Reverse this when writing splits, which are recorded in solving order.
 */
export function getVirtualStepNames(method: VirtualProgressMethod): string[] {
	switch (method) {
		case 'cfop':
			return ['pll', 'oll', 'f2l', 'cross'];
		case 'fp':
			return ['op', 'cf'];
		case 'cf4op':
			return ['pll', 'oll', 'f2l-4', 'f2l-3', 'f2l-2', 'f2l-1', 'cross'];
		case 'roux':
			return ['l6e', 'cmll', 'sb', 'fb'];
		case 'cf4o2p2':
			return ['pll', 'cpll', 'oll', 'eoll', 'f2l-4', 'f2l-3', 'f2l-2', 'f2l-1', 'cross'];
		case 'n':
		default:
			return ['solve'];
	}
}

/** Number of phases a method splits the solve into. cubeutil.js:501-504. */
export function getVirtualStepCount(method: VirtualProgressMethod): number {
	return getVirtualStepNames(method).length;
}
