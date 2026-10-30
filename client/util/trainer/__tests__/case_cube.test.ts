import * as THREE from 'three';
import {CubeModel} from '../../../components/timer/smart_cube/cube_view/render/cube_model';
import {algTurns, capLooksFromMask, caseTurns, invertTurns, type StickeringMaskData} from '../case_cube';
import {getOrientationRotation, getPuzzleType} from '../algorithm_engine';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library = require('../../../../public/trainer/default-algs.json') as Record<
	string,
	{algorithms: {algorithm: string; alternatives?: string[]}[]}[]
>;

function modelAfter(size: 2 | 3, turns: string[]): CubeModel {
	const model = new CubeModel(size);
	for (const turn of turns) expect([turn, model.applyMove(turn)]).toEqual([turn, true]);
	return model;
}

describe('algTurns', () => {
	it('writes groups out', () => {
		expect(algTurns("R U R' U'")).toEqual(['R', 'U', "R'", "U'"]);
		expect(algTurns('(R U)2 F')).toEqual(['R', 'U', 'R', 'U', 'F']);
		expect(algTurns("(R U)' F")).toEqual(["U'", "R'", 'F']);
		expect(algTurns("x (R' U R') D2")).toEqual(['x', "R'", 'U', "R'", 'D2']);
		expect(algTurns("Rw U Rw' U2'")).toEqual(['r', 'U', "r'", "U2'"]);
		expect(algTurns("((R U)2 F)'")).toEqual(["F'", "U'", "R'", "U'", "R'"]);
	});

	it('gives up on what the engine cannot turn', () => {
		expect(algTurns('2R2 U2')).toBeNull();
		expect(algTurns('(R U')).toBeNull();
		expect(algTurns('R U)')).toBeNull();
	});
});

describe('caseTurns', () => {
	it('undoes the algorithm after the rotation', () => {
		expect(invertTurns(['R', 'U2', "F'"])).toEqual(['F', "U2'", "R'"]);
		expect(caseTurns("R U R'", 'x2 y')).toEqual(['x2', 'y', 'R', "U'", "R'"]);
		expect(caseTurns('2R U', '')).toBeNull();
	});

	// Every 2x2 and 3x3 algorithm the library ships, main and alternatives: the engine reads
	// each, and the case it sets up is the one the algorithm solves. In the owner's orientation
	// (yellow top, red front), so the rotation is in it; the default one only drops it.
	const cases: [string, string][] = [];
	for (const [category, subsets] of Object.entries(library)) {
		const type = getPuzzleType(category);
		if (type !== '3x3x3' && type !== '2x2x2') continue;
		for (const s of subsets) for (const a of s.algorithms) for (const alg of [a.algorithm, ...(a.alternatives || [])]) cases.push([category, alg]);
	}

	it('every library algorithm sets up its case', () => {
		expect(cases.length).toBeGreaterThan(1000);
		const rotation = getOrientationRotation('D', 'R');
		const held = {2: modelAfter(2, rotation.split(' ').filter(Boolean)).getFacelets(), 3: modelAfter(3, rotation.split(' ').filter(Boolean)).getFacelets()};
		const failures: string[] = [];
		for (const [category, alg] of cases) {
			const size = getPuzzleType(category) === '2x2x2' ? 2 : 3;
			const setup = caseTurns(alg, rotation);
			if (!setup) {
				failures.push(`${category}: ${alg} (unread)`);
				continue;
			}
			const model = new CubeModel(size);
			for (const turn of [...setup, ...algTurns(alg)!]) model.applyMove(turn);
			if (model.getFacelets() !== held[size]) failures.push(`${category}: ${alg}`);
		}
		expect(failures).toEqual([]);
	});
});

/** A mask in cubing.js's layout from one value per facelet: EDGES 12x2, CORNERS 8x3, CENTERS 6x1. */
function maskOf(orbits: {EDGES: string[][]; CORNERS: string[][]; CENTERS: string[][]}): StickeringMaskData {
	const out: StickeringMaskData = {orbits: {}};
	for (const [name, pieces] of Object.entries(orbits)) out.orbits[name] = {pieces: pieces.map((facelets) => ({facelets}))};
	return out;
}

const fill = (n: number, facelets: string[]) => Array.from({length: n}, () => facelets);

/** cubing.js's F2L mask (centres regular, as stickering_remap.ts fixes them): the last layer ignored. */
const F2L = maskOf({
	EDGES: [...fill(4, ['ignored', 'ignored']), ...fill(8, ['regular', 'regular'])],
	CORNERS: [...fill(4, ['ignored', 'ignored', 'ignored']), ...fill(4, ['regular', 'regular', 'regular'])],
	CENTERS: fill(6, ['regular']),
});

/** cubing.js's OLL mask: the U stickers of the last layer coloured, its sides ignored, the rest dimmed. */
const OLL = maskOf({
	EDGES: [...fill(4, ['regular', 'ignored']), ...fill(8, ['dim', 'dim'])],
	CORNERS: [...fill(4, ['regular', 'ignored', 'ignored']), ...fill(4, ['dim', 'dim', 'dim'])],
	CENTERS: [['regular'], ...fill(5, ['dim'])],
});

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Every cap of a solved 3x3 with its look. */
function looksOf(mask: StickeringMaskData, rotation: string) {
	const looks = capLooksFromMask(mask, rotation);
	return new CubeModel(3).cubies.flatMap((c) => c.caps.map((cap) => ({home: c.home, normal: cap.normal, look: looks(c.home, cap.normal)})));
}

describe('capLooksFromMask', () => {
	it('greys the last layer of an F2L case', () => {
		for (const {home, look} of looksOf(F2L, '')) {
			const lastLayer = home.y === 1 && (home.x !== 0 || home.z !== 0);
			expect(look).toBe(lastLayer ? 'ignored' : 'regular');
		}
	});

	it('greys the pieces a rotation brings on top, not the ones that started there', () => {
		// x2 y: yellow on top. The yellow (core D) pieces sit in the last layer now.
		for (const {home, look} of looksOf(F2L, getOrientationRotation('D', 'R'))) {
			const onTop = home.y === -1 && (home.x !== 0 || home.z !== 0);
			expect(look).toBe(onTop ? 'ignored' : 'regular');
		}
	});

	it('colours the stickers that face up after the rotation (OLL)', () => {
		for (const {home, normal, look} of looksOf(OLL, getOrientationRotation('D', 'R'))) {
			if (home.y === -1) {
				// Their D sticker faces up now: coloured; their sides are ignored.
				expect(look).toBe(normal.y === -1 ? 'regular' : 'ignored');
			} else {
				expect(look).toBe('dim');
			}
		}
	});

	it('reads a corner\'s facelets in the order of its name', () => {
		const mask = maskOf({
			EDGES: fill(12, ['regular', 'regular']),
			CORNERS: [['regular', 'dim', 'ignored'], ...fill(7, ['regular', 'regular', 'regular'])],
			CENTERS: fill(6, ['regular']),
		});
		const looks = capLooksFromMask(mask, '');
		// UFR: U, then F, then R.
		expect(looks(v(1, 1, 1), v(0, 1, 0))).toBe('regular');
		expect(looks(v(1, 1, 1), v(0, 0, 1))).toBe('dim');
		expect(looks(v(1, 1, 1), v(1, 0, 0))).toBe('ignored');
	});
});
