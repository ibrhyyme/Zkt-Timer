/**
 * case_cube: a trainer case as our cube engine (cube_view/render/) draws it.
 *
 * The case is what the algorithm solves: the cube turned to the chosen orientation, then the
 * algorithm undone. That is what cubing.js showed with the algorithm's setup anchored at its
 * end, and the stickering mask is read the same way: for the places pieces take once the cube
 * is turned, then carried with the pieces through the undone algorithm.
 *
 * Pure (no cubing.js, no DOM), so it is tested in node against the whole library.
 */
import * as THREE from 'three';
import {CubeModel} from '../../components/timer/smart_cube/cube_view/render/cube_model';
import {parseMove} from '../../components/timer/smart_cube/cube_view/render/notation';
import type {CapLook, CapLooks} from '../../components/timer/smart_cube/cube_view/render/cube_renderer';
import {cleanAlgorithmForCubing} from './algorithm_engine';

const TOKEN = /\(|\)\s*\d*'?|[^\s()]+/g;
const GROUP_END = /^\)\s*(\d*)('?)$/;

function invertTurn(turn: string): string {
	return turn.endsWith("'") ? turn.slice(0, -1) : `${turn}'`;
}

/** The turns undone: reversed, each inverted. */
export function invertTurns(turns: string[]): string[] {
	return turns.slice().reverse().map(invertTurn);
}

/**
 * Commutator or conjugate notation ("[R U R', D]", "[F: R U R' U']"). cleanAlgorithmForCubing
 * drops the comma and colon, which would turn it into a different sequence; cubing.js reads it.
 */
export function hasCommutator(alg: string): boolean {
	return /[,:]/.test(alg || '');
}

/**
 * The single turns of an algorithm, groups written out: "(R U)2" is R U R U, "(R U)'" is
 * U' R'. Null when a turn is not one the engine knows (a layer prefix like 2R, a stray
 * bracket, commutator notation): the caller draws such a case another way.
 */
export function algTurns(alg: string): string[] | null {
	if (hasCommutator(alg)) return null;
	const tokens = cleanAlgorithmForCubing(alg || '').match(TOKEN) || [];
	let i = 0;
	const sequence = (): string[] | null => {
		const out: string[] = [];
		while (i < tokens.length && !tokens[i].startsWith(')')) {
			const token = tokens[i++];
			if (token !== '(') {
				if (!parseMove(token)) return null;
				out.push(token);
				continue;
			}
			const inner = sequence();
			const end = inner && i < tokens.length ? GROUP_END.exec(tokens[i++]) : null;
			if (!inner || !end) return null;
			const group = end[2] ? invertTurns(inner) : inner;
			for (let k = 0, times = end[1] ? Number(end[1]) : 1; k < times; k++) out.push(...group);
		}
		return out;
	};
	const turns = sequence();
	return turns && i === tokens.length ? turns : null;
}

/**
 * The turns that set the case up from solved: the orientation rotation (getOrientationRotation),
 * then the algorithm undone. Null when the algorithm cannot be read (see algTurns).
 */
export function caseTurns(algorithm: string, rotation: string): string[] | null {
	const turns = algTurns(algorithm);
	if (!turns) return null;
	return [...(rotation || '').split(' ').filter(Boolean), ...invertTurns(turns)];
}

// ---------------------------------------------------------------------------------------
// Stickering masks
// ---------------------------------------------------------------------------------------

type MaskValue = string | {mask: string} | null;

/** A cubing.js stickering mask for the 3x3 (stickering_remap.ts), as plain data. */
export interface StickeringMaskData {
	orbits: Record<string, {pieces: ({facelets: MaskValue[]} | null)[]}>;
}

/**
 * The 3x3 orbits as cubing.js orders them (Reid order; pattern_utils.ts reads patterns the
 * same way). A piece's facelet k is the sticker on the face of its name's k-th letter: an
 * OLL mask colours facelet 0 of the U pieces, their U stickers.
 */
const ORBIT_PIECES: Record<string, string[]> = {
	EDGES: 'UF UR UB UL DF DR DB DL FR FL BR BL'.split(' '),
	CORNERS: 'UFR URB UBL ULF DRF DFL DLB DBR'.split(' '),
	CENTERS: 'U L F R B D'.split(' '),
};
const ORBIT_BY_LETTERS = ['', 'CENTERS', 'EDGES', 'CORNERS'];

const AXIS_FACES = [
	['L', 'R'],
	['D', 'U'],
	['B', 'F'],
];

/** The faces a position on the 3x3 touches, as letters. */
function lettersAt(pos: THREE.Vector3): string[] {
	const letters: string[] = [];
	[pos.x, pos.y, pos.z].forEach((v, axis) => {
		if (Math.abs(v) > 0.5) letters.push(AXIS_FACES[axis][v > 0 ? 1 : 0]);
	});
	return letters;
}

/** The face a direction points at. */
function faceOf(dir: THREE.Vector3): string {
	const c = [dir.x, dir.y, dir.z];
	const axis = c.reduce((best, v, k) => (Math.abs(v) > Math.abs(c[best]) ? k : best), 0);
	return AXIS_FACES[axis][c[axis] > 0 ? 1 : 0];
}

function lookAt(mask: StickeringMaskData, pos: THREE.Vector3, facing: THREE.Vector3): CapLook {
	const letters = lettersAt(pos);
	const orbit = ORBIT_BY_LETTERS[letters.length];
	const names = ORBIT_PIECES[orbit] || [];
	const index = names.findIndex((name) => name.length === letters.length && letters.every((l) => name.includes(l)));
	if (index < 0) return 'regular';
	const value = mask.orbits[orbit]?.pieces[index]?.facelets[names[index].indexOf(faceOf(facing))];
	const look = value && typeof value === 'object' ? value.mask : value;
	return look === 'dim' || look === 'ignored' || look === 'invisible' ? look : 'regular';
}

const capKey = (home: THREE.Vector3, normal: THREE.Vector3) =>
	`${home.x},${home.y},${home.z}|${Math.round(normal.x)},${Math.round(normal.y)},${Math.round(normal.z)}`;

/**
 * A 3x3 stickering mask (as cubing.js gives it, unrotated) as cap looks for the renderer.
 * The mask is written for places, so each sticker takes the look of the place it lands on
 * when the cube is turned by `rotation`, and keeps it through the turns that follow.
 */
export function capLooksFromMask(mask: StickeringMaskData, rotation: string): CapLooks {
	const model = new CubeModel(3);
	for (const turn of (rotation || '').split(' ').filter(Boolean)) model.applyMove(turn);
	const looks = new Map<string, CapLook>();
	const facing = new THREE.Vector3();
	for (const cubie of model.cubies) {
		for (const cap of cubie.caps) {
			facing.copy(cap.normal).applyQuaternion(cubie.quat);
			looks.set(capKey(cubie.home, cap.normal), lookAt(mask, cubie.pos, facing));
		}
	}
	return (home, normal) => looks.get(capKey(home, normal)) ?? 'regular';
}
