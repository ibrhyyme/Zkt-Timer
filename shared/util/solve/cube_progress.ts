/**
 * CFOP progress detection — cstimer cubeutil.js'den port.
 *
 * Progress level (cstimer getCF4OPProgress):
 *   7 = hicbir sey cozulmedi
 *   6 = cross cozuldu
 *   5 = cross + 1 f2l slot
 *   4 = cross + 2 f2l slot
 *   3 = cross + 3 f2l slot
 *   2 = cross + 4 f2l slot (full F2L)
 *   1 = OLL cozuldu (top face solid color)
 *   0 = solved (PLL dahil)
 *
 * Engine progress level monoton azaldigi icin level dususleri faz gecislerini gosterir.
 *
 * 6-axis kontrol: cross hangi yuze yapilmis olabilir? Mask equivalence-class kullandigindan
 * y rotasyonlarina karsi rotation-invariant. Sadece "hangi yuz down" kontrolu gerekir.
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
	SOLVED_MASK,
	EquivalenceClass,
} from './facelet_masks';

/**
 * Mask satisfied mi? cstimer convention: 0 = satisfied, 1 = NOT satisfied.
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
 * cstimer getCF4OPProgress port. Tek bir oryantasyon icin progress level hesabi.
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
 * 6-axis rotation: cross face hangi yuzde olabilir.
 * Index sirasi sabit; minimum progress sahibi axis = cross face'in oturdugu axis.
 */
export const CROSS_AXIS_LABELS: Array<'D' | 'U' | 'F' | 'B' | 'R' | 'L'> = [
	'D', // identity
	'U', // x2
	'F', // x'
	'B', // x
	'R', // z
	'L', // z'
];

const AXIS_ROTATIONS: Array<string | null> = [
	null, // D: identity
	'x2', // U->D
	"x'", // F->D
	'x', // B->D
	'z', // R->D
	"z'", // L->D
];

function rotateFacelet(facelet: string, rotMove: string | null): string {
	if (!rotMove) return facelet;
	try {
		const c = Cube.fromString(facelet);
		c.move(rotMove);
		return c.asString();
	} catch {
		return facelet;
	}
}

/**
 * 6 axis kontrol. Minimum progress (en cok cozulmus axis) ve hangi axis oldugunu doner.
 */
export function getCFOPProgress(facelet: string): {
	progress: number;
	axisIndex: number;
	crossFace: 'D' | 'U' | 'F' | 'B' | 'R' | 'L';
} {
	let minProg = 99;
	let minAxis = 0;
	for (let a = 0; a < AXIS_ROTATIONS.length; a++) {
		const rotated = rotateFacelet(facelet, AXIS_ROTATIONS[a]);
		const p = getCF4OPProgressOneAxis(rotated);
		if (p < minProg) {
			minProg = p;
			minAxis = a;
			if (p === 0) break;
		}
	}
	return {
		progress: minProg,
		axisIndex: minAxis,
		crossFace: CROSS_AXIS_LABELS[minAxis],
	};
}

/**
 * Verili axis (sabit cross face) icin progress hesabi. Cross faz tespit edildikten
 * sonra calismaya devam eder, axis-locked progress saglar.
 */
export function getCFOPProgressOnAxis(facelet: string, axisIndex: number): number {
	const rotated = rotateFacelet(facelet, AXIS_ROTATIONS[axisIndex]);
	return getCF4OPProgressOneAxis(rotated);
}

/**
 * Progress level → CFOP phase ismi. data[--progress] mantigi:
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
