import Cube from 'cubejs';
import * as THREE from 'three';

import { CubeModel } from '../render/cube_model';
import { DIM, buildBodyGeometry, buildCapGeometry, capMatrix, capShapeFor } from '../render/geometry';
import { parseMove } from '../render/notation';
import { TurnAnimator, springProgress } from '../render/turn_animator';
import { applyScramble } from '../../../../../util/cubes/cube_state';

const SOLVED = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
const FACE_TURNS = ['U', 'R', 'F', 'D', 'L', 'B'];
const ALL_TURNS = [...FACE_TURNS, 'E', 'M', 'S', 'x', 'y', 'z', 'u', 'r', 'f', 'd', 'l', 'b'];
const SUFFIXES = ['', "'", '2'];

// Deterministic, so a failure reproduces.
function rng(seed: number) {
	let s = seed;
	return () => {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		return s / 0x7fffffff;
	};
}

function randomAlg(next: () => number, pool: string[], length: number): string[] {
	return Array.from({ length }, () => pool[Math.floor(next() * pool.length)] + SUFFIXES[Math.floor(next() * 3)]);
}

/** cubejs's string with every edge and centre facelet put back on its face, as cube2x2.ts does. */
function cornersOnly(facelets: string): string {
	return facelets
		.split('')
		.map((c, i) => {
			const slot = i % 9;
			return [0, 2, 6, 8].includes(slot) ? c : 'URFDLB'[Math.floor(i / 9)];
		})
		.join('');
}

describe('parseMove', () => {
	it('reads direction and amount', () => {
		expect(parseMove('R')).toEqual({ axis: 0, layers: 'hi', quarters: -1 });
		expect(parseMove("R'")).toEqual({ axis: 0, layers: 'hi', quarters: 1 });
		expect(parseMove('R2')).toEqual({ axis: 0, layers: 'hi', quarters: -2 });
		expect(parseMove("R2'")).toEqual({ axis: 0, layers: 'hi', quarters: 2 });
		expect(parseMove('L')).toEqual({ axis: 0, layers: 'lo', quarters: 1 });
		expect(parseMove('Rw')).toEqual(parseMove('r'));
		expect(parseMove("R3")).toEqual(parseMove("R'"));
	});

	it('rejects what it does not know', () => {
		// '2R' is valid since big cubes: the second layer (see 'reads layer prefixes').
		for (const bad of ['', 'Q', 'R4x', 'RR', null as any]) expect(parseMove(bad)).toBeNull();
	});
});

describe('CubeModel against cubejs', () => {
	it('starts solved', () => {
		expect(new CubeModel(3).getFacelets()).toBe(SOLVED);
	});

	it('matches cubejs on every single move', () => {
		for (const turn of ALL_TURNS) {
			for (const suffix of SUFFIXES) {
				const move = turn + suffix;
				const model = new CubeModel(3);
				expect(model.applyMove(move)).toBe(true);
				const cube = new Cube();
				cube.move(move);
				expect([move, model.getFacelets()]).toEqual([move, cube.asString()]);
			}
		}
	});

	it('matches cubejs on long mixed sequences', () => {
		const next = rng(7);
		for (let run = 0; run < 40; run++) {
			const alg = randomAlg(next, ALL_TURNS, 40);
			const model = new CubeModel(3);
			for (const move of alg) model.applyMove(move);
			const cube = new Cube();
			cube.move(alg.join(' '));
			expect(model.getFacelets()).toBe(cube.asString());
		}
	});

	it('draws any reported state exactly', () => {
		const next = rng(11);
		for (let run = 0; run < 30; run++) {
			const cube = new Cube();
			cube.move(randomAlg(next, FACE_TURNS, 30).join(' '));
			const model = new CubeModel(3);
			model.applyMove('R'); // whatever it showed before must not leak through
			expect(model.setFacelets(cube.asString())).toBe(true);
			expect(model.getFacelets()).toBe(cube.asString());
		}
	});

	it('leaves the state alone on a malformed string', () => {
		const model = new CubeModel(3);
		model.applyMove('R');
		const before = model.getFacelets();
		expect(model.setFacelets('UUU')).toBe(false);
		expect(model.setFacelets(SOLVED.replace('U', 'X'))).toBe(false);
		expect(model.getFacelets()).toBe(before);
	});

	it('turns a 2x2 like the corners of a 3x3', () => {
		const next = rng(23);
		for (let run = 0; run < 30; run++) {
			const alg = randomAlg(next, FACE_TURNS, 25);
			const model = new CubeModel(2);
			for (const move of alg) model.applyMove(move);
			const cube = new Cube();
			cube.move(alg.join(' '));
			expect(model.getFacelets()).toBe(cornersOnly(cube.asString()));
		}
	});

	it('reads a 2x2 state from the corner facelets', () => {
		const cube = new Cube();
		cube.move("R U R' F2 U' L");
		const facelets = cornersOnly(cube.asString());
		const model = new CubeModel(2);
		expect(model.setFacelets(facelets)).toBe(true);
		expect(model.getFacelets()).toBe(facelets);
	});
});

describe('big cubes', () => {
	const stateString = (size: number, turns: string[]) =>
		applyScramble(size, turns.join(' ')).faces.map((face) => face.join('')).join('');

	it('reads layer prefixes', () => {
		expect(parseMove('2R')).toEqual({ axis: 0, layers: 'hi', quarters: -1, depth: [2, 2] });
		expect(parseMove("3Rw'")).toEqual({ axis: 0, layers: 'wideHi', quarters: 1, depth: [1, 3] });
		expect(parseMove('3r')).toEqual(parseMove('3Rw'));
		expect(parseMove('2-3Lw2')).toEqual({ axis: 0, layers: 'wideLo', quarters: 2, depth: [2, 3] });
		for (const bad of ['2M', '3x', '0R', '3-2Rw']) expect(parseMove(bad)).toBeNull();
	});

	// The scramble preview's own NxN simulator (cube_state.ts) is the reference. It reads a
	// number on a face as a wide turn, so the sequences use only what both read the same way:
	// faces, Rw / r, and 3Rw-style blocks.
	it.each([4, 5, 6, 7] as const)('matches the 2D preview on a cube of %i layers', (size) => {
		const next = rng(size * 31);
		const pool = [
			...FACE_TURNS,
			...FACE_TURNS.map((f) => `${f}w`),
			...FACE_TURNS.map((f) => f.toLowerCase()),
			...FACE_TURNS.flatMap((f) => Array.from({ length: Math.max(0, size - 3) }, (_, k) => `${k + 3}${f}w`)),
		];
		for (let run = 0; run < 12; run++) {
			const alg = randomAlg(next, pool, 30);
			const model = new CubeModel(size);
			for (const move of alg) expect([move, model.applyMove(move)]).toEqual([move, true]);
			expect(model.getFacelets()).toBe(stateString(size, alg));
		}
	});

	it('turns an inner slice alone', () => {
		for (const size of [4, 5] as const) {
			const slice = new CubeModel(size);
			slice.applyMove('2R');
			const pair = new CubeModel(size);
			for (const move of ['Rw', "R'"]) pair.applyMove(move);
			expect(slice.getFacelets()).toBe(pair.getFacelets());
		}
	});

	it('reads and writes a 6 x N x N state', () => {
		const model = new CubeModel(5);
		for (const move of ['Rw', 'U2', "3Fw'", 'L']) model.applyMove(move);
		const facelets = model.getFacelets();
		expect(facelets).toHaveLength(150);
		const copy = new CubeModel(5);
		expect(copy.setFacelets(facelets)).toBe(true);
		expect(copy.getFacelets()).toBe(facelets);
		expect(copy.setFacelets(SOLVED)).toBe(false);
	});

	it('has every piece of the surface and no core', () => {
		for (const size of [4, 5, 6, 7] as const) {
			const model = new CubeModel(size);
			expect(model.cubies).toHaveLength(size ** 3 - (size - 2) ** 3);
			expect(model.caps).toHaveLength(6 * size * size);
		}
	});
});

describe('TurnAnimator', () => {
	it('springs past the slot and settles on it', () => {
		const omega = 49;
		let peak = 0;
		for (let t = 0; t < 0.3; t += 0.002) peak = Math.max(peak, springProgress(t, omega));
		expect(peak).toBeGreaterThan(1.01);
		expect(peak).toBeLessThan(1.1);
		expect(Math.abs(springProgress(0.3, omega) - 1)).toBeLessThan(0.002);
	});

	it('ends where instant application ends, however fast the turns come', () => {
		const next = rng(31);
		for (const gapMs of [0, 15, 60, 250]) {
			const alg = randomAlg(next, FACE_TURNS, 60);
			const model = new CubeModel(3);
			const animator = new TurnAnimator(model);
			let now = 0;
			for (const move of alg) {
				animator.push(move);
				for (let t = 0; t < gapMs; t += 16) animator.update((now += 16));
				animator.update((now += 1));
			}
			let frames = 0;
			while (animator.busy && frames++ < 10000) animator.update((now += 16));
			const cube = new Cube();
			cube.move(alg.join(' '));
			expect(animator.busy).toBe(false);
			expect(model.getFacelets()).toBe(cube.asString());
		}
	});

	it('never falls far behind a fast solver', () => {
		const model = new CubeModel(3);
		const animator = new TurnAnimator(model);
		let now = 0;
		// 15 turns per second for two seconds, then see how long the tail takes.
		for (let i = 0; i < 30; i++) {
			animator.push(i % 2 ? 'R' : 'U');
			for (let f = 0; f < 4; f++) animator.update((now += 16.7));
		}
		const end = now;
		while (animator.busy) animator.update((now += 16.7));
		expect(now - end).toBeLessThan(400);
	});

	it('flush applies everything pending', () => {
		const model = new CubeModel(3);
		const animator = new TurnAnimator(model);
		for (const m of ['R', 'U', "R'", "U'"]) animator.push(m);
		animator.update(0);
		animator.flush();
		const cube = new Cube();
		cube.move("R U R' U'");
		expect(model.getFacelets()).toBe(cube.asString());
	});
});

describe('geometry', () => {
	const finiteUnitNormals = (geo: THREE.BufferGeometry) => {
		const n = geo.getAttribute('normal');
		for (let i = 0; i < n.count; i++) {
			const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
			expect(Number.isFinite(len)).toBe(true);
			expect(Math.abs(len - 1)).toBeLessThan(1e-4);
		}
	};

	it('builds every cap shape with clean normals and its top flush at z = 0', () => {
		for (const kind of ['corner', 'edge', 'center'] as const) {
			const geo = buildCapGeometry(capShapeFor(kind));
			finiteUnitNormals(geo);
			geo.computeBoundingBox();
			const box = geo.boundingBox as THREE.Box3;
			expect(box.max.z).toBeCloseTo(DIM.capDome, 5);
			expect(box.min.z).toBeCloseTo(-DIM.capThickness, 5);
			expect(box.max.x).toBeLessThanOrEqual(DIM.capHalf + 1e-6);
		}
	});

	it('keeps bodies inside their cell and low under caps', () => {
		const home = new THREE.Vector3(1, 1, 0);
		const geo = buildBodyGeometry(home, 1);
		finiteUnitNormals(geo);
		geo.computeBoundingBox();
		const box = geo.boundingBox as THREE.Box3;
		expect(box.max.x).toBeCloseTo(DIM.bodyUnderCap, 5);
		expect(box.max.y).toBeCloseTo(DIM.bodyUnderCap, 5);
		expect(box.max.z).toBeCloseTo(DIM.bodyHalf, 5);
		expect(box.min.x).toBeCloseTo(-DIM.bodyHalf, 5);
	});

	it('turns an edge cap so its rounded corners face the centre', () => {
		// The F-face edge above the centre: the cap's local -y must point down, at the centre.
		const m = capMatrix(new THREE.Vector3(0, 1, 1), new THREE.Vector3(0, 0, 1), 1);
		const down = new THREE.Vector3(0, -1, 0).transformDirection(m);
		expect(down.y).toBeCloseTo(-1, 6);
		const up = new THREE.Vector3(0, 0, 1).transformDirection(m);
		expect(up.z).toBeCloseTo(1, 6);
	});
});
