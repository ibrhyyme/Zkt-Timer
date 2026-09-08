import { INDEX_SIDE, NUM_SIDES, SIDES_NORM } from './constants';
import { matrixVector3Dot } from './math';
import type { VrcSticker } from './types';

/**
 * Facelet extraction. Port of `getFacelet` (twistynnn.js:517-543).
 *
 * Turns the geometric state back into a standard URFDLB facelet string, which is
 * the bridge to every piece of 3x3 analysis the app already has (facelet_masks,
 * cube rotations, phase detection). Reads the LOGICAL matrices, so it is exact
 * regardless of where an in-flight animation happens to be.
 */

/** Whether the sticker's in-face u/v axes are swapped, per resolved axis. */
const XY_XCHG = [1, 0, 0, 1, 0, 0];
const X_INV = [1, -1, -1, -1, -1, -1];
const Y_INV = [1, -1, 1, 1, 1, -1];

export function getFacelet(pieces: VrcSticker[][], dimension: number): string {
	const ret: string[] = [];

	for (let faceIndex = 0; faceIndex < NUM_SIDES; faceIndex++) {
		const faceStickers = pieces[faceIndex];

		for (let stickerIndex = 0; stickerIndex < faceStickers.length; stickerIndex++) {
			const sticker = faceStickers[stickerIndex];

			// Project the sticker's position onto the three principal normals.
			// Exactly one component is +/- dimension: that is the face it now sits on.
			const coord = [
				Math.round(matrixVector3Dot(sticker.logical, SIDES_NORM.U)),
				Math.round(matrixVector3Dot(sticker.logical, SIDES_NORM.R)),
				Math.round(matrixVector3Dot(sticker.logical, SIDES_NORM.F)),
			];

			// One of the two lookups hits and returns its index, the other returns
			// -1, so the sum plus one is the index of whichever matched.
			const idx = coord.indexOf(dimension) + coord.indexOf(-dimension) + 1;
			const axis = idx + (coord[idx] > 0 ? 0 : 3);

			coord.splice(idx, 1);

			const xy = XY_XCHG[axis];
			const x = (coord[xy] * X_INV[axis] + dimension - 1) / 2;
			const y = (coord[1 - xy] * Y_INV[axis] + dimension - 1) / 2;

			ret[axis * dimension * dimension + x * dimension + y] = INDEX_SIDE[faceIndex];
		}
	}

	return ret.join('');
}
