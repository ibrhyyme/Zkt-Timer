/**
 * Face-Turning Octahedron (FTO) scramble generator.
 * Ported from cstimer scramble/scramble_fto.js (GPLv3) — https://github.com/cs0x7f/cstimer
 *
 * Registers:
 *   ftoso   — random state (WCA scramble)
 *   ftol3t  — last 3 triangles
 *   ftol4t  — last 3 triangles + last back triangle (L3T+LBT)
 *   ftotcp  — three corner permutation
 *   ftoedge — edges only (centers + corners solved)
 *   ftocent — centers only (edges + corners solved)
 *   ftocorn — corners only (edges + centers solved)
 */

import { rn, rndPerm, setNOri } from '../lib/mathlib';
import { permInv, permMult, SubgroupSolver } from '../lib/grouplib';
import { getFamousPuzzle, makePuzzle } from '../lib/poly3dlib';
import { registerGenerator } from '../registry';
import { FtoCubie, solveFacelet } from '../solvers/fto-solver';

function getRandomScramble(solvedEdge: boolean, solvedCenter: boolean, solvedCorner: boolean): string {
	const fc = new FtoCubie();
	if (!solvedEdge) {
		fc.ep = rndPerm(12, true);
	}
	if (!solvedCenter) {
		fc.uf = rndPerm(12, true);
		fc.rl = rndPerm(12, true);
	}
	if (!solvedCorner) {
		fc.cp = rndPerm(6, true);
		setNOri(fc.co, rn(32), 6, -2);
	}
	return solveFacelet(fc.toFaceCube(), true);
}

function getLNTScramble(ufs: number[]): string {
	let solved = false;
	const nCorn = ufs.length >> 1;
	const fc = new FtoCubie();
	let cp: number[], co: number[], uf: number[];
	do {
		cp = rndPerm(nCorn, true);
		co = setNOri([], rn(1 << nCorn >> 1), nCorn, -2);
		uf = rndPerm(ufs.length, true);
		solved = true;
		for (let i = 0; i < ufs.length; i++) {
			solved = solved && (~~(ufs[uf[i]] / 3) == ~~(ufs[i] / 3));
		}
		for (let i = 0; i < nCorn; i++) {
			solved = solved && cp[i] == i && co[i] == 0;
		}
	} while (solved);
	for (let i = 0; i < nCorn; i++) {
		fc.cp[i] = cp[i];
		fc.co[i] = co[i];
	}
	for (let i = 0; i < ufs.length; i++) {
		fc.uf[ufs[i]] = ufs[uf[i]];
	}
	return solveFacelet(fc.toFaceCube(), true);
}

function getTCPScramble(): string {
	const fc = new FtoCubie();
	let cp: number[], co: number[], uf: number[];
	const ufs = [1, 2, 3, 7, 11];
	do {
		cp = rndPerm(3, true);
		co = [0].concat(setNOri([], rn(2), 2, -2));
		uf = rndPerm(5, true);
	} while (ufs[uf[0]] < 3 || ufs[uf[1]] < 3);
	for (let i = 0; i < 3; i++) {
		fc.cp[i] = cp[i];
		fc.co[i] = co[i];
	}
	for (let i = 0; i < ufs.length; i++) {
		fc.uf[ufs[i]] = ufs[uf[i]];
	}
	return solveFacelet(fc.toFaceCube(), true);
}

registerGenerator('ftoso', () => getRandomScramble(false, false, false));
registerGenerator('ftol3t', () => getLNTScramble([0, 1, 2, 3, 7, 11]));
registerGenerator('ftol4t', () => getLNTScramble([0, 1, 2, 3, 6, 7, 9, 11]));
registerGenerator('ftotcp', () => getTCPScramble());
registerGenerator('ftoedge', () => getRandomScramble(false, true, true));
registerGenerator('ftocent', () => getRandomScramble(true, false, true));
registerGenerator('ftocorn', () => getRandomScramble(true, true, false));

// ==================== Diamond (dmdso) — poly3dlib random-state via grouplib ====================
// Ported from cstimer scramble/utilscramble.js (PolyScrambler + dmdso case).

type Move2Str = (mv: string, pow: number) => string;

class PolyScrambler {
	solv: SubgroupSolver;
	move2str: Move2Str;
	moves: string[];

	constructor(puzzleName: string, validMoves: string[], move2str: Move2Str) {
		const pobj = getFamousPuzzle(puzzleName)!;
		const puzzle = makePuzzle.apply(null, pobj.polyParam as any);
		const permLen = puzzle.moveTable[0].length;
		const e: number[] = [];
		for (let i = 0; i < permLen; i++) {
			e[i] = i;
		}
		const gens: number[][] = [];
		for (let i = 0; i < validMoves.length; i++) {
			const move = pobj.parser!.parseScramble(validMoves[i]);
			let perm = e.slice();
			for (let j = 0; j < move.length; j++) {
				let pow = move[j][1];
				if (pow == 0) {
					continue;
				}
				let operm = puzzle.moveTable[puzzle.getTwistyIdx(move[j][0])].slice();
				for (let k = 0; k < operm.length; k++) {
					operm[k] = operm[k] >= 0 ? operm[k] : k;
				}
				if (pow < 0) {
					operm = permInv(operm);
					pow = -pow;
				}
				while (--pow >= 0) {
					perm = permMult(perm, operm);
				}
			}
			gens.push(perm);
		}
		this.solv = new SubgroupSolver(gens);
		this.move2str = move2str;
		this.moves = validMoves;
		this.solv.initTables();
	}

	getScramble(minLen: number, maxLen: number): string {
		let solution = "";
		do {
			const state = this.solv.sgsG.rndElem();
			const sol = this.solv.DissectionSolve(state, minLen, maxLen) || [];
			solution = sol.map((mvpow: number[]) => this.move2str(this.moves[mvpow[0]], mvpow[1])).join(" ");
		} while (solution.length <= 2);
		return solution.replace(/ +/g, ' ');
	}
}

const polyObjs: Record<string, PolyScrambler> = {};

function getPolyScrambler(puzzle: string, validMoves: string[], move2str: Move2Str): PolyScrambler {
	const key = JSON.stringify([puzzle, validMoves]);
	if (!(key in polyObjs)) {
		polyObjs[key] = new PolyScrambler(puzzle, validMoves, move2str);
	}
	return polyObjs[key];
}

registerGenerator('dmdso', () =>
	getPolyScrambler("dmd", ["U", "R", "L", "F"], (mv, pow) => mv + ["", "'"][pow - 1]).getScramble(7, 10)
);
