import {
	getVirtualProgress,
	VirtualProgressMethod,
} from '../../../shared/util/solve/virtual_progress';

import { INDEX_SIDE, NUM_SIDES, SIDES_NORM } from './constants';
import { getFacelet } from './facelet';
import { matrixVector3Dot } from './math';
import type { VrcSticker } from './types';

/**
 * Solved detection. Port of `isSolved` (twistynnn.js:480-515).
 *
 * Returns the number of phases still remaining, so 0 means solved. 99 is the
 * "ask again later" value used while an animation is mid-flight.
 *
 * The animation state is part of the answer, not an afterthought: reporting
 * solved while a turn is still visibly rotating would stop the timer early, and
 * reporting it between two queued moves (R then R') would stop it on a state the
 * solver is only passing through.
 */
export interface SolvedQueryState {
	/** No move is currently being animated. */
	animationFinished: boolean;
	/** Nothing is animating AND the queue is empty. */
	moveFinished: boolean;
}

export function isSolved(
	pieces: VrcSticker[][],
	dimension: number,
	method: VirtualProgressMethod,
	state: SolvedQueryState
): number {
	if (!state.animationFinished) {
		return 99;
	}

	if (dimension === 3) {
		const curProgress = getVirtualProgress(getFacelet(pieces, dimension), method);
		// With moves still queued the cube can pass through a solved state that the
		// user is not actually finishing on, so clamp it to "at least one phase left".
		return state.moveFinished ? curProgress : Math.max(1, curProgress);
	}

	if (!state.moveFinished) {
		return 1;
	}

	// Non-3x3: a purely geometric check, and orientation-agnostic by construction.
	// For each of the first five faces, work out which axis its first sticker now
	// points along, then require every other sticker on that face to agree. The
	// sixth face is implied once the other five are consistent.
	//
	// (The reference also computes maxLayer/minLayer here and never reads them;
	// they are dead in cstimer and omitted.)
	for (let faceIndex = 0; faceIndex < NUM_SIDES - 1; faceIndex++) {
		const faceStickers = pieces[faceIndex];

		let normVector = SIDES_NORM[INDEX_SIDE[0]];
		for (let faceSideIndex = 0; faceSideIndex < NUM_SIDES; faceSideIndex++) {
			normVector = SIDES_NORM[INDEX_SIDE[faceSideIndex]];
			if (Math.abs(matrixVector3Dot(faceStickers[0].logical, normVector) - dimension) < 0.5) {
				break;
			}
		}

		for (let stickerIndex = 1; stickerIndex < faceStickers.length; stickerIndex++) {
			if (Math.abs(matrixVector3Dot(faceStickers[stickerIndex].logical, normVector) - dimension) > 0.5) {
				return 1;
			}
		}
	}

	return 0;
}
