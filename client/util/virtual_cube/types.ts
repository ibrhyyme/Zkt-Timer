import * as THREE from 'three';

/** The six cube faces, in cstimer's canonical URFDLB order. */
export type VrcFace = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

/**
 * A move, in cstimer's representation (twistynnn.js).
 *
 *   [startLayer, endLayer, face, power]
 *
 * Layers are 1-indexed counting inward from `face`. The pair is a closed range,
 * so [1, 1, 'R', 1] is R, [1, 2, 'R', 1] is Rw, [2, 2, 'R', 1] is the inner
 * slice, and [1, dimension, 'R', 1] spans every layer and is therefore the x
 * rotation. Power is quarter turns: 1, 2, -1, -2. There is no dedicated double
 * move in the key map; a double is power 2.
 *
 * `endLayer` may exceed the dimension (parseScramble emits 100 for rotations);
 * the layer window test tolerates that by construction.
 */
export type VrcMove = [number, number, VrcFace, number];

/**
 * One sticker plate.
 *
 * Two matrices on purpose. `logical` is the authoritative state, only ever
 * advanced by exact quarter-turn powers, so it never accumulates float error.
 * `visual` is what gets drawn and is stepped incrementally during an animation,
 * which does drift; `advanceMove` snaps it back by copying `logical` over it.
 * Collapsing these into one matrix reintroduces the drift permanently.
 */
export interface VrcSticker {
	/** 0-5, index into FACE_COLORS. Fixed for the sticker's lifetime. */
	face: number;
	logical: THREE.Matrix4;
	visual: THREE.Matrix4;
	/** Current fill colour. Mutated by the BLD / big-cube visibility toggles. */
	color: number;
	/** Whether to stroke the outline. Mutated by the big-cube visibility toggle. */
	border: boolean;
	/**
	 * Ring grouping key, only meaningful for dimension > 7. cstimer shares one
	 * material per (face, su1 + sv1, su1 * sv1) triple so that greying out the
	 * interior of a huge cube can address whole rings at once.
	 */
	ringKey: string;
}

/** A hand mark triangle (the slice-offset indicators shown when dimension > 5). */
export interface VrcHandMark {
	matrix: THREE.Matrix4;
	color: number;
	/** Local-space triangle, z = 0. Three [x, y] pairs. */
	points: [number, number][];
}

/**
 * Animation phase reported to move listeners.
 * 0 = move added, 1 = move in progress, 2 = move finished.
 */
export type MoveStep = 0 | 1 | 2;

export type MoveListener = (move: VrcMove, step: MoveStep, timestamp: number) => void;

export interface VrcOptions {
	dimension: number;
	/** URFDLB fill colours. */
	faceColors: number[];
	stickerBorder: boolean;
	stickerWidth: number;
	scale: number;
}
