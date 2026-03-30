// Ported from cstimer gsolver.js - Step-by-step solvers for multiple methods
import {acycle, GSolver} from './mathlib-core';
import {SolverResult} from './types';

// --- Helpers ---

function appendSuffix(moves: Record<string, number>, suffix?: string): Record<string, number> {
	const ret: Record<string, number> = {};
	suffix = suffix || " 2'";
	for (const m in moves) {
		for (let i = 0; i < suffix.length; i++) {
			ret[m + suffix[i]] = moves[m];
		}
	}
	return ret;
}

function applyMoves(doMove: (s: string, m: string) => string | null, state: string, moves: string[]): string {
	for (let i = 0; i < moves.length; i++) {
		state = doMove(state, moves[i]) || state;
	}
	return state;
}

function solveParallel(
	doMove: (s: string, m: string) => string | null,
	solvs: Record<string, GSolver>,
	maps: Record<string, number>,
	fmov: string[],
	mask: number,
	MAXL: number,
	scrambleMoves: string[],
	prevSol: string[]
): [string[] | null, number] {
	let solcur: string[] | null = null;
	for (let maxl = 0; maxl < MAXL + 1; maxl++) {
		for (const solved in solvs) {
			if ((maps[solved] | mask) !== maps[solved]) continue;
			let state = solved;
			state = applyMoves(doMove, state, scrambleMoves);
			state = applyMoves(doMove, state, prevSol);
			solcur = solvs[solved].search(state, 0, maxl) || null;
			if (solcur != null) {
				mask |= maps[solved];
				return [solcur, mask];
			}
			for (let m = 0; m < fmov.length; m++) {
				const fstate = doMove(state, fmov[m]);
				if (!fstate) continue;
					solcur = solvs[solved].search(fstate, 0, maxl) || null;
				if (solcur != null) {
					solcur.unshift(fmov[m]);
					mask |= maps[solved];
					return [solcur, mask];
				}
			}
		}
	}
	return [null, mask];
}

interface StepMeta {
	move: Record<string, number>;
	maxl: number;
	fmov?: string[];
	head: string;
	step: Record<string, number>;
	solv?: Record<string, GSolver>;
}

interface StepResult {
	head: string;
	solution: string[];
}

function solveStepByStep(
	meta: StepMeta[],
	doMove: (s: string, m: string) => string | null,
	scrambleMoves: string[]
): StepResult[] {
	let mask = 0;
	const results: StepResult[] = [];
	const allSol: string[] = [];

	for (let i = 0; i < meta.length; i++) {
		if (!meta[i].solv) {
			meta[i].solv = {};
			for (const solved in meta[i].step) {
				meta[i].solv![solved] = new GSolver([solved], doMove, meta[i].move);
			}
		}
		const ret = solveParallel(
			doMove,
			meta[i].solv!,
			meta[i].step,
			meta[i].fmov || [],
			mask,
			meta[i].maxl || 10,
			scrambleMoves,
			allSol
		);
		const sol = ret[0];
		mask = ret[1];
		if (sol == null) {
			results.push({head: meta[i].head, solution: []});
			break;
		}
		results.push({head: meta[i].head, solution: sol});
		allSol.push(...sol);
	}
	return results;
}

// --- 2x2x2 Pocket Cube ---

const pocket222MoveData = [
	[[0, 1, 3, 2], [4, 8, 16, 20], [5, 9, 17, 21]], // U
	[[4, 5, 7, 6], [1, 22, 13, 9], [3, 20, 15, 11]], // R
	[[8, 9, 11, 10], [2, 4, 13, 19], [3, 6, 12, 17]], // F
];

function pocketMove(state: string, move: string): string {
	const ret = state.split('');
	const swaps = pocket222MoveData['URF'.indexOf(move[0])];
	const pow = '? 2\''.indexOf(move[1]);
	for (let i = 0; i < swaps.length; i++) {
		acycle(ret, swaps[i], pow);
	}
	return ret.join('');
}

let pocket222Solv: GSolver | null = null;

export function solve222Face(scramble: string): SolverResult[] {
	pocket222Solv =
		pocket222Solv ||
		new GSolver(
			[
				'XXXX????????????????????',
				'????XXXX????????????????',
				'????????XXXX????????????',
				'????????????XXXX????????',
				'????????????????XXXX????',
				'????????????????????XXXX',
			],
			pocketMove,
			appendSuffix({U: 1, R: 2, F: 3})
		);
	const faceStr = ['U', 'R', 'F', 'D', 'L', 'B'];
	const scrambleMoves = parseScramble222(scramble);
	let state = 'UUUURRRRFFFFDDDDLLLLBBBB';
	for (const m of scrambleMoves) {
		state = pocketMove(state, m);
	}
	const results: SolverResult[] = [];
	for (let face = 0; face < 6; face++) {
		const faceState: string[] = [];
		for (let i = 0; i < 24; i++) {
			faceState.push(state[i] === 'URFDLB'.charAt(face) ? 'X' : '?');
		}
		const sol = pocket222Solv.search(faceState.join(''), 0);
		results.push({
			face: faceStr[face],
			rotation: '',
			solution: sol || [],
			moveCount: sol ? sol.length : 0,
		});
	}
	return results;
}

function parseScramble222(scramble: string): string[] {
	const moves: string[] = [];
	const parts = scramble.trim().split(/\s+/);
	for (const p of parts) {
		if (!p) continue;
		const face = p[0];
		if ('URF'.indexOf(face) === -1) continue;
		const mod = p.length > 1 ? p[1] : ' ';
		moves.push(face + mod);
	}
	return moves;
}

// --- 3x3x3 Rubik's Cube ---

const cube333MoveData = [
	[[0, 2, 8, 6], [1, 5, 7, 3], [18, 36, 45, 9], [19, 37, 46, 10], [20, 38, 47, 11]], // U
	[[9, 11, 17, 15], [10, 14, 16, 12], [2, 51, 29, 20], [5, 48, 32, 23], [8, 45, 35, 26]], // R
	[[18, 20, 26, 24], [19, 23, 25, 21], [6, 9, 29, 44], [7, 12, 28, 41], [8, 15, 27, 38]], // F
	[[27, 29, 35, 33], [28, 32, 34, 30], [24, 15, 51, 42], [25, 16, 52, 43], [26, 17, 53, 44]], // D
	[[36, 38, 44, 42], [37, 41, 43, 39], [0, 18, 27, 53], [3, 21, 30, 50], [6, 24, 33, 47]], // L
	[[45, 47, 53, 51], [46, 50, 52, 48], [2, 36, 33, 17], [1, 39, 34, 14], [0, 42, 35, 11]], // B
	// Wide moves (u, r, f, d, l, b)
	[[0, 2, 8, 6], [1, 5, 7, 3], [18, 36, 45, 9], [19, 37, 46, 10], [20, 38, 47, 11],
	 [21, 39, 48, 12], [22, 40, 49, 13], [23, 41, 50, 14]], // u
	[[9, 11, 17, 15], [10, 14, 16, 12], [2, 51, 29, 20], [5, 48, 32, 23], [8, 45, 35, 26],
	 [1, 52, 28, 19], [4, 49, 31, 22], [7, 46, 34, 25]], // r
	[[18, 20, 26, 24], [19, 23, 25, 21], [6, 9, 29, 44], [7, 12, 28, 41], [8, 15, 27, 38],
	 [3, 10, 32, 43], [4, 13, 31, 40], [5, 16, 30, 37]], // f
	[[27, 29, 35, 33], [28, 32, 34, 30], [24, 15, 51, 42], [25, 16, 52, 43], [26, 17, 53, 44],
	 [21, 12, 48, 39], [22, 13, 49, 40], [23, 14, 50, 41]], // d
	[[36, 38, 44, 42], [37, 41, 43, 39], [0, 18, 27, 53], [3, 21, 30, 50], [6, 24, 33, 47],
	 [1, 19, 28, 52], [4, 22, 31, 49], [7, 25, 34, 46]], // l
	[[45, 47, 53, 51], [46, 50, 52, 48], [2, 36, 33, 17], [1, 39, 34, 14], [0, 42, 35, 11],
	 [5, 37, 30, 16], [4, 40, 31, 13], [3, 43, 32, 10]], // b
	// M, E, S
	[[1, 19, 28, 52], [4, 22, 31, 49], [7, 25, 34, 46]], // M
	[[21, 12, 48, 39], [22, 13, 49, 40], [23, 14, 50, 41]], // E
	[[3, 10, 32, 43], [4, 13, 31, 40], [5, 16, 30, 37]], // S
	// x, y, z
	[[9, 11, 17, 15], [10, 14, 16, 12], [2, 51, 29, 20], [5, 48, 32, 23], [8, 45, 35, 26],
	 [36, 42, 44, 38], [37, 39, 43, 41], [0, 53, 27, 18], [3, 50, 30, 21], [6, 47, 33, 24],
	 [1, 52, 28, 19], [4, 49, 31, 22], [7, 46, 34, 25]], // x
	[[0, 2, 8, 6], [1, 5, 7, 3], [18, 36, 45, 9], [19, 37, 46, 10], [20, 38, 47, 11],
	 [27, 33, 35, 29], [28, 30, 34, 32], [24, 42, 51, 15], [25, 43, 52, 16], [26, 44, 53, 17],
	 [21, 39, 48, 12], [22, 40, 49, 13], [23, 41, 50, 14]], // y
	[[18, 20, 26, 24], [19, 23, 25, 21], [6, 9, 29, 44], [7, 12, 28, 41], [8, 15, 27, 38],
	 [45, 51, 53, 47], [46, 48, 52, 50], [2, 11, 35, 42], [1, 14, 34, 39], [0, 17, 33, 36],
	 [3, 10, 32, 43], [4, 13, 31, 40], [5, 16, 30, 37]], // z
];

const MOVE_CHARS = 'URFDLBurfdlbMESxyz';

function cubeMove(state: string, move: string): string {
	const ret = state.split('');
	const swaps = cube333MoveData[MOVE_CHARS.indexOf(move[0])];
	if (!swaps) return state;
	const pow = '? 2\''.indexOf(move[1]);
	for (let i = 0; i < swaps.length; i++) {
		acycle(ret, swaps[i], pow);
	}
	return ret.join('');
}

const moves333 = appendSuffix({U: 0x00, R: 0x11, F: 0x22, D: 0x30, L: 0x41, B: 0x52});
const movesWithoutD = appendSuffix({U: 0x00, R: 0x11, F: 0x22, L: 0x41, B: 0x52});
const movesRouxSB = appendSuffix({U: 0x00, R: 0x11, M: 0x61, r: 0x71});
const movesZZF2L = appendSuffix({U: 0x00, R: 0x11, L: 0x41});

function parseScramble333(scramble: string, moveMap?: string): string[] {
	moveMap = moveMap || 'URFDLB';
	const moves: string[] = [];
	const parts = scramble.trim().split(/\s+/);
	for (const p of parts) {
		if (!p) continue;
		const faceIdx = 'URFDLBurfdlbMESxyz'.indexOf(p[0]);
		if (faceIdx === -1) continue;
		const mod = p.length > 1 ? p[1] : ' ';
		if (faceIdx < 6) {
			moves.push(moveMap.charAt(faceIdx) + mod);
		} else {
			moves.push(p[0] + mod);
		}
	}
	return moves;
}

function getMoveMap(ori: string): string {
	const rot = ori.split(' ');
	const map = [0, 1, 2, 3, 4, 5];
	const rotMap = [
		[5, 1, 0, 2, 4, 3], // x
		[0, 2, 4, 3, 5, 1], // y
		[1, 3, 2, 4, 0, 5], // z
	];
	for (const r of rot) {
		if (!r[0]) continue;
		const axis = 'xyz'.indexOf(r[0]);
		if (axis === -1) continue;
		const pow = '? 2\''.indexOf(r[1] || ' ');
		for (let p = 0; p < pow; p++) {
			const newMap = [...map];
			for (let j = 0; j < 6; j++) {
				newMap[j] = rotMap[axis][map[j]];
			}
			map.splice(0, 6, ...newMap);
		}
	}
	return map.map((i) => 'URFDLB'.charAt(i)).join('');
}

// --- CFOP ---

const cfMeta: StepMeta[] = [
	{
		move: moves333,
		maxl: 8,
		head: 'Cross',
		step: {'----U--------R--R-----F--F--D-DDD-D-----L--L-----B--B-': 0x0},
	},
	{
		move: movesWithoutD,
		maxl: 10,
		head: 'F2L-1',
		step: {
			'----U-------RR-RR-----FF-FF-DDDDD-D-----L--L-----B--B-': 0x1,
			'----U--------R--R----FF-FF-DD-DDD-D-----LL-LL----B--B-': 0x2,
			'----U--------RR-RR----F--F--D-DDD-DD----L--L----BB-BB-': 0x4,
			'----U--------R--R-----F--F--D-DDDDD----LL-LL-----BB-BB': 0x8,
		},
	},
	{
		move: movesWithoutD,
		maxl: 10,
		head: 'F2L-2',
		step: {
			'----U-------RR-RR----FFFFFFDDDDDD-D-----LL-LL----B--B-': 0x3,
			'----U-------RRRRRR----FF-FF-DDDDD-DD----L--L----BB-BB-': 0x5,
			'----U--------RR-RR---FF-FF-DD-DDD-DD----LL-LL---BB-BB-': 0x6,
			'----U-------RR-RR-----FF-FF-DDDDDDD----LL-LL-----BB-BB': 0x9,
			'----U--------R--R----FF-FF-DD-DDDDD----LLLLLL----BB-BB': 0xa,
			'----U--------RR-RR----F--F--D-DDDDDD---LL-LL----BBBBBB': 0xc,
		},
	},
	{
		move: movesWithoutD,
		maxl: 10,
		head: 'F2L-3',
		step: {
			'----U-------RRRRRR---FFFFFFDDDDDD-DD----LL-LL---BB-BB-': 0x7,
			'----U-------RR-RR----FFFFFFDDDDDDDD----LLLLLL----BB-BB': 0xb,
			'----U-------RRRRRR----FF-FF-DDDDDDDD---LL-LL----BBBBBB': 0xd,
			'----U--------RR-RR---FF-FF-DD-DDDDDD---LLLLLL---BBBBBB': 0xe,
		},
	},
	{
		move: movesWithoutD,
		maxl: 10,
		head: 'F2L-4',
		step: {'----U-------RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB': 0xf},
	},
];

// --- Roux ---

const sabMeta: StepMeta[] = [
	{
		move: moves333,
		maxl: 10,
		fmov: ['x ', 'x2', "x'"],
		head: 'Step 1',
		step: {'---------------------F--F--D--D--D-----LLLLLL-----B--B': 0x0},
	},
	{
		move: movesRouxSB,
		maxl: 16,
		head: 'Step 2',
		step: {'------------RRRRRR---F-FF-FD-DD-DD-D---LLLLLL---B-BB-B': 0x1},
	},
];

// --- Petrus ---

const petrusMeta: StepMeta[] = [
	{
		move: moves333,
		maxl: 8,
		head: '2x2x2',
		step: {
			'---------------------FF-FF-DD-DD--------LL-LL---------': 0x1,
			'------------------------------DD-DD----LL-LL-----BB-BB': 0x2,
		},
	},
	{
		move: moves333,
		maxl: 10,
		head: '2x2x3',
		step: {'---------------------FF-FF-DD-DD-DD----LLLLLL----BB-BB': 0x3},
	},
];

// --- ZZ ---

const zzMeta: StepMeta[] = [
	{
		move: moves333,
		maxl: 10,
		head: 'EOLine',
		step: {'-H-HUH-H-----R-------HFH-F--D-HDH-D-----L-------HBH-B-': 0x0},
	},
	{
		move: movesZZF2L,
		maxl: 16,
		head: 'ZZF2L1',
		step: {
			'-H-HUH-H----RRRRRR---HFF-FF-DDHDD-DD----L-------BBHBB-': 0x1,
			'-H-HUH-H-----R-------FFHFF-DD-DDHDD----LLLLLL---HBB-BB': 0x2,
		},
	},
	{
		move: movesZZF2L,
		maxl: 16,
		head: 'ZZF2L2',
		step: {'-H-HUH-H----RRRRRR---FFFFFFDDDDDDDDD---LLLLLL---BBBBBB': 0x3},
	},
];

// --- EODR ---

const eodrMeta: StepMeta[] = [
	{
		move: moves333,
		maxl: 7,
		head: 'EO',
		step: {'-H-HUH-H-----R-------HFH----H-HDH-H-----L-------HBH---': 0x0},
	},
	{
		move: moves333,
		maxl: 10,
		head: 'DR',
		step: {'UUUUUUUUU---RRR------FFF---UUUUUUUUU---RRR------FFF---': 0x1},
	},
];

// --- 2x2x2 Block (8 corners) ---

const block222FaceSolved = [
	'----UU-UURR-RR-----FF-FF------------------------------',
	'---UU-UU----------FF-FF--------------LL-LL------------',
	'UU-UU-------------------------------LL-LL-----BB-BB---',
	'-UU-UU----RR-RR------------------------------BB-BB----',
	'------------RR-RR-----FF-FF-DD-DD---------------------',
	'---------------------FF-FF-DD-DD--------LL-LL---------',
	'------------------------------DD-DD----LL-LL-----BB-BB',
	'-------------RR-RR-------------DD-DD------------BB-BB-',
];
const block222FaceStr = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
let block222Solv: GSolver | null = null;

export function solve333Block222(scramble: string): SolverResult[] {
	block222Solv = block222Solv || new GSolver(block222FaceSolved, cubeMove, moves333);
	const scrambleMoves = parseScramble333(scramble);
	const results: SolverResult[] = [];
	for (let i = 0; i < 8; i++) {
		let state = block222FaceSolved[i];
		state = applyMoves(cubeMove, state, scrambleMoves);
		const sol = block222Solv.search(state, 0);
		results.push({
			face: block222FaceStr[i],
			rotation: '',
			solution: sol || [],
			moveCount: sol ? sol.length : 0,
		});
	}
	return results;
}

// --- 3x3x3 Step solvers ---

function solve333Steps(meta: StepMeta[], scramble: string, ori?: string): SolverResult[] {
	const moveMap = getMoveMap(ori || 'z2');
	const scrambleMoves = parseScramble333(scramble, moveMap);
	const steps = solveStepByStep(meta, cubeMove, scrambleMoves);
	return steps.map((s) => ({
		face: s.head,
		rotation: ori || 'z2',
		solution: s.solution,
		moveCount: s.solution.length,
	}));
}

export function solve333CF(scramble: string, ori?: string): SolverResult[] {
	return solve333Steps(cfMeta, scramble, ori);
}

export function solve333Roux(scramble: string, ori?: string): SolverResult[] {
	return solve333Steps(sabMeta, scramble, ori);
}

export function solve333Petrus(scramble: string, ori?: string): SolverResult[] {
	return solve333Steps(petrusMeta, scramble, ori);
}

export function solve333ZZ(scramble: string, ori?: string): SolverResult[] {
	return solve333Steps(zzMeta, scramble, ori);
}

export function solve333EODR(scramble: string, ori?: string): SolverResult[] {
	return solve333Steps(eodrMeta, scramble, ori);
}

// --- SQ1 ---

const sq1Moves: Record<string, number> = {'0': 0x21};
for (let m = 1; m < 12; m++) {
	sq1Moves['' + m] = 0x00;
	sq1Moves['' + -m] = 0x10;
}

function sq1Move(state: string, move: string): string | null {
	if (!state) return null;
	const m = ~~(move as unknown as number);
	const parts = state.split('|');
	if (m === 0) {
		const tmp = parts[0].slice(6);
		parts[0] = parts[0].slice(0, 6) + parts[1].slice(6);
		parts[1] = parts[1].slice(0, 6) + tmp;
	} else {
		const idx = m > 0 ? 0 : 1;
		const absM = Math.abs(m);
		parts[idx] = parts[idx].slice(absM) + parts[idx].slice(0, absM);
		if (/[a-h]/.exec(parts[idx][0] + parts[idx][6])) {
			return null;
		}
	}
	return parts.join('|');
}

function prettySq1(sol: string[]): string[] {
	let u = 0;
	let d = 0;
	const ret: string[] = [];
	for (const s of sol) {
		const n = ~~(s as unknown as number);
		if (n === 0) {
			if (u === 0 && d === 0) {
				ret.push('/');
			} else {
				ret.push(`${((u + 5) % 12) - 5},${((d + 5) % 12) - 5}/`);
			}
			u = d = 0;
		} else if (n > 0) {
			u += n;
		} else {
			d -= n;
		}
	}
	return ret;
}

let sq1Solv1: GSolver | null = null;
let sq1Solv2: GSolver | null = null;

export function solveSQ1(scramble: string): SolverResult[] {
	sq1Solv1 =
		sq1Solv1 ||
		new GSolver(
			[
				'0Aa0Aa0Aa0Aa|Aa0Aa0Aa0Aa0',
				'0Aa0Aa0Aa0Aa|0Aa0Aa0Aa0Aa',
				'Aa0Aa0Aa0Aa0|Aa0Aa0Aa0Aa0',
				'Aa0Aa0Aa0Aa0|0Aa0Aa0Aa0Aa',
			],
			sq1Move,
			sq1Moves
		);
	sq1Solv2 =
		sq1Solv2 ||
		new GSolver(
			[
				'0Aa0Aa0Aa0Aa|Bb1Bb1Bb1Bb1',
				'0Aa0Aa0Aa0Aa|1Bb1Bb1Bb1Bb',
				'Aa0Aa0Aa0Aa0|Bb1Bb1Bb1Bb1',
				'Aa0Aa0Aa0Aa0|1Bb1Bb1Bb1Bb',
			],
			sq1Move,
			sq1Moves
		);
	// Parse SQ1 scramble
	const curScramble: number[] = [];
	const movere = /^\s*\(\s*(-?\d+),\s*(-?\d+)\s*\)\s*$/;
	const moveseq = scramble.split('/');
	for (const seg of moveseq) {
		if (/^\s*$/.exec(seg)) {
			curScramble.push(0);
			continue;
		}
		const m = movere.exec(seg);
		if (!m) continue;
		if (~~m[1]) curScramble.push(((~~m[1] + 12) % 12));
		if (~~m[2]) curScramble.push(-((~~m[2] + 12) % 12));
		curScramble.push(0);
	}
	if (curScramble.length > 0) curScramble.pop();

	const scrambleMoves = curScramble.map(String);

	// Step 1: Shape
	let state1 = '0Aa0Aa0Aa0Aa|Aa0Aa0Aa0Aa0';
	state1 = applyMoves(sq1Move as (s: string, m: string) => string, state1, scrambleMoves);
	const sol1 = sq1Solv1.search(state1, 0);
	const allMoves = [...scrambleMoves, ...(sol1 || [])];

	// Step 2: Color
	let state2 = '0Aa0Aa0Aa0Aa|Bb1Bb1Bb1Bb1';
	state2 = applyMoves(sq1Move as (s: string, m: string) => string, state2, allMoves);
	const sol2 = sq1Solv2.search(state2, 0);

	return [
		{
			face: 'Shape',
			rotation: '',
			solution: sol1 ? prettySq1(sol1) : [],
			moveCount: sol1 ? sol1.length : 0,
		},
		{
			face: 'Color',
			rotation: '',
			solution: sol2 ? prettySq1(sol2) : [],
			moveCount: sol2 ? sol2.length : 0,
		},
	];
}

// --- Pyraminx ---

const pyraMoveData = [
	[[5, 9, 22], [0, 7, 20], [1, 8, 18]], // R
	[[3, 16, 11], [1, 14, 6], [2, 12, 7]], // U
	[[4, 23, 15], [2, 18, 13], [0, 19, 14]], // L
	[[10, 17, 21], [8, 12, 19], [6, 13, 20]], // B
];

function pyraMove(state: string, move: string): string {
	const ret = state.split('');
	const swaps = pyraMoveData['RULB'.indexOf(move[0])];
	const pow = "? '".indexOf(move[1]);
	for (let i = 0; i < swaps.length; i++) {
		acycle(ret, swaps[i], pow);
	}
	return ret.join('');
}

let pyraSolv: GSolver | null = null;

export function solvePyraminx(scramble: string): SolverResult[] {
	pyraSolv =
		pyraSolv ||
		new GSolver(
			['????FF??RRR??L?L?L?DDDDD'],
			pyraMove,
			appendSuffix({R: 0x0, U: 0x1, L: 0x2, B: 0x3}, " '")
		);

	// Parse: only outer layer moves (width 1)
	const rawMoves: string[] = [];
	const parts = scramble.trim().split(/\s+/);
	for (const p of parts) {
		if (!p) continue;
		const face = p[0];
		if ('RULBrulb'.indexOf(face) === -1) continue;
		if (face === face.toLowerCase()) continue; // skip tips
		const mod = p.length > 1 ? p[1] : ' ';
		rawMoves.push(face + mod);
	}

	const faceStr = ['D', 'L', 'R', 'F'];
	const rawMap = 'RULB';
	const moveMaps = [
		['RULB', 'LUBR', 'BURL'],
		['URBL', 'LRUB', 'BRLU'],
		['RLBU', 'ULRB', 'BLUR'],
		['RBUL', 'UBLR', 'LBRU'],
	];

	const results: SolverResult[] = [];
	for (let i = 0; i < 4; i++) {
		let sol1: string[] | null = null;
		for (let depth = 0; depth < 99; depth++) {
			let found = false;
			for (let j = 0; j < 3; j++) {
				const moveMap = moveMaps[i][j];
				const mappedScramble: string[] = rawMoves.map(
					(m) => rawMap[moveMap.indexOf(m[0])] + m[1]
				);
				let state = '????FF??RRR??L?L?L?DDDDD';
				state = applyMoves(pyraMove, state, mappedScramble);
				sol1 = pyraSolv.search(state, depth, depth);
				if (!sol1) continue;
				// Map solution back
				sol1 = sol1.map((m) => moveMap[rawMap.indexOf(m[0])] + m[1]);
				found = true;
				break;
			}
			if (found) break;
		}
		results.push({
			face: faceStr[i],
			rotation: '',
			solution: sol1 || [],
			moveCount: sol1 ? sol1.length : 0,
		});
	}
	return results;
}

// --- Skewb ---

const skewbMoveData = [
	[[5, 25, 15], [9, 28, 17], [7, 29, 16], [8, 26, 19], [23, 14, 4]], // R
	[[0, 20, 25], [2, 21, 27], [4, 22, 29], [1, 23, 26], [19, 7, 11]], // U
	[[10, 15, 20], [13, 18, 24], [11, 16, 23], [14, 19, 22], [29, 1, 8]], // L
	[[25, 20, 15], [29, 23, 19], [28, 21, 18], [27, 24, 17], [13, 9, 2]], // B
	[[0, 25, 5], [4, 26, 7], [3, 27, 9], [2, 28, 6], [17, 12, 21]], // r
	[[0, 20, 25], [2, 21, 27], [4, 22, 29], [1, 23, 26], [19, 7, 11]], // b (same as U)
	// x (rotation)
	[[0, 25, 15, 10], [1, 27, 19, 13], [2, 29, 17, 11], [3, 26, 18, 14], [4, 28, 16, 12],
	 [6, 7, 9, 8], [21, 23, 24, 22]], // x
	// y (rotation)
	[[5, 10, 20, 25], [6, 11, 21, 26], [7, 12, 22, 27], [8, 13, 23, 28], [9, 14, 24, 29],
	 [1, 2, 4, 3], [16, 18, 19, 17]], // y
	[], // empty
];

function skewbMove(state: string, move: string): string {
	const ret = state.split('');
	const swaps = skewbMoveData['RULBrbxy'.indexOf(move[0])];
	if (!swaps || swaps.length === 0) return state;
	const pow = "? '*".indexOf(move[1]);
	for (let i = 0; i < swaps.length; i++) {
		acycle(ret, swaps[i], pow);
	}
	return ret.join('');
}

let skewbSolv: GSolver | null = null;

export function solveSkewb(scramble: string): SolverResult[] {
	skewbSolv =
		skewbSolv ||
		new GSolver(
			[
				'?L?L??B?B?UUUUU?R?R???F?F?????',
				'?F?F??L?L?UUUUU?B?B???R?R?????',
				'?R?R??F?F?UUUUU?L?L???B?B?????',
				'?B?B??R?R?UUUUU?F?F???L?L?????',
			],
			skewbMove,
			appendSuffix({R: 0x0, r: 0x1, B: 0x2, b: 0x3}, " '")
		);

	const scrambleMoves: string[] = [];
	const parts = scramble.trim().split(/\s+/);
	for (const p of parts) {
		if (!p) continue;
		const face = p[0];
		if ('RULBrb'.indexOf(face) === -1) continue;
		const mod = p.length > 1 ? p[1] : ' ';
		scrambleMoves.push(face + mod);
	}

	const faceStr = ['U', 'R', 'F', 'D', 'L', 'B'];
	const faceSolved = [
		'UUUUU?RR???FF????????LL???BB??',
		'???BBUUUUU??L?L?FF????????R?R?',
		'?B?B??R?R?UUUUU?F?F???L?L?????',
		'????????RR???BBUUUUU???LL???FF',
		'?BB????????R?R????FFUUUUU??L?L',
		'??F?F??R?R???????B?B?L?L?UUUUU',
	];

	const results: SolverResult[] = [];
	for (let i = 0; i < 6; i++) {
		let state = 'U????R????F????D????L????B????';
		state = applyMoves(skewbMove, state, scrambleMoves);
		const ori = ['x*', 'y ', '', 'x ', 'y*', "y'"];
		const uidx = ~~(state.indexOf(faceStr[i]) / 5);
		const preRot = ori[uidx] || '';

		// Apply pre-rotation to get face on top
		let solState = faceSolved[i];
		solState = applyMoves(skewbMove, solState, scrambleMoves);
		if (preRot) {
			solState = skewbMove(solState, preRot);
		}

		const sol = skewbSolv.search(solState, 0);
		const rotStr = preRot ? preRot.replace("'", '2').replace('*', "'") : '';

		results.push({
			face: faceStr[i],
			rotation: rotStr,
			solution: sol || [],
			moveCount: sol ? sol.length : 0,
		});
	}
	return results;
}
