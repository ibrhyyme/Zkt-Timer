import Cube from 'cubejs';
import type { SmartCubePuzzle } from '../../../shared/smart_cube/puzzle';

/**
 * 2x2 smart cubes, expressed so the 3x3 pipeline can carry them unchanged.
 *
 * Everything downstream of a driver (tracker, solve engine, Redux, the 3D view) works on
 * 54-character facelet strings. A 2x2 state goes through that same pipe in one fixed form:
 *
 *  1. Corners only. Edge and centre stickers are held at their solved colour, so two strings
 *     are equal exactly when the corners are (cstimer's `cubiesMatch(cornerOnly)`). A tracker
 *     that turns a 3x3 model also scrambles its edges; projecting removes them again.
 *  2. Seen from the DBL corner. A 2x2 has no centres, so "solved" is any of 24 orientations
 *     and the same physical state has 24 spellings. Holding the DBL piece in its home slot
 *     picks one. It is the frame the MoYu WCU_MY22 reports in natively (only F, U and R turns)
 *     and the one our 2x2 scrambles keep (U, R and F only), so for those it costs nothing.
 *
 * The GAN 251 UI decodes all six faces (cstimer gancube.js), so its reference frame may be
 * its core rather than a corner. `Frame2x2` turns its reports into the DBL frame: a turn of a
 * layer that holds DBL is the opposite layer turning the same way while the frame rotates.
 */

export const SOLVED_2X2_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

const FACES = 'URFDLB';
const CORNER_SLOTS = [0, 2, 6, 8];
const OPPOSITE: Record<string, string> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };

/** Stickers of the DBL corner: D7, B9, L7 in the cubejs/Kociemba layout. */
const DBL_STICKERS: [number, string][] = [
	[33, 'D'],
	[53, 'B'],
	[42, 'L'],
];

function isFacelets54(facelets: string | null | undefined): facelets is string {
	return typeof facelets === 'string' && facelets.length === 54 && /^[URFDLB]+$/.test(facelets);
}

/** Keep the corner stickers, put every edge and centre sticker back on its solved colour. */
export function projectCorners(facelets: string): string {
	let out = '';
	for (let i = 0; i < 54; i++) {
		out += CORNER_SLOTS.includes(i % 9) ? facelets[i] : FACES[Math.floor(i / 9)];
	}
	return out;
}

/**
 * A 24-sticker 2x2 report (URFDLB, four per face, row-major) as the 54-character form.
 * Null when it is not 24 face letters.
 */
export function expand2x2Facelets(facelets24: string): string | null {
	if (typeof facelets24 !== 'string' || facelets24.length !== 24 || !/^[URFDLB]+$/.test(facelets24)) return null;
	const out = SOLVED_2X2_FACELETS.split('');
	for (let face = 0; face < 6; face++) {
		for (let j = 0; j < 4; j++) {
			out[face * 9 + CORNER_SLOTS[j]] = facelets24[face * 4 + j];
		}
	}
	return out.join('');
}

function dblHome(facelets: string): boolean {
	return DBL_STICKERS.every(([index, colour]) => facelets[index] === colour);
}

/** Kociemba corner stickers (URF UFL ULB UBR DFR DLF DBL DRB), U/D sticker first. */
const CORNER_FACELETS = [
	[8, 9, 20],
	[6, 18, 38],
	[0, 36, 47],
	[2, 45, 11],
	[29, 26, 15],
	[27, 44, 24],
	[33, 53, 42],
	[35, 17, 51],
];

/**
 * Is this a physically possible 2x2 state? Every corner a real piece, each piece once, the
 * twists summing to a multiple of three; corner parity is free on a 2x2. Port of
 * smartcube-web-bluetooth parse2x2Facelets, on the 54-character layout.
 */
export function isValid2x2Facelets(facelets: string | null | undefined): boolean {
	if (!isFacelets54(facelets)) return false;
	const seen = new Set<number>();
	let twist = 0;
	for (const slot of CORNER_FACELETS) {
		const colours = slot.map((index) => facelets[index]);
		const orientation = colours.findIndex((c) => c === 'U' || c === 'D');
		if (orientation < 0) return false;
		const piece = CORNER_FACELETS.findIndex((home) =>
			home.every((index, n) => FACES[Math.floor(index / 9)] === colours[(orientation + n) % 3])
		);
		if (piece < 0 || seen.has(piece)) return false;
		seen.add(piece);
		twist += orientation;
	}
	return twist % 3 === 0;
}

// ── Whole-cube rotations ─────────────────────────────────────────────────────

interface Rotation {
	/** cubejs rotation moves that perform it. */
	moves: string[];
	/** Where each face ends up: map[X] is the face that was X's direction after the rotation. */
	map: Record<string, string>;
}

/** Face permutation a rotation sequence causes, read off the centres of a turned solved cube. */
function faceMapOf(moves: string[]): Record<string, string> {
	const cube = new Cube();
	for (const move of moves) cube.move(move);
	const state = cube.asString();
	const map: Record<string, string> = {};
	for (let k = 0; k < 6; k++) map[state[k * 9 + 4]] = FACES[k];
	return map;
}

let rotationsCache: Rotation[] | null = null;

/** The 24 orientations of a cube, identity first, each with the shortest x/y/z sequence. */
function rotations(): Rotation[] {
	if (rotationsCache) return rotationsCache;
	const seen = new Set<string>();
	const list: Rotation[] = [];
	const queue: string[][] = [[]];
	while (queue.length) {
		const moves = queue.shift()!;
		const map = faceMapOf(moves);
		const key = FACES.split('').map((f) => map[f]).join('');
		if (seen.has(key)) continue;
		seen.add(key);
		list.push({ moves, map });
		for (const r of ['x', 'y', 'z']) queue.push([...moves, r]);
	}
	rotationsCache = list;
	return list;
}

/** The rotation that puts the DBL piece home, and the state it gives. Null for a broken state. */
function findCanonical(projected: string): { state: string; rotation: Rotation } | null {
	if (!isValid2x2Facelets(projected)) return null;
	const all = rotations();
	if (dblHome(projected)) return { state: projected, rotation: all[0] };
	for (let i = 1; i < all.length; i++) {
		let cube;
		try {
			cube = Cube.fromString(projected);
			for (const move of all[i].moves) cube.move(move);
		} catch (e) {
			return null;
		}
		const turned = projectCorners(cube.asString());
		if (dblHome(turned)) return { state: turned, rotation: all[i] };
	}
	return null;
}

/**
 * The one spelling of a 2x2 state: corners only, DBL piece home. Idempotent, so every
 * consumer may apply it again. A string that is not a cube comes back projected but unturned.
 */
export function canonical2x2(facelets: string): string {
	if (!isFacelets54(facelets)) return facelets;
	const projected = projectCorners(facelets);
	return findCanonical(projected)?.state ?? projected;
}

const turnRotationCache: Record<string, Record<string, string>> = {};

/**
 * The form every state comparison uses for this puzzle: unchanged for a 3x3, the canonical
 * 2x2 spelling for a 2x2. Applying it twice is harmless.
 */
export function normalizeFacelets(facelets: string, puzzle: SmartCubePuzzle): string {
	return puzzle === '222' ? canonical2x2(facelets) : facelets;
}

/** Map of the rotation a face turn performs on the whole cube (U -> y, R -> x, F -> z). */
function turnRotationMap(face: string, suffix: string): Record<string, string> {
	const key = face + suffix;
	if (!turnRotationCache[key]) {
		const axis = face === 'U' ? 'y' : face === 'R' ? 'x' : 'z';
		const power = suffix === "'" ? 3 : suffix === '2' ? 2 : 1;
		turnRotationCache[key] = faceMapOf(Array(power).fill(axis));
	}
	return turnRotationCache[key];
}

/**
 * Follows the frame a 2x2 reports in and rewrites its turns and states into the DBL frame.
 *
 * Self-healing: every state the cube reports re-derives the frame from scratch, so a turn the
 * driver never saw (a lost packet) can only leave the frame wrong until the next report.
 */
export class Frame2x2 {
	/** Device face -> DBL-frame face. */
	private map: Record<string, string> = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };

	/** True when the cube's own frame has been seen to differ from DBL's. For logging. */
	get rotated(): boolean {
		return FACES.split('').some((f) => this.map[f] !== f);
	}

	/**
	 * A reported turn in the DBL frame. `stale`: the turn is already part of the last adopted
	 * state, so the frame (re-derived from that state) already includes its rotation.
	 */
	move(move: string, stale = false): string {
		const face = move[0];
		const suffix = move.slice(1);
		const mapped = this.map[face];
		if (!mapped) return move;
		if (mapped === 'U' || mapped === 'R' || mapped === 'F') return mapped + suffix;
		// The layer holding DBL turned against the reference. Seen from DBL, the opposite layer
		// turned the same way round its own face, and the reference itself rotated with it.
		const opposite = OPPOSITE[mapped];
		if (!stale) {
			const rotation = turnRotationMap(opposite, suffix);
			for (const f of FACES) this.map[f] = rotation[this.map[f]];
		}
		return opposite + suffix;
	}

	/** A reported state in the DBL frame. Re-derives the frame; returns it unchanged if broken. */
	adopt(facelets: string): string {
		if (!isFacelets54(facelets)) return facelets;
		const found = findCanonical(projectCorners(facelets));
		if (!found) return projectCorners(facelets);
		this.map = { ...found.rotation.map };
		return found.state;
	}

	reset(): void {
		this.map = { U: 'U', R: 'R', F: 'F', D: 'D', L: 'L', B: 'B' };
	}
}

// ── Solver ────────────────────────────────────────────────────────────────────
//
// For the 3D view, which reaches a reported state by replaying the inverse of its solution
// (SmartCubeView.syncToFacelets). The 3x3 Kociemba solver it uses refuses a corners-only
// state, which has edge parity unrelated to its corner parity.
//
// Corners in Kociemba order (URF UFL ULB UBR DFR DLF DBL DRB), DBL fixed, so the state space is
// 7! x 3^6 and U, R, F reach all of it. IDA* over a permutation and an orientation coordinate,
// each with its own distance table: optimal, at most 11 moves, a few milliseconds.

const MOVE_CP: number[][] = [
	[3, 0, 1, 2, 4, 5, 6, 7], // U
	[4, 1, 2, 0, 7, 5, 6, 3], // R
	[1, 5, 2, 3, 0, 4, 6, 7], // F
];
const MOVE_CO: number[][] = [
	[0, 0, 0, 0, 0, 0, 0, 0],
	[2, 0, 0, 1, 1, 0, 0, 2],
	[1, 2, 0, 0, 2, 1, 0, 0],
];
const SOLVER_FACES = ['U', 'R', 'F'];
const POWER_SUFFIX = ['', '2', "'"];
/** Every position but DBL (6). */
const FREE = [0, 1, 2, 3, 4, 5, 7];

function applyCornerMove(cp: number[], co: number[], m: number): [number[], number[]] {
	const bp = MOVE_CP[m];
	const bo = MOVE_CO[m];
	const np = new Array(8);
	const no = new Array(8);
	for (let i = 0; i < 8; i++) {
		np[i] = cp[bp[i]];
		no[i] = (co[bp[i]] + bo[i]) % 3;
	}
	return [np, no];
}

function permIndex(cp: number[]): number {
	// Lehmer code of the pieces at the free positions, pieces renumbered 0..6.
	const pieces = FREE.map((p) => (cp[p] === 7 ? 6 : cp[p]));
	let index = 0;
	for (let i = 0; i < 7; i++) {
		let smaller = 0;
		for (let j = i + 1; j < 7; j++) if (pieces[j] < pieces[i]) smaller++;
		index = index * (7 - i) + smaller;
	}
	return index;
}

function permFromIndex(index: number): number[] {
	const digits: number[] = new Array(7);
	for (let i = 6; i >= 0; i--) {
		digits[i] = index % (7 - i);
		index = Math.floor(index / (7 - i));
	}
	const pool = [0, 1, 2, 3, 4, 5, 6];
	const pieces = digits.map((d) => pool.splice(d, 1)[0]);
	const cp = [0, 1, 2, 3, 4, 5, 6, 7];
	FREE.forEach((p, i) => {
		cp[p] = pieces[i] === 6 ? 7 : pieces[i];
	});
	return cp;
}

function oriIndex(co: number[]): number {
	let index = 0;
	for (let i = 0; i < 6; i++) index = index * 3 + co[FREE[i]];
	return index;
}

function oriFromIndex(index: number): number[] {
	const co = [0, 0, 0, 0, 0, 0, 0, 0];
	let sum = 0;
	for (let i = 5; i >= 0; i--) {
		co[FREE[i]] = index % 3;
		sum += index % 3;
		index = Math.floor(index / 3);
	}
	co[7] = (3 - (sum % 3)) % 3;
	return co;
}

interface SolverTables {
	permMove: Int16Array; // 5040 x 9
	oriMove: Int16Array; // 729 x 9
	permDist: Int8Array;
	oriDist: Int8Array;
}

let tablesCache: SolverTables | null = null;

function quarterTurns(cp: number[], co: number[], face: number, power: number): [number[], number[]] {
	let state: [number[], number[]] = [cp, co];
	for (let k = 0; k <= power; k++) state = applyCornerMove(state[0], state[1], face);
	return state;
}

function solverTables(): SolverTables {
	if (tablesCache) return tablesCache;
	const solvedCo = [0, 0, 0, 0, 0, 0, 0, 0];
	const solvedCp = [0, 1, 2, 3, 4, 5, 6, 7];
	const permMove = new Int16Array(5040 * 9);
	for (let p = 0; p < 5040; p++) {
		const cp = permFromIndex(p);
		for (let m = 0; m < 9; m++) {
			permMove[p * 9 + m] = permIndex(quarterTurns(cp, solvedCo, Math.floor(m / 3), m % 3)[0]);
		}
	}
	const oriMove = new Int16Array(729 * 9);
	for (let o = 0; o < 729; o++) {
		const co = oriFromIndex(o);
		for (let m = 0; m < 9; m++) {
			oriMove[o * 9 + m] = oriIndex(quarterTurns(solvedCp, co, Math.floor(m / 3), m % 3)[1]);
		}
	}
	const distances = (size: number, move: Int16Array): Int8Array => {
		const dist = new Int8Array(size).fill(-1);
		dist[0] = 0;
		let frontier = [0];
		for (let depth = 0; frontier.length; depth++) {
			const next: number[] = [];
			for (const s of frontier) {
				for (let m = 0; m < 9; m++) {
					const t = move[s * 9 + m];
					if (dist[t] === -1) {
						dist[t] = depth + 1;
						next.push(t);
					}
				}
			}
			frontier = next;
		}
		return dist;
	};
	tablesCache = { permMove, oriMove, permDist: distances(5040, permMove), oriDist: distances(729, oriMove) };
	return tablesCache;
}

/**
 * Optimal U/R/F solution of a 2x2 state (any 54-character spelling). Null when the string is
 * not a reachable 2x2 state.
 */
export function solve2x2(facelets: string): string[] | null {
	if (!isValid2x2Facelets(facelets)) return null;
	const canonical = canonical2x2(facelets);
	if (!dblHome(canonical)) return null;
	let json: { cp: number[]; co: number[] };
	try {
		json = Cube.fromString(canonical).toJSON();
	} catch (e) {
		return null;
	}
	if (json.cp[6] !== 6 || json.co[6] !== 0) return null;
	const { permMove, oriMove, permDist, oriDist } = solverTables();
	const p0 = permIndex(json.cp);
	const o0 = oriIndex(json.co);
	if (permDist[p0] < 0 || oriDist[o0] < 0) return null;

	const path: number[] = [];
	const search = (p: number, o: number, depth: number, lastFace: number): boolean => {
		if (depth === 0) return p === 0 && o === 0;
		if (Math.max(permDist[p], oriDist[o]) > depth) return false;
		for (let m = 0; m < 9; m++) {
			const face = Math.floor(m / 3);
			if (face === lastFace) continue;
			path.push(m);
			if (search(permMove[p * 9 + m], oriMove[o * 9 + m], depth - 1, face)) return true;
			path.pop();
		}
		return false;
	};
	for (let depth = 0; depth <= 14; depth++) {
		if (search(p0, o0, depth, -1)) {
			return path.map((m) => SOLVER_FACES[Math.floor(m / 3)] + POWER_SUFFIX[m % 3]);
		}
	}
	return null;
}
