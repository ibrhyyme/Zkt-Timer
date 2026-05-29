/**
 * Facelet mask constants — direct port from cstimer cubeutil.js:24-28.
 *
 * Cube facelet ordering: URFDLB (compatible with cubejs Cube.asString()).
 * Positions: U=0-8, R=9-17, F=18-26, D=27-35, L=36-44, B=45-53.
 *
 * Mask format: 54-char string. Each character:
 *   - U/R/F/D/L/B: this position must be that color
 *   - "-": don't care (wildcard)
 *
 * toEqus() converts this mask to equivalence classes — all positions with same color
 * are gathered in one array. During progress check, we verify that all elements of each
 * class have the same color.
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
