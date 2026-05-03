import * as THREE from 'three';

const HALF_PI = Math.PI / 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * Algoritmadaki rotasyon/wide/slice hamlelerinden net fiziksel kubus donusunu hesaplar.
 *
 * Face turn'ler (R, L, U, D, F, B) core'u dondurmez — jiroskop etkilenmez.
 * Rotasyonlar (x, y, z), wide move'lar (r, l, u, d, f, b) ve slice move'lar (M, E, S)
 * core'u dondurur — jiroskop bu hamlelerden etkilenir.
 *
 * dir = -1: CW (ornegin x = R yonu, saat yonu)
 * dir = +1: CCW (ornegin l = L yonu = x' yonu)
 */
export function calculateNetRotationQuat(moves: string[]): THREE.Quaternion {
	const result = new THREE.Quaternion();

	for (const rawMove of moves) {
		const move = rawMove.replace(/[()]/g, '');
		const base = move.replace(/['2]/g, '');
		const isPrime = move.includes("'");
		const isDouble = move.includes('2');

		let axis: THREE.Vector3 | null = null;
		let dir = -1;

		switch (base) {
			// Rotasyonlar
			case 'x': axis = X_AXIS; dir = -1; break;
			case 'y': axis = Y_AXIS; dir = -1; break;
			case 'z': axis = Z_AXIS; dir = -1; break;
			// Wide move'lar (core donuyor)
			case 'r': axis = X_AXIS; dir = -1; break;
			case 'l': axis = X_AXIS; dir = 1; break;
			case 'u': axis = Y_AXIS; dir = -1; break;
			case 'd': axis = Y_AXIS; dir = 1; break;
			case 'f': axis = Z_AXIS; dir = -1; break;
			case 'b': axis = Z_AXIS; dir = 1; break;
			// Slice move'lar (core orta katmanda — o da donuyor)
			case 'M': axis = X_AXIS; dir = 1; break;  // M = L yonu = x'
			case 'E': axis = Y_AXIS; dir = 1; break;  // E = D yonu = y'
			case 'S': axis = Z_AXIS; dir = -1; break;  // S = F yonu = z
			default: continue;
		}

		let angle: number;
		if (isDouble) {
			angle = Math.PI;
		} else if (isPrime) {
			angle = -dir * HALF_PI;
		} else {
			angle = dir * HALF_PI;
		}

		result.multiply(new THREE.Quaternion().setFromAxisAngle(axis, angle));
	}

	return result;
}

/**
 * Bir tek hamle rotation/wide/slice mi? (yani core'u dondurur mu?)
 * True donuyorsa replay'de cube state'ine uygulanmamali, sahne quaternion'una uygulanmali.
 */
export function affectsCoreRotation(move: string): boolean {
	const base = move.replace(/['2()]/g, '');
	return /^[xyzrludfbMES]$/.test(base);
}
