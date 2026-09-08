import { NUM_SIDES, SIDES_NORM, SIDES_ROT, SIDES_ROT_AXIS, TAU } from './constants';
import { makeRotationAxis, matrix4Power, matrixVector3Dot, mulInto } from './math';
import { isRotation } from './notation';
import type { VrcMove, VrcSticker } from './types';

/**
 * Move application. Port of twistynnn.js:199-276.
 *
 * Two entry points that look similar and are not interchangeable:
 *
 *   animateMove  steps the VISUAL matrix by a fraction of a turn, many times per
 *                move. Accumulates float error by design.
 *   advanceMove  applies the exact turn to the LOGICAL matrix and copies it over
 *                the visual one, erasing whatever the animation drifted to.
 *
 * Both select the turning layers by reading the VISUAL matrix, not the logical
 * one. That is not a bug in the reference: mid-animation the visual matrix is
 * where the sticker actually is, and selecting off the logical matrix would pick
 * the wrong layers when a rotation is still in flight.
 */

/**
 * Which stickers a move touches, as a half-open window along the face normal.
 *
 * Layers are 1-indexed from the face, so layer k sits at normal distance
 * `dimension - 2k + 1`; the +2.5 / -0.5 padding turns that into a tolerant band.
 * An `endLayer` past the dimension (parseScramble emits 100 for rotations) simply
 * pushes `minLayer` below every sticker, which is how rotations sweep everything.
 */
function layerWindow(dimension: number, layerStart: number, layerEnd: number) {
	return {
		maxLayer: dimension - 2 * layerStart + 2.5,
		minLayer: dimension - 2 * layerEnd - 0.5,
	};
}

/**
 * Advance the animation by `moveStep` of a quarter turn.
 * `moveStep` is the delta for this frame, not the absolute progress.
 */
export function animateMove(
	pieces: VrcSticker[][],
	move: VrcMove,
	moveStep: number,
	dimension: number
): void {
	const rots = makeRotationAxis(SIDES_ROT_AXIS[move[2]], (moveStep * move[3] * TAU) / 4);

	const layerStart = move[0];
	// Negative end layers count back from the far side. Only the animation path
	// handles this; advanceMove does not, matching the reference.
	const layerEnd = move[1] < 0 ? dimension + 1 + move[1] : move[1];

	const { maxLayer, minLayer } = layerWindow(dimension, layerStart, layerEnd);
	const normVector = SIDES_NORM[move[2]];

	for (let faceIndex = 0; faceIndex < NUM_SIDES; faceIndex++) {
		const faceStickers = pieces[faceIndex];
		for (let i = 0, len = faceStickers.length; i < len; i++) {
			const sticker = faceStickers[i];
			const layer = matrixVector3Dot(sticker.visual, normVector);
			if (layer < maxLayer && layer > minLayer) {
				mulInto(sticker.visual, rots);
			}
		}
	}
}

/**
 * Commit a move to the authoritative state and snap the visual matrix to it.
 * twistynnn.js:251-276.
 */
export function advanceMove(pieces: VrcSticker[][], move: VrcMove, dimension: number): void {
	const rott = matrix4Power(SIDES_ROT[move[2]], move[3]);

	const { maxLayer, minLayer } = layerWindow(dimension, move[0], move[1]);
	const normVector = SIDES_NORM[move[2]];

	for (let faceIndex = 0; faceIndex < NUM_SIDES; faceIndex++) {
		const faceStickers = pieces[faceIndex];
		for (let i = 0, len = faceStickers.length; i < len; i++) {
			const sticker = faceStickers[i];
			const layer = matrixVector3Dot(sticker.visual, normVector);
			if (layer < maxLayer && layer > minLayer) {
				mulInto(sticker.logical, rott);
				sticker.visual.copy(sticker.logical);
			}
		}
	}
}

/**
 * Move counter. Port of `cntMove` / `moveCnt` (twistynnn.js:572-588).
 *
 * Counts turns the way cstimer reports them on a finished solve: rotations do not
 * count, and consecutive turns of the same face collapse into one (so R R' scores
 * 1, not 2).
 *
 * Quirk worth knowing, preserved deliberately: a rotation does not increment but
 * still overwrites `lastMove`, so a y rotation followed by a U turn reads as a
 * repeat and the U is not counted either. The reported move count inherits that,
 * and changing it would make our numbers disagree with cstimer's.
 *
 * Also note `value(true)` clears BEFORE returning, so a clearing read always
 * yields 0. Callers wanting the total must read without the flag first.
 */
export class MoveCounter {
	private counter = 0;

	private lastMove: string | number = -1;

	count(move: VrcMove, dimension: number): void {
		if (!isRotation(move, dimension) && move[2] !== this.lastMove) {
			this.counter++;
		}
		this.lastMove = move[2];
	}

	/** Read the count, optionally resetting first. */
	value(clear = false): number {
		if (clear) {
			this.counter = 0;
			this.lastMove = -1;
		}
		return this.counter;
	}
}
