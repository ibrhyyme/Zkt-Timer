import * as THREE from 'three';

import { layerTurns, parseMove, type Axis, type ParsedMove } from './notation';

/**
 * The cube as pieces: where every cubie sits, how it is turned, and the colour of each of
 * its caps. No rendering here, so the move maths and the facelet mapping are tested
 * against cubejs without a WebGL context.
 *
 * Positions are in cubie units centred on the core: -1..1 on a 3x3, -0.5..0.5 on a 2x2,
 * -3..3 on a 7x7. A cap's `normal` is in the cubie's own frame (its solved orientation),
 * which is also the frame its meshes are built in.
 */

export type PuzzleSize = 2 | 3 | 4 | 5 | 6 | 7;

/** Face order of a facelet string (cubejs / Kociemba), and the colour index of each face. */
export const FACE_ORDER = 'URFDLB';

const FACE_NORMAL: THREE.Vector3[] = [
	new THREE.Vector3(0, 1, 0),
	new THREE.Vector3(1, 0, 0),
	new THREE.Vector3(0, 0, 1),
	new THREE.Vector3(0, -1, 0),
	new THREE.Vector3(-1, 0, 0),
	new THREE.Vector3(0, 0, -1),
];
// How a face's nine facelets are read, looking at that face from outside: along `right`
// for columns, along `down` for rows. U is read with B at the top, D with F at the top.
const FACE_RIGHT: THREE.Vector3[] = [
	new THREE.Vector3(1, 0, 0),
	new THREE.Vector3(0, 0, -1),
	new THREE.Vector3(1, 0, 0),
	new THREE.Vector3(1, 0, 0),
	new THREE.Vector3(0, 0, 1),
	new THREE.Vector3(-1, 0, 0),
];
const FACE_DOWN: THREE.Vector3[] = [
	new THREE.Vector3(0, 0, 1),
	new THREE.Vector3(0, -1, 0),
	new THREE.Vector3(0, -1, 0),
	new THREE.Vector3(0, 0, -1),
	new THREE.Vector3(0, -1, 0),
	new THREE.Vector3(0, -1, 0),
];

export const AXES: THREE.Vector3[] = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];

export interface Cap {
	/** Stable index, shared with the renderer's mesh list. */
	id: number;
	normal: THREE.Vector3;
	/** Colour index into FACE_ORDER. */
	color: number;
	center: boolean;
}

export interface Cubie {
	home: THREE.Vector3;
	pos: THREE.Vector3;
	quat: THREE.Quaternion;
	caps: Cap[];
}

const snapPos = (v: THREE.Vector3) => v.set(Math.round(v.x * 2) / 2, Math.round(v.y * 2) / 2, Math.round(v.z * 2) / 2);

const _m = new THREE.Matrix4();
/** Quarter turns only: squaring the rotation matrix to -1/0/1 stops float drift piling up. */
function snapQuat(q: THREE.Quaternion) {
	_m.makeRotationFromQuaternion(q);
	const e = _m.elements;
	for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[i] = Math.round(e[i]);
	q.setFromRotationMatrix(_m).normalize();
}

export class CubeModel {
	readonly size: PuzzleSize;
	readonly cubies: Cubie[] = [];
	readonly caps: Cap[] = [];
	/** Layer positions along every axis, lowest first. */
	readonly lo: number;
	readonly hi: number;

	constructor(size: PuzzleSize) {
		this.size = size;
		this.hi = (size - 1) / 2;
		this.lo = -this.hi;
		const coords = Array.from({ length: size }, (_, i) => i - this.hi);
		const outer = (v: number) => Math.abs(v) > this.hi - 1e-6;
		for (const x of coords) {
			for (const y of coords) {
				for (const z of coords) {
					// Only the pieces on the surface; the core is not drawn.
					if (!outer(x) && !outer(y) && !outer(z)) continue;
					const home = new THREE.Vector3(x, y, z);
					const cubie: Cubie = { home, pos: home.clone(), quat: new THREE.Quaternion(), caps: [] };
					const onSurface = [x, y, z].filter((v) => Math.abs(v) > this.hi - 1e-6).length;
					FACE_NORMAL.forEach((n, face) => {
						if (home.dot(n) < this.hi - 1e-6) return;
						const cap: Cap = { id: this.caps.length, normal: n.clone(), color: face, center: onSurface === 1 };
						cubie.caps.push(cap);
						this.caps.push(cap);
					});
					this.cubies.push(cubie);
				}
			}
		}
	}

	/** Put every piece home and paint the solved colours. */
	reset() {
		for (const c of this.cubies) {
			c.pos.copy(c.home);
			c.quat.identity();
			for (const cap of c.caps) cap.color = FACE_NORMAL.findIndex((n) => n.equals(cap.normal));
		}
	}

	/** The pieces a move turns, chosen from where they are now. */
	select(move: ParsedMove): Cubie[] {
		return this.cubies.filter((c) => layerTurns(move, c.pos.getComponent(move.axis), this.lo, this.hi));
	}

	/** Apply a move to the given pieces at once (the animation's end state). */
	commit(axis: Axis, quarters: number, cubies: Cubie[]) {
		if (!quarters) return;
		const q = new THREE.Quaternion().setFromAxisAngle(AXES[axis], (quarters * Math.PI) / 2);
		for (const c of cubies) {
			snapPos(c.pos.applyQuaternion(q));
			c.quat.premultiply(q);
			snapQuat(c.quat);
		}
	}

	/** Parse and apply instantly. Returns false for notation it does not know. */
	applyMove(text: string): boolean {
		const move = parseMove(text);
		if (!move) return false;
		this.commit(move.axis, move.quarters, this.select(move));
		return true;
	}

	/**
	 * Facelets per face side: a 2x2 is read in the 3x3's 54-character layout, the same
	 * projection cube2x2.ts puts it in; every other size in its own N x N.
	 */
	private get grid(): number {
		return this.size === 2 ? 3 : this.size;
	}

	/**
	 * Show a reported state: every piece home, caps painted from the facelets (6 x N x N
	 * characters; 54 for a 2x2, of which only the corners are read). Returns false, touching
	 * nothing, when the string is not a facelet string of this size.
	 */
	setFacelets(facelets: string): boolean {
		const total = 6 * this.grid * this.grid;
		if (typeof facelets !== 'string' || facelets.length !== total || !/^[URFDLB]+$/.test(facelets)) return false;
		this.reset();
		const lookup = new Map<string, Cap>();
		for (const c of this.cubies) for (const cap of c.caps) lookup.set(key(c.home, cap.normal), cap);
		for (let i = 0; i < total; i++) {
			const pos = this.faceletPosition(i);
			if (!pos) continue;
			const cap = lookup.get(key(pos, FACE_NORMAL[this.faceOf(i)]));
			if (cap) cap.color = FACE_ORDER.indexOf(facelets[i]);
		}
		return true;
	}

	/** The current state as a facelet string (a 2x2 keeps the 54 layout's edges and centres solved). */
	getFacelets(): string {
		const lookup = new Map<string, Cap>();
		const n = new THREE.Vector3();
		for (const c of this.cubies) {
			for (const cap of c.caps) lookup.set(key(c.pos, snapPos(n.copy(cap.normal).applyQuaternion(c.quat))), cap);
		}
		let out = '';
		for (let i = 0, total = 6 * this.grid * this.grid; i < total; i++) {
			const face = this.faceOf(i);
			const pos = this.faceletPosition(i);
			const cap = pos && lookup.get(key(pos, FACE_NORMAL[face]));
			out += cap ? FACE_ORDER[cap.color] : FACE_ORDER[face];
		}
		return out;
	}

	private faceOf(i: number): number {
		return Math.floor(i / (this.grid * this.grid));
	}

	/** Where facelet `i` sits, or null for the 2x2's edge and centre facelets. */
	private faceletPosition(i: number): THREE.Vector3 | null {
		const g = this.grid;
		const face = this.faceOf(i);
		const row = Math.floor((i % (g * g)) / g);
		const col = i % g;
		const mid = (g - 1) / 2;
		if (this.size === 2 && (row === mid || col === mid)) return null;
		const step = this.size === 2 ? 0.5 : 1;
		return new THREE.Vector3()
			.addScaledVector(FACE_NORMAL[face], this.hi)
			.addScaledVector(FACE_RIGHT[face], (col - mid) * step)
			.addScaledVector(FACE_DOWN[face], (row - mid) * step);
	}
}

function key(pos: THREE.Vector3, normal: THREE.Vector3): string {
	return `${pos.x},${pos.y},${pos.z}|${Math.round(normal.x)},${Math.round(normal.y)},${Math.round(normal.z)}`;
}
