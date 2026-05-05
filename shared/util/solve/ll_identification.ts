/**
 * OLL/PLL case identification — cstimer cubeutil.js'in birebir port'u.
 *
 * Kaynak: Referans/cstimer-master/src/js/lib/cubeutil.js
 *   - identPLL: searchCaseByPattern(facelet, ollMask, pllPatterns)
 *   - identOLL: searchCaseByPattern(facelet, f2lMask, ollPatterns)
 *
 * cstimer'in 24-cube-rotation cubeRots tablosu + mask'lar + pattern'leri build-time'da
 * scripts/dump-cstimer-rotations.mjs ile cstimer source'undan dump edildi
 * (shared/data/cstimer_ll_engine.json).
 *
 * Runtime sadece saf string operasyonlari yapar — cubejs/cubing.js bagimliligi yok.
 * Algoritma renk-agnostik (toEqus equivalence sınıfları) — kullanicinin cube
 * orientation'ı veya cross face'i fark etmez.
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
 *   facelet'i rotIdx ile rotate edip mask'taki her equivalence class icin
 *   stikker'larin ayni renk olup olmadigini kontrol eder. Hepsi ayniysa "solved".
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
 *   1. baseMask'a gore solved olan rotation'lari bul (24 cube symmetry icinde)
 *   2. Her pattern icin chkList'teki rotation'larda match ara
 *   3. Match olan ilk pattern'in index'ini dondur, yoksa -1
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
	if (!key) return null; // skip case veya mapping yok
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

// Eski API ile uyumluluk (initLLStates eski kodda call ediliyordu, no-op).
export function initLLStates() {
	void CUBE_ROTS;
}
