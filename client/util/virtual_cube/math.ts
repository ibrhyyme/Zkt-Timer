import * as THREE from 'three';

/**
 * three.js r125 adapters for cstimer's ~r49 matrix code.
 *
 * cstimer bundles a 2013-era three.js (`Referans/cstimer-master/src/js/lib/threemin.js`).
 * Three of its matrix APIs changed meaning rather than disappearing, which is the
 * dangerous kind of change: the port compiles either way and silently draws wrong
 * geometry. Every one of them is funnelled through a helper here so the trap is
 * stated once instead of being re-derived at each of the eight call sites.
 */

/**
 * `new Matrix4().multiply(a, b)` in old three meant `a * b`.
 * In r125 `.multiply(m)` means `this * m`, so the equivalent is `multiplyMatrices`.
 *
 * Safe to alias arguments (`mul(r, m)` where m is also the target) because r125's
 * multiplyMatrices reads all 32 source elements into locals before writing any.
 */
export function mul(a: THREE.Matrix4, b: THREE.Matrix4): THREE.Matrix4 {
	return new THREE.Matrix4().multiplyMatrices(a, b);
}

/** In-place `target = a * target`. Mirrors cstimer's `m.multiply(rot, m)`. */
export function mulInto(target: THREE.Matrix4, a: THREE.Matrix4): THREE.Matrix4 {
	return target.multiplyMatrices(a, target);
}

/**
 * Build a matrix whose columns are the three given vectors.
 * Port of `axify` (twistynnn.js:4-13). Old and new `Matrix4.set()` are both
 * row-major with the same argument order, so this translates literally.
 */
export function axify(v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): THREE.Matrix4 {
	return new THREE.Matrix4().set(
		v1.x, v2.x, v3.x, 0,
		v1.y, v2.y, v3.y, 0,
		v1.z, v2.z, v3.z, 0,
		0, 0, 0, 1
	);
}

/**
 * Dot the matrix's translation column with a vector.
 * Port of `matrixVector3Dot` (twistynnn.js:68-70), which reads `n14/n24/n34`.
 * Old three stored those as named fields; r125 keeps a column-major `elements`
 * array where the translation column sits at indices 12, 13, 14.
 *
 * This is how a sticker's layer along a face normal is measured, so it runs
 * once per sticker per move. Kept allocation-free.
 */
export function matrixVector3Dot(m: THREE.Matrix4, v: THREE.Vector3): number {
	const e = m.elements;
	return e[12] * v.x + e[13] * v.y + e[14] * v.z;
}

/**
 * Raise a matrix to an integer power, inverting first when the power is negative.
 * Port of `matrix4Power` (twistynnn.js:235-249). Power 0 yields identity.
 *
 * r125 dropped the static `Matrix4.makeInvert(m, out)`; `.clone().invert()` is
 * the replacement.
 */
export function matrix4Power(inMatrix: THREE.Matrix4, power: number): THREE.Matrix4 {
	const matrix = power < 0 ? inMatrix.clone().invert() : inMatrix.clone();

	const out = new THREE.Matrix4();
	for (let i = 0; i < Math.abs(power); i++) {
		// Old `multiplySelf(m)` is r125's `multiply(m)`: this = this * m.
		out.multiply(matrix);
	}
	return out;
}

/** Pure translation matrix. Old three called this `setTranslation`. */
export function makeTranslation(x: number, y: number, z: number): THREE.Matrix4 {
	return new THREE.Matrix4().makeTranslation(x, y, z);
}

/** Rotation about an arbitrary axis. Old three called this `setRotationAxis`. */
export function makeRotationAxis(axis: THREE.Vector3, angle: number): THREE.Matrix4 {
	return new THREE.Matrix4().makeRotationAxis(axis, angle);
}
