/**
 * OLL/PLL case identification — exact port of cstimer cubeutil.js.
 *
 * Source: Reference/cstimer-master/src/js/lib/cubeutil.js
 *   - identPLL: searchCaseByPattern(facelet, ollMask, pllPatterns)
 *   - identOLL: searchCaseByPattern(facelet, f2lMask, ollPatterns)
 *
 * cstimer's 24-cube-rotation cubeRots table + masks + patterns dumped at build-time
 * via scripts/dump-cstimer-rotations.mjs from cstimer source
 * (shared/data/cstimer_ll_engine.json).
 *
 * Runtime only performs pure string operations — no cubejs/cubing.js dependency.
 * Algorithm is color-agnostic (toEqus equivalence classes) — user's cube
 * orientation or cross face doesn't matter.
 */

import engine from '../../data/cstimer_ll_engine.json';

interface CaseMatch {
	case: string;
	key: string;
}

const CUBE_ROTS: number[][] = (engine as any).cubeRots;
const OLL_MASK: number[][] = (engine as any).masks.ollMask;
const F2L_MASK: number[][] = (engine as any).masks.f2lMask;
const PLL_PATTERNS: number[][][] = (engine as any).pllPatterns;
const OLL_PATTERNS: number[][][] = (engine as any).ollPatterns;
const PLL_INDEX_TO_KEY: Array<string | null> = (engine as any).pllIndexToKey;
const OLL_INDEX_TO_KEY: Array<string | null> = (engine as any).ollIndexToKey;
const PLL_CASE_NAMES: string[] = (engine as any).pllCaseNames;
const OLL_CASE_NAMES: string[] = (engine as any).ollCaseNames;

/**
 * cstimer cubeutil.js solvedProgress (facelet variant) port:
 *   Rotates facelet by rotIdx and checks for each equivalence class in mask
 *   whether the stickers are the same color. If all are, return "solved".
 */
function solvedProgress(facelet: string, rotIdx: number, mask: number[][]): boolean {
	const cubeRot = CUBE_ROTS[rotIdx];
	for (const equ of mask) {
		const col = facelet[cubeRot[equ[0]]];
		for (let j = 1; j < equ.length; j++) {
			if (facelet[cubeRot[equ[j]]] !== col) return false;
		}
	}
	return true;
}

/**
 * cstimer searchCaseByPattern port:
 *   1. Find rotations that are solved according to baseMask (within 24 cube symmetries)
 *   2. For each pattern, search for matches in rotations from chkList
 *   3. Return index of first matching pattern, or -1 if none
 */
function searchCaseByPattern(
	facelet: string,
	baseMask: number[][],
	patterns: number[][][]
): number {
	const chkList: number[] = [];
	for (let a = 0; a < 24; a++) {
		if (solvedProgress(facelet, a, baseMask)) chkList.push(a);
	}
	for (let i = 0; i < patterns.length; i++) {
		for (const r of chkList) {
			if (solvedProgress(facelet, r, patterns[i])) return i;
		}
	}
	return -1;
}

export function getMatchingOLLState(facelet54: string, _crossFace?: string): CaseMatch | null {
	if (!facelet54 || facelet54.length !== 54) return null;
	const idx = searchCaseByPattern(facelet54, F2L_MASK, OLL_PATTERNS);
	if (idx < 0) return null;
	const key = OLL_INDEX_TO_KEY[idx];
	if (!key) return null; // skip case or no mapping
	return { case: OLL_CASE_NAMES[idx] || key, key };
}

export function getMatchingPLLState(facelet54: string, _crossFace?: string): CaseMatch | null {
	if (!facelet54 || facelet54.length !== 54) return null;
	const idx = searchCaseByPattern(facelet54, OLL_MASK, PLL_PATTERNS);
	if (idx < 0 || idx >= 21) return null; // index 21 = skip
	const key = PLL_INDEX_TO_KEY[idx];
	if (!key) return null;
	return { case: PLL_CASE_NAMES[idx] || key, key };
}

// Backward compatibility with old API (initLLStates was called in old code, no-op).
export function initLLStates() {
	void CUBE_ROTS;
}
