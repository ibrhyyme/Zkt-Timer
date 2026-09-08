import * as THREE from 'three';

import { TAU } from './constants';

/**
 * Camera. Port of twisty.js:177-193 and 406-423.
 *
 * A fixed-distance orbit camera with no perspective controls beyond the four
 * arrow keys. Every constant here is load bearing for visual fidelity, so they
 * are spelled out rather than parameterised.
 */

export const FOV = 30;
export const ASPECT = 1;

/**
 * The reference constructs `new THREE.Camera(30, 1, 0, 1000)`, which looks like
 * near = 0, but its constructor is `this.near = near || 0.1`, so the real near
 * plane is 0.1.
 *
 * This matters more than it looks. With a true near of 0 the projection's
 * z row degenerates to c = -1, d = 0, every face centroid projects to z = 1, the
 * depth sort collapses to insertion order and the cube renders inside out.
 */
export const NEAR = 0.1;
export const FAR = 1000;

/** Orbit radius and look-at target. twisty.js:184, 417-419. */
export const RADIUS = 2 * Math.sqrt(2);
export const TARGET = new THREE.Vector3(0, -0.075, 0);
export const UP = new THREE.Vector3(0, 1, 0);

/** One step of theta/phi is a 48th of a full turn, i.e. 7.5 degrees. */
export const ANGLE_UNIT = TAU / 48;

/** Arrow keys clamp both angles to this range. twisty.js:408-410. */
export const ANGLE_MIN = -6;
export const ANGLE_MAX = 6;

export interface VrcCamera {
	theta: number;
	phi: number;
	position: THREE.Vector3;
	projectionMatrix: THREE.Matrix4;
	matrixWorldInverse: THREE.Matrix4;
	/** projectionMatrix * matrixWorldInverse, what the painter actually uses. */
	projScreenMatrix: THREE.Matrix4;
}

/**
 * Parse the `vrcOri` setting, which cstimer stores as two 0-12 numbers offset by
 * 6: '6,12' is the UF view and '10,11' the URF view.
 */
export function parseOrientation(ori: string): { theta: number; phi: number } {
	const parts = (ori || '6,12').split(',');
	return {
		theta: (parseInt(parts[0], 10) || 0) - 6,
		phi: (parseInt(parts[1], 10) || 0) - 6,
	};
}

function makeProjectionMatrix(): THREE.Matrix4 {
	const ymax = NEAR * Math.tan((FOV * Math.PI) / 360);
	const ymin = -ymax;
	const xmin = ymin * ASPECT;
	const xmax = ymax * ASPECT;

	// r125 signature is (left, right, top, bottom, near, far); old three's
	// makeFrustum took (left, right, bottom, top, ...). Swapping the middle pair
	// negates the y scale and flips the image vertically.
	return new THREE.Matrix4().makePerspective(xmin, xmax, ymax, ymin, NEAR, FAR);
}

/** Camera position for the given orbit angles. twisty.js:417-419. */
export function cameraPosition(theta: number, phi: number): THREE.Vector3 {
	const z = RADIUS * Math.sin(phi * ANGLE_UNIT);
	const xy = RADIUS * Math.cos(phi * ANGLE_UNIT);
	return new THREE.Vector3(xy * Math.sin(theta * ANGLE_UNIT), z, xy * Math.cos(theta * ANGLE_UNIT));
}

export function makeCamera(theta: number, phi: number): VrcCamera {
	const position = cameraPosition(theta, phi);

	// The reference does `matrix.lookAt(position, target, up)` then
	// `matrix.setPosition(position)`. r125's Matrix4.lookAt builds the same basis.
	//
	// The degenerate-basis trap that bit the hero cube port does not apply here:
	// phi is clamped to +/-6 steps, i.e. +/-45 degrees, so the view direction is
	// never parallel to `up` and lookAt never falls back to its epsilon nudge.
	const cameraWorld = new THREE.Matrix4().lookAt(position, TARGET, UP).setPosition(position);
	const matrixWorldInverse = cameraWorld.clone().invert();
	const projectionMatrix = makeProjectionMatrix();

	return {
		theta,
		phi,
		position,
		projectionMatrix,
		matrixWorldInverse,
		projScreenMatrix: new THREE.Matrix4().multiplyMatrices(projectionMatrix, matrixWorldInverse),
	};
}

/** Nudge the orbit angles, clamped. twisty.js:406-412. */
export function moveCameraDelta(camera: VrcCamera, deltaTheta: number, deltaPhi: number): VrcCamera {
	const theta = Math.max(Math.min(camera.theta + deltaTheta, ANGLE_MAX), ANGLE_MIN);
	const phi = Math.max(Math.min(camera.phi + deltaPhi, ANGLE_MAX), ANGLE_MIN);
	return makeCamera(theta, phi);
}
