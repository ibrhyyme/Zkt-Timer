/**
 * Facelet mask sabitleri — cstimer cubeutil.js:24-28'den birebir port.
 *
 * Cube facelet ordering: URFDLB (cubejs Cube.asString() ile uyumlu).
 * Pozisyonlar: U=0-8, R=9-17, F=18-26, D=27-35, L=36-44, B=45-53.
 *
 * Mask formati: 54-char string. Her karakter:
 *   - U/R/F/D/L/B: bu pozisyon o renkte olmali
 *   - "-": dont care (wildcard)
 *
 * toEqus() bu mask'i equivalence class'lara cevirir — ayni renge sahip
 * tum pozisyonlar bir array'de toplanir. Progress kontrolu sirasinda her
 * sinifin tum elemanlarinin esit renge sahip oldugunu kontrol ederiz.
 */

export type EquivalenceClass = number[];

export function toEqus(mask: string): EquivalenceClass[] {
	const colToIndices: { [color: string]: number[] } = {};
	for (let i = 0; i < mask.length; i++) {
		const col = mask[i];
		if (col === '-') continue;
		if (!colToIndices[col]) {
			colToIndices[col] = [];
		}
		colToIndices[col].push(i);
	}
	const equs: EquivalenceClass[] = [];
	for (const col in colToIndices) {
		if (colToIndices[col].length > 1) {
			equs.push(colToIndices[col]);
		}
	}
	return equs;
}

export const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

export const CROSS_MASK = toEqus('----U--------R--R-----F--F--D-DDD-D-----L--L-----B--B-');
export const F2L1_MASK = toEqus('----U-------RR-RR-----FF-FF-DDDDD-D-----L--L-----B--B-');
export const F2L2_MASK = toEqus('----U--------R--R----FF-FF-DD-DDD-D-----LL-LL----B--B-');
export const F2L3_MASK = toEqus('----U--------RR-RR----F--F--D-DDD-DD----L--L----BB-BB-');
export const F2L4_MASK = toEqus('----U--------R--R-----F--F--D-DDDDD----LL-LL-----BB-BB');
export const F2L_MASK = toEqus('----U-------RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB');
export const OLL_MASK = toEqus('UUUUUUUUU---RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB');
export const SOLVED_MASK = toEqus(SOLVED_FACELET);
