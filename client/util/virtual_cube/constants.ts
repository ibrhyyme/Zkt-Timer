import * as THREE from 'three';

import { axify } from './math';
import type { VrcFace } from './types';

/**
 * Cube constants, ported verbatim from twistynnn.js:15-66.
 *
 * These tables are the geometric definition of the puzzle. Every one of them is
 * a literal transcription; do not "simplify" them, the sign conventions are load
 * bearing and a flipped axis produces a cube that turns the wrong way only for
 * some faces.
 */

export const NUM_SIDES = 6;

const xx = new THREE.Vector3(1, 0, 0);
const yy = new THREE.Vector3(0, 1, 0);
const zz = new THREE.Vector3(0, 0, 1);
const xxi = new THREE.Vector3(-1, 0, 0);
const yyi = new THREE.Vector3(0, -1, 0);
const zzi = new THREE.Vector3(0, 0, -1);

export const SIDE_INDEX: Record<VrcFace, number> = {
	U: 0,
	R: 1,
	F: 2,
	D: 3,
	L: 4,
	B: 5,
};

export const INDEX_SIDE: VrcFace[] = ['U', 'R', 'F', 'D', 'L', 'B'];

/** Quarter-turn rotation applied to a sticker's logical matrix, per face. */
export const SIDES_ROT: Record<VrcFace, THREE.Matrix4> = {
	U: axify(zz, yy, xxi),
	L: axify(xx, zz, yyi),
	F: axify(yyi, xx, zz),
	R: axify(xx, zzi, yy),
	B: axify(yy, xxi, zz),
	D: axify(zzi, yy, xx),
};

/** Outward normal per face. Used to measure which layer a sticker sits in. */
export const SIDES_NORM: Record<VrcFace, THREE.Vector3> = {
	U: yy,
	L: xxi,
	F: zz,
	R: xx,
	B: zzi,
	D: yyi,
};

/** Axis a face turns about during animation. Note these are the inverses of SIDES_NORM. */
export const SIDES_ROT_AXIS: Record<VrcFace, THREE.Vector3> = {
	U: yyi,
	L: xx,
	F: zzi,
	R: xxi,
	B: zz,
	D: yy,
};

/** Face basis used to lay out the sticker grid, indexed by face number (URFDLB). */
export const SIDES_UV: THREE.Matrix4[] = [
	axify(xx, zzi, yy), // U
	axify(zzi, yy, xx), // R
	axify(xx, yy, zz), // F
	axify(xx, zz, yyi), // D
	axify(zz, yy, xxi), // L
	axify(xxi, yy, zzi), // B
];

/**
 * Default sticker colours in URFDLB order: white, red, green, yellow, orange, blue.
 * twistynnn.js:90. puzzlefactory.js:111 re-maps the user's palette into this order.
 */
export const FACE_COLORS = [0xffffff, 0xff0000, 0x00ff00, 0xffff00, 0xff9000, 0x0000ff];

/** Border stroke colour. twistynnn.js:104-109 (a black wireframe material). */
export const BORDER_COLOR = 0x000000;

/** Colour interior stickers are greyed to when the big-cube toggle hides them. */
export const HIDDEN_COLOR = 0x7f7f7f;

/**
 * Sticker plate edge length on a grid of pitch 2, so the gap between plates is
 * 2 - 1.7 = 0.3. puzzlefactory.js:113 overrides twistynnn's own 1.8 default for
 * cubes, and 1.7 is what the reference actually renders with.
 */
export const STICKER_WIDTH = 1.7;

/** Whole-cube scale factor. puzzlefactory.js:132. */
export const SCALE = 0.9;

/** Actual object scale for a given dimension. twistynnn.js:196. */
export function actualScale(dimension: number): number {
	return (SCALE * 0.5) / dimension;
}

/** Full turn in radians. cstimer relies on its own `Math.TAU` shim. */
export const TAU = Math.PI * 2;
