// Ported from cstimer cross.js - Cross and XCross solver
import {
	Cnk,
	createMove,
	createPrun,
	edgeMove,
	getNPerm,
	getPruning,
	Searcher,
	setNPerm,
} from './mathlib-core';
import {MoveSeq, parseScramble} from './parse-scramble';
import {SolverResult} from './types';

let permPrun: number[] = [];
let flipPrun: number[] = [];
const cmv: number[][] = [];
const pmul: number[][] = [];
const fmul: number[][] = [];

// XCross tables
const e1mv: number[][] = [];
const c1mv: number[][] = [];
const ecPrun: number[][] = [];

let crossInited = false;
let xcrossInited = false;

function pmv(a: number, c: number): number {
	const b = cmv[c][~~(a / 24)];
	return 24 * ~~(b / 384) + pmul[a % 24][(b >> 4) % 24];
}

function fmv(b: number, c: number): number {
	const a = cmv[c][b >> 4];
	return (~~(a / 384) << 4) | (fmul[b & 15][(a >> 4) % 24] ^ (a & 15));
}

function i2f(a: number, c: number[]): void {
	for (let b = 3; 0 <= b; b--) {
		c[b] = a & 1;
		a >>= 1;
	}
}

function f2i(c: number[]): number {
	let a = 0;
	for (let b = 0; 4 > b; b++) {
		a <<= 1;
		a |= c[b];
	}
	return a;
}

function getmv(comb: number, m: number): number {
	const arr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	let r = 4;
	for (let i = 0; i < 12; i++) {
		if (comb >= Cnk[11 - i][r]) {
			comb -= Cnk[11 - i][r--];
			arr[i] = r << 1;
		} else {
			arr[i] = -1;
		}
	}
	edgeMove(arr, m);
	comb = 0;
	r = 4;
	let t = 0;
	const pm: number[] = [];
	for (let i = 0; i < 12; i++) {
		if (arr[i] >= 0) {
			comb += Cnk[11 - i][r--];
			pm[r] = arr[i] >> 1;
			t |= (arr[i] & 1) << (3 - r);
		}
	}
	return ((comb * 24 + getNPerm(pm, 4)) << 4) | t;
}

function initCrossInternal(): void {
	if (crossInited) return;
	crossInited = true;

	for (let i = 0; i < 24; i++) {
		pmul[i] = [];
	}
	for (let i = 0; i < 16; i++) {
		fmul[i] = [];
	}
	const pm1: number[] = [];
	const pm2: number[] = [];
	const pm3: number[] = [];
	for (let i = 0; i < 24; i++) {
		for (let j = 0; j < 24; j++) {
			setNPerm(pm1, i, 4);
			setNPerm(pm2, j, 4);
			for (let k = 0; k < 4; k++) {
				pm3[k] = pm1[pm2[k]];
			}
			pmul[i][j] = getNPerm(pm3, 4);
			if (i < 16) {
				i2f(i, pm1);
				for (let k = 0; k < 4; k++) {
					pm3[k] = pm1[pm2[k]];
				}
				fmul[i][j] = f2i(pm3);
			}
		}
	}
	createMove(cmv, 495, getmv);

	permPrun = [];
	flipPrun = [];
	createPrun(permPrun, 0, 11880, 5, pmv);
	createPrun(flipPrun, 0, 7920, 6, fmv);
}

function cornMove(corn: number, m: number): number {
	const idx = ~~(corn / 3);
	let twst = corn % 3;
	const idxt = [
		[3, 1, 2, 7, 0, 5, 6, 4],
		[0, 1, 6, 2, 4, 5, 7, 3],
		[1, 2, 3, 0, 4, 5, 6, 7],
		[0, 5, 1, 3, 4, 6, 2, 7],
		[4, 0, 2, 3, 5, 1, 6, 7],
		[0, 1, 2, 3, 7, 4, 5, 6],
	];
	const twstt = [
		[2, 0, 0, 1, 1, 0, 0, 2],
		[0, 0, 1, 2, 0, 0, 2, 1],
		[0, 0, 0, 0, 0, 0, 0, 0],
		[0, 1, 2, 0, 0, 2, 1, 0],
		[1, 2, 0, 0, 2, 1, 0, 0],
		[0, 0, 0, 0, 0, 0, 0, 0],
	];
	twst = (twst + twstt[m][idx]) % 3;
	return idxt[m][idx] * 3 + twst;
}

function initXCrossInternal(): void {
	if (xcrossInited) return;
	xcrossInited = true;
	initCrossInternal();

	for (let i = 0; i < 24; i++) {
		c1mv[i] = [];
		e1mv[i] = [];
		for (let m = 0; m < 6; m++) {
			c1mv[i][m] = cornMove(i, m);
			const edge = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1];
			edge[i >> 1] = i & 1;
			edgeMove(edge, m);
			for (let e = 0; e < 12; e++) {
				if (edge[e] >= 0) {
					e1mv[i][m] = (e << 1) | edge[e];
					break;
				}
			}
		}
	}
	for (let obj = 0; obj < 4; obj++) {
		const prun: number[] = [];
		createPrun(
			prun,
			(obj + 4) * 3 * 24 + (obj + 4) * 2,
			576,
			5,
			(q: number, m: number) => c1mv[~~(q / 24)][m] * 24 + e1mv[q % 24][m]
		);
		ecPrun[obj] = prun;
	}
}

const solvCross = new Searcher(
	(idx: number[]) => idx[0] + idx[1] === 0,
	(idx: number[]) => Math.max(getPruning(permPrun, idx[0]), getPruning(flipPrun, idx[1])),
	(idx: number[], move: number) => [pmv(idx[0], move), fmv(idx[1], move)],
	6,
	3,
	[1, 2, 4, 9, 18, 36]
);

const solvXCross = new Searcher(
	(idx: number[]) => idx[0] + idx[1] === 0 && idx[2] === (idx[4] + 4) * 2 && idx[3] === (idx[4] + 4) * 3,
	(idx: number[]) =>
		Math.max(
			getPruning(permPrun, idx[0]),
			getPruning(flipPrun, idx[1]),
			getPruning(ecPrun[idx[4]], idx[3] * 24 + idx[2])
		),
	(idx: number[], move: number) => [
		pmv(idx[0], move),
		fmv(idx[1], move),
		e1mv[idx[2]][move],
		c1mv[idx[3]][move],
		idx[4],
	],
	6,
	3,
	[1, 2, 4, 9, 18, 36]
);

const FACE_STR = ['D', 'U', 'L', 'R', 'F', 'B'];
const MOVE_IDX = ['FRUBLD', 'FLDBRU', 'FDRBUL', 'FULBDR', 'URBDLF', 'DRFULB'];
const ROT_IDX = ['', 'z2', "z'", 'z', "x'", 'x'];

export function initCross(): void {
	initCrossInternal();
}

export function solveCross(scramble: string): SolverResult[] {
	initCrossInternal();
	const moves = parseScramble(scramble, 'FRUBLD');
	const results: SolverResult[] = [];

	for (let face = 0; face < 6; face++) {
		let flip = 0;
		let perm = 0;
		for (let i = 0; i < moves.length; i++) {
			const m = MOVE_IDX[face].indexOf('FRUBLD'.charAt(moves[i][0]));
			const p = moves[i][2];
			for (let j = 0; j < p; j++) {
				flip = fmv(flip, m);
				perm = pmv(perm, m);
			}
		}
		const sol = solvCross.solve([perm, flip], 0, 50);
		const solution: string[] = [];
		if (sol) {
			for (let i = 0; i < sol.length; i++) {
				solution.push('FRUBLD'.charAt(sol[i][0]) + ' 2\''.charAt(sol[i][1]));
			}
		}
		results.push({
			face: FACE_STR[face],
			rotation: ROT_IDX[face],
			solution,
			moveCount: solution.length,
		});
	}

	return results;
}

// slot: undefined = optimal from 4 slots (shortest pair); 0-3 = specific F2L slot
export function solveXCross(scramble: string, face: number, slot?: number): SolverResult {
	initXCrossInternal();
	const moves = parseScramble(scramble, 'FRUBLD');

	let flip = 0;
	let perm = 0;
	const e1 = [8, 10, 12, 14];
	const c1 = [12, 15, 18, 21];

	for (let i = 0; i < moves.length; i++) {
		const m = MOVE_IDX[face].indexOf('FRUBLD'.charAt(moves[i][0]));
		const p = moves[i][2];
		for (let j = 0; j < p; j++) {
			flip = fmv(flip, m);
			perm = pmv(perm, m);
			for (let obj = 0; obj < 4; obj++) {
				e1[obj] = e1mv[e1[obj]][m];
				c1[obj] = c1mv[c1[obj]][m];
			}
		}
	}

	const idxs: number[][] = [];
	if (slot !== undefined && slot >= 0 && slot < 4) {
		// Specific slot — solve only that pair
		idxs.push([perm, flip, e1[slot], c1[slot], slot]);
	} else {
		// Optimal — shortest from 4 slots (solveMulti returns first solution)
		for (let i = 0; i < 4; i++) {
			idxs.push([perm, flip, e1[i], c1[i], i]);
		}
	}

	const solResult = solvXCross.solveMulti(idxs, 0, 20);
	const solution: string[] = [];
	if (solResult) {
		const sol = solResult[0];
		for (let i = 0; i < sol.length; i++) {
			solution.push('FRUBLD'.charAt(sol[i][0]) + ' 2\''.charAt(sol[i][1]));
		}
	}

	return {
		face: FACE_STR[face],
		rotation: ROT_IDX[face],
		solution,
		moveCount: solution.length,
	};
}

// ==================== Easy Cross / XCross (pattern of specific length) ====================
// Direct port of cstimer cross.js getEasyCross/getEasyXCross. Uses full pruning table (190080
// states, ~100KB packed) to produce exact N-move cross/xcross positions — no generate-and-test.
// Returns [ep,eo(,cp,co)] mask, fed to getAnyScramble and converted to real WCA scramble.

let fullPrun: number[] = [];
let fullInited = false;

function fullmv(idx: number, move: number): number {
	const slice = cmv[move][~~(idx / 384)];
	const flip = fmul[idx & 15][(slice >> 4) % 24] ^ (slice & 15);
	const perm = pmul[(idx >> 4) % 24][(slice >> 4) % 24];
	return ~~(slice / 384) * 384 + 16 * perm + flip;
}

export function fullInit(): void {
	if (fullInited) return;
	fullInited = true;
	initCrossInternal();
	fullPrun = [];
	createPrun(fullPrun, 0, 190080, 7, fullmv, 6, 3, 6);
}

function rn(n: number): number {
	return Math.floor(Math.random() * n);
}

function rndPerm(n: number): number[] {
	const arr: number[] = [];
	for (let i = 0; i < n; i++) arr[i] = i;
	for (let i = n - 1; i > 0; i--) {
		const j = rn(i + 1);
		const t = arr[i];
		arr[i] = arr[j];
		arr[j] = t;
	}
	return arr;
}

function valuedArray(len: number, val: number): number[] {
	const a: number[] = [];
	for (let i = 0; i < len; i++) a[i] = val;
	return a;
}

// idx (cross coord) → [edgePerm[12], edgeFlip[12]] (cstimer mapCross)
function mapCross(idx: number): number[][] {
	let comb = ~~(idx / 384);
	const perm = (idx >> 4) % 24;
	const flip = idx & 15;
	const arrp: number[] = [];
	const arrf: number[] = [];
	const pm: number[] = [];
	const fl: number[] = [];
	i2f(flip, fl);
	setNPerm(pm, perm, 4);
	let r = 4;
	const map = [7, 6, 5, 4, 10, 9, 8, 11, 3, 2, 1, 0];
	for (let i = 0; i < 12; i++) {
		if (comb >= Cnk[11 - i][r]) {
			comb -= Cnk[11 - i][r--];
			arrp[map[i]] = pm[r];
			arrf[map[i]] = fl[r];
		} else {
			arrp[map[i]] = arrf[map[i]] = -1;
		}
	}
	return [arrp, arrf];
}

/**
 * Generate exact `length`-move cross position → [edgePerm[12], edgeFlip[12]] mask.
 * length: single value (encoded as lenB*10+lenA); for exact N pass N*11 (lenA=lenB=N).
 */
export function getEasyCross(length: number): number[][] {
	fullInit();
	const lenA = Math.min(length % 10, 8);
	const lenB = Math.min(~~(length / 10), 8);
	const minLen = Math.min(lenA, lenB);
	const maxLen = Math.max(lenA, lenB);
	const ncase = [0, 1, 16, 174, 1568, 11377, 57758, 155012, 189978, 190080];
	let cases = rn(ncase[maxLen + 1] - ncase[minLen]) + 1;
	let i: number;
	for (i = 0; i < 190080; i++) {
		const prun = getPruning(fullPrun, i);
		if (prun <= maxLen && prun >= minLen && --cases === 0) {
			break;
		}
	}
	return mapCross(i);
}

/**
 * Generate exact `length`-move XCross position → [edgePerm[12], edgeFlip[12], cornerPerm[8], cornerOri[8]].
 */
export function getEasyXCross(length: number): number[][] | null {
	fullInit();
	initXCrossInternal();
	const lenA = length % 10;
	const lenB = ~~(length / 10);
	const minLen = Math.min(lenA, lenB, 8);
	const maxLen = Math.max(lenA, lenB);
	const ncase = [1, 16, 174, 1568, 11377, 57758, 155012, 189978, 190080];
	const lenClamp = Math.max(0, Math.min(maxLen, 8)); // cross length
	const remain = ncase[lenClamp];
	let isFound = false;
	// Freeze protection: prevent infinite loop for rare/impossible lengths (e.g., 3-move XCross)
	let outerTries = 0;
	const MAX_OUTER = 6;

	while (!isFound && outerTries < MAX_OUTER) {
		outerTries++;
		const rndIdx: number[] = [];
		const sample = 500;
		for (let i = 0; i < sample; i++) rndIdx.push(rn(remain));
		rndIdx.sort((a, b) => b - a);
		const rndCases: number[] = [];
		let cnt = 0;
		for (let i = 0; i < 190080; i++) {
			const prun = getPruning(fullPrun, i);
			if (prun > lenClamp) continue;
			while (rndIdx[rndIdx.length - 1] === cnt) {
				rndCases.push(i);
				rndIdx.pop();
			}
			if (rndIdx.length === 0) break;
			cnt++;
		}
		const order = rndPerm(sample);
		for (let s = 0; s < sample; s++) {
			const caze = rndCases[order[s]];
			let comb = ~~(caze / 384);
			const perm = ~~(caze / 384) * 24 + ((caze >> 4) % 24);
			const flip = (~~(caze / 384) << 4) | (caze & 15);
			const corns = rndPerm(8).slice(4);
			const edges = rndPerm(8);

			const arr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
			let r = 4;
			for (let j = 0; j < 12; j++) {
				if (comb >= Cnk[11 - j][r]) {
					comb -= Cnk[11 - j][r--];
					arr[j] = -1;
				} else {
					arr[j] = edges.pop() as number;
				}
			}
			for (let j = 0; j < 4; j++) {
				corns[j] = corns[j] * 3 + rn(3);
				edges[j] = arr.indexOf(j) * 2 + rn(2);
				const sol = solvXCross.solve([perm, flip, edges[j], corns[j], j], 0, isFound ? minLen - 1 : maxLen);
				if (sol == null) {
					continue;
				} else if (sol.length < minLen) {
					isFound = false;
					break;
				} else if (sol.length <= maxLen) {
					isFound = true;
				}
			}
			if (!isFound) continue;

			const crossArr = mapCross(caze);
			crossArr[2] = valuedArray(8, -1);
			crossArr[3] = valuedArray(8, -1);
			const map = [7, 6, 5, 4, 10, 9, 8, 11, 3, 2, 1, 0];
			const map2 = [6, 5, 4, 7, 2, 1, 0, 3];
			for (let i = 0; i < 4; i++) {
				crossArr[0][map[edges[i] >> 1]] = map[i + 4];
				crossArr[1][map[edges[i] >> 1]] = edges[i] % 2;
				crossArr[2][map2[~~(corns[i] / 3)]] = map2[i + 4];
				crossArr[3][map2[~~(corns[i] / 3)]] = (30 - corns[i]) % 3;
			}
			return crossArr;
		}
	}
	return null; // Not found (very rare/impossible length) → caller falls back to generate-and-test
}
