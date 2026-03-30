// Ported from cstimer eoline.js - EOLine and EOCross solver
import {createMove, edgeMove, Solver} from './mathlib-core';
import {parseScramble} from './parse-scramble';
import {SolverResult} from './types';

const fmvTable: number[][] = [];
const pmvTable: number[][] = [];

let eolineInited = false;

function permMove(idx: number, m: number): number {
	const arr = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	let a = idx % 12;
	let b = ~~(idx / 12);
	if (b >= a) b++;
	arr[a] = 2;
	arr[b] = 4;

	edgeMove(arr, m);

	for (let i = 0; i < 12; i++) {
		if ((arr[i] >> 1) === 1) {
			a = i;
		} else if ((arr[i] >> 1) === 2) {
			b = i;
		}
	}
	if (b > a) b--;
	return b * 12 + a;
}

function initEOLineInternal(): void {
	if (eolineInited) return;
	eolineInited = true;
	createMove(fmvTable, 2048, [edgeMove, 'o', 12, -2]);
	createMove(pmvTable, 132, permMove);
}

// EOLine solver: EO + 1 edge pair (DF/DB)
const solvEOLine = new Solver(6, 3, [
	[0, [edgeMove, 'o', 12, -2], 2048],
	[9 * 12 + 8, permMove, 132],
]);

// EOCross solver: EO + 2 edge pairs
const solvEOCross = new Solver(6, 3, [
	[0, [edgeMove, 'o', 12, -2], 2048],
	[9 * 12 + 8, permMove, 132],
	[10 * 12 + 9, permMove, 132],
]);

const FACE_STR = [
	'D(LR)',
	'D(FB)',
	'U(LR)',
	'U(FB)',
	'L(UD)',
	'L(FB)',
	'R(UD)',
	'R(FB)',
	'F(LR)',
	'F(UD)',
	'B(LR)',
	'B(UD)',
];
const MOVE_IDX = [
	'FRUBLD',
	'RBULFD',
	'FLDBRU',
	'LBDRFU',
	'FDRBUL',
	'DBRUFL',
	'FULBDR',
	'UBLDFR',
	'URBDLF',
	'RDBLUF',
	'DRFULB',
	'RUFLDB',
];
const ROT_IDX = ['', 'y', 'z2', 'z2 y', "z'", "z' y", 'z', 'z y', "x'", "x' y", 'x', 'x y'];

export function initEOLine(): void {
	initEOLineInternal();
}

export function solveEOLine(scramble: string): SolverResult[] {
	initEOLineInternal();
	const moves = parseScramble(scramble, 'FRUBLD');
	const results: SolverResult[] = [];

	for (let face = 0; face < 12; face++) {
		let flip = 0;
		let perm1 = 9 * 12 + 8;
		let perm2 = 10 * 12 + 9;

		for (let i = 0; i < moves.length; i++) {
			const m = MOVE_IDX[face].indexOf('FRUBLD'.charAt(moves[i][0]));
			const p = moves[i][2];
			for (let j = 0; j < p; j++) {
				flip = fmvTable[m][flip];
				perm1 = pmvTable[m][perm1];
				perm2 = pmvTable[m][perm2];
			}
		}

		const sol = solvEOLine.search([flip, perm1], 0);
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

export function solveEOCross(scramble: string): SolverResult[] {
	initEOLineInternal();
	const moves = parseScramble(scramble, 'FRUBLD');
	const results: SolverResult[] = [];

	for (let face = 0; face < 12; face++) {
		let flip = 0;
		let perm1 = 9 * 12 + 8;
		let perm2 = 10 * 12 + 9;

		for (let i = 0; i < moves.length; i++) {
			const m = MOVE_IDX[face].indexOf('FRUBLD'.charAt(moves[i][0]));
			const p = moves[i][2];
			for (let j = 0; j < p; j++) {
				flip = fmvTable[m][flip];
				perm1 = pmvTable[m][perm1];
				perm2 = pmvTable[m][perm2];
			}
		}

		const sol = solvEOCross.search([flip, perm1, perm2], 0);
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
