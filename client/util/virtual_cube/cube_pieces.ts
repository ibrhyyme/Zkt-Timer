import * as THREE from 'three';

import { FACE_COLORS, NUM_SIDES, SIDES_UV } from './constants';
import { axify, makeTranslation, mul } from './math';
import type { VrcHandMark, VrcSticker } from './types';

/**
 * Cube construction. Port of twistynnn.js:119-194.
 *
 * The cube has no body. It is 6 * n^2 flat, double-sided sticker plates floating
 * on a grid of pitch 2 with a 0.3 gap between them, and nothing behind them. That
 * is why the far side of the cube shows through the gaps, which is the defining
 * visual characteristic of this renderer. Adding any solid geometry breaks it.
 */

/**
 * Build the sticker set for an n x n x n cube.
 *
 * Returned as `pieces[face][su * dimension + sv]`, matching cstimer's nesting so
 * that facelet extraction and solved detection can be transcribed directly.
 */
export function buildCubePieces(dimension: number, faceColors: number[] = FACE_COLORS): VrcSticker[][] {
	const pieces: VrcSticker[][] = [];

	for (let i = 0; i < NUM_SIDES; i++) {
		const facePieces: VrcSticker[] = [];
		pieces.push(facePieces);

		for (let su = 0; su < dimension; su++) {
			for (let sv = 0; sv < dimension; sv++) {
				// Ring key only matters above 7x7, where cstimer shares one material
				// per concentric ring so the interior can be greyed out wholesale.
				let ringKey = String(i);
				if (dimension > 7) {
					const su1 = Math.min(su, dimension - 1 - su);
					const sv1 = Math.min(sv, dimension - 1 - sv);
					ringKey += `,${su1 + sv1},${su1 * sv1}`;
				}

				const logical = mul(
					SIDES_UV[i],
					makeTranslation(su * 2 - dimension + 1, -(sv * 2 - dimension + 1), dimension)
				);

				facePieces.push({
					face: i,
					logical,
					visual: logical.clone(),
					color: faceColors[i],
					border: true,
					ringKey,
				});
			}
		}
	}

	return pieces;
}

/**
 * Hand marks: four triangles outside the cube that show where the current slice
 * offsets (oSl / oSr) sit. Only drawn above 5x5, where big-cube slice selection
 * starts to matter. twistynnn.js:181-194.
 */
export function buildHandMarks(dimension: number, faceColors: number[] = FACE_COLORS): VrcHandMark[] {
	if (dimension <= 5) {
		return [];
	}

	const markWidth = dimension / 15;
	const points: [number, number][] = [
		[0, 0],
		[markWidth / 2, markWidth],
		[-markWidth / 2, markWidth],
	];

	const marks: VrcHandMark[] = [];
	for (let i = 0; i < 4; i++) {
		marks.push({
			matrix: new THREE.Matrix4(),
			// Left-hand marks take the L colour, right-hand marks the R colour.
			color: ((i + 1) & 2) ? faceColors[4] : faceColors[1],
			points: points.map((p) => [p[0], p[1]] as [number, number]),
		});
	}
	return marks;
}

/**
 * Reposition the hand marks for the current slice offsets.
 * Port of `updateHandMarks` (twistynnn.js:164-179).
 *
 * The `(i + 1) & 2` / `i & 1` / `i & 2` bit tests pick which corner each mark
 * belongs to and whether it tracks the left or the right offset. Precedence
 * matters: `+` binds tighter than `&`, so it is `(i + 1) & 2`.
 */
export function updateHandMarks(
	handMarks: VrcHandMark[],
	dimension: number,
	oSl: number,
	oSr: number
): void {
	const hsq2 = Math.sqrt(2) / 2;

	for (let i = 0; i < handMarks.length; i++) {
		const offset = ((i + 1) & 2) ? oSl : oSr;
		const su = (i & 1) ? 1 : -1;
		const sv = (i & 2) ? 1 : -1;

		handMarks[i].matrix.copy(
			mul(
				axify(
					new THREE.Vector3(1 * sv, 0, 0),
					new THREE.Vector3(0, hsq2 * sv, -hsq2 * sv),
					new THREE.Vector3(0, hsq2, hsq2)
				),
				makeTranslation(su * (dimension - 2 * offset), dimension * (hsq2 * 2 + 0.05), 0)
			)
		);
	}
}
