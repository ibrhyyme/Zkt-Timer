// Ported from cstimer roux1.js - Roux First Block solver
import {circle, CubieCube, Solver} from './mathlib-core';
import {parseScramble} from './parse-scramble';
import {SolverResult} from './types';

const cc = new CubieCube();
const cd = new CubieCube();

function cMove(idx: number, m: number): number {
	cc.ca = [0, 0, 0, 0, 0, 0, 0, 0];
	for (let i = 1; i < 3; i++) {
		const val = idx % 24;
		idx = ~~(idx / 24);
		cc.ca[val & 0x7] = i | (val & 0x18);
	}
	CubieCube.CornMult(cc, CubieCube.moveCube[m * 3], cd);
	const ret: number[] = [];
	for (let i = 0; i < 8; i++) {
		ret[cd.ca[i] & 0x7] = i | (cd.ca[i] & 0x18);
	}
	idx = 0;
	for (let i = 2; i > 0; i--) {
		idx = idx * 24 + ret[i];
	}
	return idx;
}

function eMove(idx: number, m: number): number {
	cc.ea = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
	for (let i = 1; i < 4; i++) {
		const val = idx % 24;
		idx = ~~(idx / 24);
		cc.ea[val >> 1] = (i << 1) | (val & 1);
	}
	CubieCube.EdgeMult(cc, CubieCube.moveCube[m * 3], cd);
	const ret: number[] = [];
	for (let i = 0; i < 12; i++) {
		ret[cd.ea[i] >> 1] = (i << 1) | (cd.ea[i] & 1);
	}
	idx = 0;
	for (let i = 3; i > 0; i--) {
		idx = idx * 24 + ret[i];
	}
	return idx;
}

const SOLVED_CORN = 5 * 24 + 6;
const SOLVED_EDGE = 20 * 24 * 24 + 18 * 24 + 12;

const solv = new Solver(6, 3, [
	[SOLVED_CORN, cMove, 24 * 24],
	[SOLVED_EDGE, eMove, 24 * 24 * 24],
]);

const FACE_STR = ['LU', 'LD', 'FU', 'FD'];
const MOVE_IDX = ['DRBULF', 'URFDLB', 'DBLUFR', 'UBRDFL'];
const ROT_IDX = ['', '', 'y', 'y'];

interface Roux1OriResult {
	sol: number[][];
	ori: number;
}

function solveRoux1Ori(scramble: string, solvOri: string): Roux1OriResult | null {
	const corn: number[] = [SOLVED_CORN];
	const edge: number[] = [SOLVED_EDGE];
	for (let i = 1; i < 4; i++) {
		corn[i] = cMove(corn[i - 1], 4); // L move
		edge[i] = eMove(edge[i - 1], 4);
	}

	const moveConj: string[] = [];
	const solvOriArr = solvOri.split('');
	for (let s = 0; s < 4; s++) {
		moveConj[s] = solvOriArr.join('');
		const moves = parseScramble(scramble, moveConj[s]);
		for (let i = 0; i < moves.length; i++) {
			const m = moves[i][0];
			for (let j = 0; j < moves[i][2]; j++) {
				corn[s] = cMove(corn[s], m);
				edge[s] = eMove(edge[s], m);
			}
		}
		circle(solvOriArr, 0, 2, 3, 5);
	}

	for (let maxl = 1; maxl < 12; maxl++) {
		for (let s = 0; s < 4; s++) {
			const sol = solv.search([corn[s], edge[s]], maxl === 1 ? 0 : maxl, maxl);
			if (sol) {
				return {sol, ori: s};
			}
		}
	}
	return null;
}

export function initRoux1(): void {
	// Solver initializes lazily on first search
}

export function solveRoux1(scramble: string): SolverResult[] {
	const results: SolverResult[] = [];

	for (let face = 0; face < 4; face++) {
		const result = solveRoux1Ori(scramble, MOVE_IDX[face]);
		if (!result) {
			results.push({
				face: FACE_STR[face],
				rotation: ROT_IDX[face],
				solution: [],
				moveCount: 0,
			});
			continue;
		}

		let ori = result.ori;
		const sol = result.sol;

		if (face % 2 === 0) {
			ori = (ori + 2) % 4;
		}

		const xRotStr = ['', "x'", 'x2', 'x'][ori];
		const solution: string[] = [];
		for (let i = 0; i < sol.length; i++) {
			solution.push('URFDLB'.charAt(sol[i][0]) + ' 2\''.charAt(sol[i][1]));
		}

		const rotParts = [ROT_IDX[face], xRotStr].filter(Boolean);

		results.push({
			face: FACE_STR[face],
			rotation: rotParts.join(' '),
			solution,
			moveCount: solution.length,
		});
	}

	return results;
}
