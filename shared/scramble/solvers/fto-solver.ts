/**
 * Face-Turning Octahedron (FTO) random-state solver.
 * Ported from cstimer solver/ftocta.js (GPLv3) — https://github.com/cs0x7f/cstimer
 *
 * Exports: FtoCubie, solveFacelet
 *
 * The solver uses a 3-phase IDA* approach (reduction-style):
 * - Phase 1: orient 3 edges + reduce centers (keep the D/DR edge)
 * - Phase 2: reduce to <U, R, L, D, B> subgroup (uf/rl colors + corners)
 * - Phase 3: solve within <D, B, R, L>
 */

import {
	rn, rndPerm, setNOri, getNPerm, getNParity, bitCount,
	getPruning, createPrun, createMoveHash, Searcher, Coord, permOriMult,
	fillFacelet, detectFacelet
} from '../lib/mathlib';

// face-turning octahedron cube w/o identical pieces
export class FtoCubie {
	cp: number[];
	co: number[];
	ep: number[];
	uf: number[];
	rl: number[];

	static moveCube: FtoCubie[];
	static symCube: FtoCubie[];
	static symMult: number[][];
	static symMulI: number[][];
	static symMulM: number[][];

	constructor(cp?: number[], co?: number[], ep?: number[], uf?: number[], rl?: number[]) {
		this.cp = (cp && cp.slice()) || [0, 1, 2, 3, 4, 5];
		this.co = (co && co.slice()) || [0, 0, 0, 0, 0, 0];
		this.ep = (ep && ep.slice()) || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
		this.uf = (uf && uf.slice()) || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
		this.rl = (rl && rl.slice()) || [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
	}

	isEqual(fc: FtoCubie): boolean {
		for (let i = 0; i < 12; i++) {
			if (this.ep[i] != fc.ep[i] || this.uf[i] != fc.uf[i] || this.rl[i] != fc.rl[i]
					|| (i < 6 && (this.cp[i] != fc.cp[i] || this.co[i] != fc.co[i]))) {
				return false;
			}
		}
		return true;
	}

	toFaceCube(todiv?: number): number[] {
		const f: number[] = [];
		todiv = todiv || 9;
		const co: number[] = [];
		for (let i = 0; i < 6; i++) {
			co[i] = this.co[i] * 2;
		}
		fillFacelet(cornFacelets, f, this.cp, co, todiv);
		fillFacelet(edgeFacelets, f, this.ep, [], todiv);
		fillFacelet(ctufFacelets, f, this.uf, null, todiv);
		fillFacelet(ctrlFacelets, f, this.rl, null, todiv);
		return f;
	}

	fromFacelet(facelet: number[]): FtoCubie | -1 {
		let count = 0;
		const f: number[] = [];
		for (let i = 0; i < 72; ++i) {
			f[i] = facelet[i];
			count += Math.pow(16, f[i]);
		}
		if (count != 0x99999999) {
			return -1;
		}
		const co: number[] = [];
		if (detectFacelet(cornFacelets as number[][], f, this.cp, co, 9) == -1
				|| detectFacelet(edgeFacelets as number[][], f, this.ep, [], 9) == -1) {
			return -1;
		}
		let parity = 0;
		for (let i = 0; i < 6; i++) {
			this.co[i] = co[i] >> 1;
			parity ^= this.co[i];
		}
		if (parity != 0
				|| getNParity(getNPerm(this.cp, 6), 6) != 0
				|| getNParity(getNPerm(this.ep, 12), 12) != 0) {
			return -1;
		}
		let remainCnts = [3, 3, 3, 3];
		for (let i = 0; i < 12; i++) {
			const col = f[ctufFacelets[i] as number];
			if (!(remainCnts[col] > 0)) {
				return -1;
			}
			this.uf[i] = col * 3 + 3 - remainCnts[col];
			remainCnts[col]--;
		}
		remainCnts = [3, 3, 3, 3];
		for (let i = 0; i < 12; i++) {
			const col = [0, 1, 3, 2][f[ctrlFacelets[i] as number] - 4];
			if (!(remainCnts[col] > 0)) {
				return -1;
			}
			this.rl[i] = col * 3 + 3 - remainCnts[col];
			remainCnts[col]--;
		}
		if (getNParity(getNPerm(this.uf, 12), 12) != 0) {
			for (let i = 0; i < 12; i++) { // swap 0 and 1 to fix parity
				this.uf[i] ^= this.uf[i] < 2 ? 1 : 0;
			}
		}
		if (getNParity(getNPerm(this.rl, 12), 12) != 0) {
			for (let i = 0; i < 12; i++) { // swap 0 and 1 to fix parity
				this.rl[i] ^= this.rl[i] < 2 ? 1 : 0;
			}
		}
		return this;
	}

	toString(todiv?: number): string {
		const f = this.toFaceCube(todiv);
		let ret = '' +
			'  U8 U7 U6 U5 U4      B8 B7 B6 B5 B4\n' +
			'L4   U3 U2 U1   R8  r4   B3 B2 B1   l8\n' +
			'L5 L1   U0   R3 R7  r5 r1   B0   l3 l7\n' +
			'L6 L2 L0  R0 R2 R6  r6 r2 r0  l0 l2 l6\n' +
			'L7 L3   F0   R1 R5  r7 r3   D0   l1 l5\n' +
			'L8   F1 F2 F3   R4  r8   D1 D2 D3   l4\n' +
			'  F4 F5 F6 F7 F8      D4 D5 D6 D7 D8';
		ret = ret.replace(/([UFrlDBRL])([0-8])/g, function(m, p1, p2) {
			const i = 'UFrlDBRL'.indexOf(p1) * 9 + (~~p2);
			return 'UFrlDBRL'[~~(f[i] / 9)] + (f[i] % 9);
		});
		return ret;
	}

	static FtoMult(...argsIn: (FtoCubie | null)[]): FtoCubie {
		const args = argsIn.slice();
		const prod = (args.pop() as FtoCubie) || new FtoCubie();
		return (args as FtoCubie[]).reduceRight((b, a) => {
			for (let i = 0; i < 6; i++) {
				prod.co[i] = a.co[b.cp[i]] ^ b.co[i];
				prod.cp[i] = a.cp[b.cp[i]];
			}
			for (let i = 0; i < 12; i++) {
				prod.ep[i] = a.ep[b.ep[i]];
				prod.uf[i] = a.uf[b.uf[i]];
				prod.rl[i] = a.rl[b.rl[i]];
			}
			return prod;
		});
	}
}

const U = 0, F = 9, r = 18, l = 27, D = 36, B = 45, R = 54, L = 63;

const cornFacelets: number[][] = [
	[U + 0, R + 0, F + 0, L + 0],
	[U + 4, B + 8, r + 4, R + 8],
	[U + 8, L + 4, l + 8, B + 4],
	[l + 0, D + 0, r + 0, B + 0],
	[F + 4, D + 8, l + 4, L + 8],
	[r + 8, D + 4, F + 8, R + 4]
];

const edgeFacelets: number[][] = [
	[U + 1, R + 3], [U + 3, L + 1], [U + 6, B + 6],
	[l + 1, D + 3], [r + 3, D + 1], [F + 6, D + 6],
	[F + 3, R + 1], [F + 1, L + 3], [l + 6, L + 6],
	[l + 3, B + 1], [r + 1, B + 3], [r + 6, R + 6]
];

const ctufFacelets: number[] = [
	U + 2, U + 5, U + 7,
	F + 2, F + 5, F + 7,
	r + 2, r + 5, r + 7,
	l + 2, l + 5, l + 7
];

const ctrlFacelets: number[] = [
	D + 2, D + 5, D + 7,
	B + 2, B + 5, B + 7,
	L + 2, L + 5, L + 7,
	R + 2, R + 5, R + 7
];

function initMoveCube(): void {
	const rotU = new FtoCubie( //move[U]
		[1, 2, 0, 4, 5, 3], [0, 0, 0, 0, 0, 0], [2, 0, 1, 5, 3, 4, 10, 11, 6, 7, 8, 9],
		[1, 2, 0, 7, 8, 6, 10, 11, 9, 4, 5, 3], [2, 0, 1, 8, 6, 7, 11, 9, 10, 5, 3, 4]);
	const rotR = new FtoCubie( //move[R]
		[5, 0, 4, 2, 3, 1], [1, 1, 0, 1, 1, 0], [6, 5, 7, 9, 2, 10, 11, 4, 3, 8, 1, 0],
		[5, 3, 4, 8, 6, 7, 2, 0, 1, 11, 9, 10], [4, 5, 3, 7, 8, 6, 1, 2, 0, 10, 11, 9]);

	const rotUi = FtoCubie.FtoMult(rotU, rotU, null);
	const rotRi = FtoCubie.FtoMult(rotR, rotR, null);
	const rotL = FtoCubie.FtoMult(rotUi, rotR, rotU, null);
	const rotF = FtoCubie.FtoMult(rotR, rotU, rotRi, null);

	const moveCube: FtoCubie[] = [];
	moveCube[0] = new FtoCubie( //moveU
		[1, 2, 0, 3, 4, 5], [0, 0, 0, 0, 0, 0], [2, 0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11],
		[1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0, 1, 2, 3, 6, 7, 11, 9, 8, 5, 10, 4]);
	moveCube[2] = new FtoCubie( //moveF
		[4, 1, 2, 3, 5, 0], [1, 0, 0, 0, 1, 0], [0, 1, 2, 3, 4, 6, 7, 5, 8, 9, 10, 11],
		[0, 1, 2, 4, 5, 3, 6, 7, 8, 9, 10, 11], [0, 9, 10, 3, 4, 5, 2, 7, 1, 8, 6, 11]);
	moveCube[4] = new FtoCubie( //mover
		[0, 5, 2, 1, 4, 3], [0, 1, 0, 0, 0, 1], [0, 1, 2, 3, 10, 5, 6, 7, 8, 9, 11, 4],
		[0, 1, 2, 3, 4, 5, 7, 8, 6, 9, 10, 11], [5, 3, 2, 11, 4, 10, 6, 7, 8, 9, 0, 1]);
	moveCube[6] = new FtoCubie( //movel
		[0, 1, 3, 4, 2, 5], [0, 0, 1, 1, 0, 0], [0, 1, 2, 8, 4, 5, 6, 7, 9, 3, 10, 11],
		[0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 9], [8, 1, 7, 2, 0, 5, 6, 3, 4, 9, 10, 11]);
	moveCube[8] = new FtoCubie( //moveD
		[0, 1, 2, 5, 3, 4], [0, 0, 0, 0, 0, 0], [0, 1, 2, 4, 5, 3, 6, 7, 8, 9, 10, 11],
		[0, 1, 2, 3, 9, 10, 5, 7, 4, 8, 6, 11], [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
	moveCube[10] = new FtoCubie( //moveB
		[0, 3, 1, 2, 4, 5], [0, 1, 1, 0, 0, 0], [0, 1, 10, 3, 4, 5, 6, 7, 8, 2, 9, 11],
		[0, 6, 7, 3, 4, 5, 11, 9, 8, 2, 10, 1], [0, 1, 2, 4, 5, 3, 6, 7, 8, 9, 10, 11]);
	moveCube[12] = new FtoCubie( //moveR
		[5, 0, 2, 3, 4, 1], [1, 1, 0, 0, 0, 0], [6, 1, 2, 3, 4, 5, 11, 7, 8, 9, 10, 0],
		[5, 3, 2, 8, 4, 7, 6, 0, 1, 9, 10, 11], [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 9]);
	moveCube[14] = new FtoCubie( //moveL
		[2, 1, 4, 3, 0, 5], [1, 0, 1, 0, 0, 0], [0, 8, 2, 3, 4, 5, 6, 1, 7, 9, 10, 11],
		[11, 1, 10, 2, 0, 5, 6, 7, 8, 9, 3, 4], [0, 1, 2, 3, 4, 5, 7, 8, 6, 9, 10, 11]);
	moveCube[16] = FtoCubie.FtoMult(rotU, moveCube[8], null); // moveUw = [U] * D
	moveCube[18] = FtoCubie.FtoMult(rotF, moveCube[10], null); // moveFw = [F] * B
	moveCube[20] = FtoCubie.FtoMult(rotR, moveCube[6], null); // moveRw = [R] * l
	moveCube[22] = FtoCubie.FtoMult(rotL, moveCube[4], null); // moveLw = [L] * r

	for (let i = 1; i < 24; i += 2) {
		moveCube[i] = new FtoCubie();
		FtoCubie.FtoMult(moveCube[i - 1], moveCube[i - 1], moveCube[i]);
	}

	const moveHash: string[] = [];
	for (let i = 0; i < 24; i++) {
		moveHash[i] = moveCube[i].ep.join(',');
	}
	//init sym
	const symCube: FtoCubie[] = [];
	const symMult: number[][] = [];
	const symMulI: number[][] = [];
	const symMulM: number[][] = [];
	const symHash: string[] = [];
	let fc = new FtoCubie();
	for (let s = 0; s < 12; s++) {
		symCube[s] = new FtoCubie(fc.cp, fc.co, fc.ep, fc.uf, fc.rl);
		symHash[s] = symCube[s].ep.join(',');
		symMult[s] = [];
		symMulI[s] = [];
		fc = FtoCubie.FtoMult(fc, rotU, null);
		if (s % 3 == 2) { // [F] or [R]
			fc = FtoCubie.FtoMult(fc, rotR, rotU, null);
		}
		if (s % 6 == 5) {
			fc = FtoCubie.FtoMult(fc, rotU, rotR, null);
		}
	}
	for (let i = 0; i < 12; i++) {
		for (let j = 0; j < 12; j++) {
			FtoCubie.FtoMult(symCube[i], symCube[j], fc);
			const k = symHash.indexOf(fc.ep.join(','));
			symMult[i][j] = k;
			symMulI[k][j] = i;
		}
	}
	for (let s = 0; s < 12; s++) {
		symMulM[s] = [];
		for (let j = 0; j < 8; j++) {
			FtoCubie.FtoMult(symCube[symMulI[0][s]], moveCube[j * 2], symCube[s], fc);
			const k = moveHash.indexOf(fc.ep.join(','));
			symMulM[s][j] = k >> 1;
		}
	}
	FtoCubie.moveCube = moveCube;
	FtoCubie.symCube = symCube;
	FtoCubie.symMult = symMult;
	FtoCubie.symMulI = symMulI;
	FtoCubie.symMulM = symMulM;
}

initMoveCube();

function ftoPermMove(key: 'ep' | 'rl' | 'uf', perm: number[], move: number): number[] {
	const ret: number[] = [];
	const movePerm = (FtoCubie.moveCube[move] as any)[key];
	for (let i = 0; i < 12; i++) {
		ret[i] = perm[movePerm[i]];
	}
	return ret;
}

function ftoFullMove(fc: FtoCubie, move: number): FtoCubie {
	return FtoCubie.FtoMult(fc, FtoCubie.moveCube[move], null);
}

function phase1EdgeHash(ep: number[]): number {
	let ret = 0;
	let e3fst = -1;
	for (let i = 0; i < 12; i++) {
		if ((0x38 >> ep[i] & 1) == 0) {
			continue;
		}
		if (e3fst == -1) {
			e3fst = ep[i];
		}
		ret += ((ep[i] - e3fst + 3) % 3 + 1) << i * 2;
	}
	return ret;
}

function phase1CtrlHash(rl: number[]): number {
	let ret = 0;
	for (let i = 0; i < 12; i++) {
		if (rl[i] < 3) {
			ret |= 1 << i;
		}
	}
	return ret;
}

function phase2EdgeHash(ep: number[]): number {
	const edge2group = [0, 1, 2, 3, 3, 3, 0, 1, 1, 2, 2, 0];
	const groups = [[0, 6, 11], [1, 7, 8], [2, 9, 10], [3, 4, 5]];
	let ret = 0;
	const egoff = [-1, -1, -1, -1];
	for (let i = 0; i < 12; i++) {
		const g = edge2group[ep[i]];
		const gidx = groups[g].indexOf(ep[i]);
		if (egoff[g] == -1) {
			egoff[g] = gidx;
		}
		ret += (g * 4 + (gidx - egoff[g] + 3) % 3) * Math.pow(16, i);
	}
	return ret;
}

function phase2CtHash(ct: number[]): number {
	let ret = 0;
	for (let i = 0; i < 12; i++) {
		ret |= ~~(ct[i] / 3) << (i * 2);
	}
	return ret;
}

function phase3EdgeHash(ep: number[]): string {
	return String.fromCharCode.apply(null, ep as any);
}

function phase3CcufHash(fc: FtoCubie): string {
	return String.fromCharCode.apply(null, ([] as number[]).concat(fc.cp, fc.co) as any);
}

function randomMoves(validMoves: number[], len: number): [FtoCubie, number[]] {
	const scramble: number[] = [];
	for (let i = 0; i < len; i++) {
		scramble.push(validMoves[~~(Math.random() * validMoves.length)]);
	}
	let fc = new FtoCubie();
	for (let i = 0; i < scramble.length; i++) {
		fc = FtoCubie.FtoMult(fc, FtoCubie.moveCube[scramble[i]], null);
	}
	return [fc, scramble];
}

function genCkmv(moves: number[]): number[] {
	const ckmv: number[] = [];
	const tmp1 = new FtoCubie();
	const tmp2 = new FtoCubie();
	for (let m1 = 0; m1 < moves.length; m1++) {
		ckmv[m1] = 1 << m1;
		for (let m2 = 0; m2 < m1; m2++) {
			FtoCubie.FtoMult(FtoCubie.moveCube[moves[m1]], FtoCubie.moveCube[moves[m2]], tmp1);
			FtoCubie.FtoMult(FtoCubie.moveCube[moves[m2]], FtoCubie.moveCube[moves[m1]], tmp2);
			if (tmp1.isEqual(tmp2)) {
				ckmv[m1] |= 1 << m2;
			}
		}
	}
	return ckmv;
}

const phase1Moves = [0, 2, 22, 6, 16, 10, 12, 14]; // keep the (D, DR) edge
let p1epMoves: [number[][], Record<string, number>] | null = null;
let p1rlMoves: [number[][], Record<string, number>] | null = null;
let ckmv1: number[] | null = null;
let solv1: Searcher | null = null;

const pyraSymCube: FtoCubie[] = [];
for (let i = 0; i < 12; i++) {
	pyraSymCube.push(new FtoCubie(
		FtoCubie.symCube[i].cp,
		FtoCubie.symCube[i].co,
		undefined,
		FtoCubie.symCube[i].uf,
		undefined
	));
}

function phase1Init(): void {
	const fc = new FtoCubie();
	p1epMoves = createMoveHash(fc.ep.slice(), phase1Moves, phase1EdgeHash as any, ftoPermMove.bind(null, 'ep') as any);
	p1rlMoves = createMoveHash(fc.rl.slice(), phase1Moves, phase1CtrlHash as any, ftoPermMove.bind(null, 'rl') as any);
	const N_P1EP = p1epMoves[0][0].length;
	const N_P1RL = p1rlMoves[0][0].length;

	ckmv1 = genCkmv(phase1Moves);
	const p1eprlPrun: number[] = [];
	createPrun(p1eprlPrun, 0, N_P1EP * N_P1RL, 14, function(idx, move) {
		const rl = ~~(idx / N_P1EP);
		const ep = idx % N_P1EP;
		return p1rlMoves![0][move][rl] * N_P1EP + p1epMoves![0][move][ep];
	}, phase1Moves.length, 2);

	solv1 = new Searcher(null, function(idx) {
		return getPruning(p1eprlPrun, idx[1] * N_P1EP + idx[0]);
	}, function(idx, move) {
		return [
			p1epMoves![0][move][idx[0]],
			p1rlMoves![0][move][idx[1]]
		];
	}, 8, 2, ckmv1!);
}

function phase1GenIdxs(fc: FtoCubie): [number[][], number[][]] {
	const idxs: number[][] = [];
	const syms: number[][] = [];
	const fc2 = new FtoCubie();
	const fc3 = new FtoCubie();

	for (let sidx = 0; sidx < 12; sidx += 3) {
		FtoCubie.FtoMult(FtoCubie.symCube[sidx % 12], fc, fc2);
		let rot;
		for (rot = 0; rot < 12; rot++) {
			FtoCubie.FtoMult(fc2, FtoCubie.symCube[rot], fc3);
			if (fc3.ep[4] == 4) {
				break;
			}
		}
		idxs.push([
			p1epMoves![1][phase1EdgeHash(fc3.ep)],
			p1rlMoves![1][phase1CtrlHash(fc3.rl)]
		]);
		syms.push([sidx, rot!]);
	}
	return [idxs, syms];
}

function phase1ProcSol(sol: any[], solsym: number[], fc: FtoCubie): [FtoCubie, number[], number, number] {
	for (let i = 0; i < sol.length; i++) {
		sol[i] = phase1Moves[sol[i][0]] + sol[i][1];
	}
	const std = move2std(sol);
	for (let i = 0; i < std[0].length; i++) {
		const move = std[0][i];
		sol[i] = FtoCubie.symMulM[FtoCubie.symMulI[0][solsym[1]]][move >> 1] * 2 + (move & 1);
		fc = FtoCubie.FtoMult(fc, FtoCubie.moveCube[sol[i]], null);
	}
	solsym[1] = FtoCubie.symMulI[solsym[1]][std[1]];
	fc = FtoCubie.FtoMult(
		pyraSymCube[~~(solsym[0] / 12)], FtoCubie.symCube[solsym[0] % 12],
		fc, FtoCubie.symCube[solsym[1]], null
	);
	return [fc, sol, solsym[0], solsym[1]];
}

const N_PHASE1_SOLS = 1000;

function solvePhase1(fc: FtoCubie): any[] {
	if (!solv1) {
		phase1Init();
	}

	let tt = Date.now();
	const idxsAndSyms = phase1GenIdxs(fc);
	const syms = idxsAndSyms[1];
	const idxs = idxsAndSyms[0];

	const p1sols: any[] = [];

	solv1!.solveMulti(idxs, 0, 12, function(sol, sidx) {
		const param = phase1ProcSol(sol.slice(), syms[sidx].slice(), fc);
		p1sols.push(param);
		return p1sols.length >= N_PHASE1_SOLS;
	});

	tt = Date.now() - tt;
	for (let i = 0; i < p1sols.length; i++) {
		p1sols[i].push(tt);
	}
	return p1sols;
}

const phase2Moves = [0, 12, 14, 8, 10];
let p2epMoves: [number[][], Record<string, number>] | null = null;
let p2rlMoves: [number[][], Record<string, number>] | null = null;
let p2ccMoves: [number[][], Record<string, number>] | null = null;
const p2cc2ufBit: Record<string, number> = {};
let ckmv2: number[] | null = null;
let solv2: Searcher | null = null;
const P2EPRL_MAXL = 11;
const p2symMap: number[] = [];
const ufStd2Raw: number[] = [];
const ufRaw2Std: number[] = [];
const p2ufCoord = new Coord('c', 12, [3, 3, 3, 3]);

const cornExFacelets: number[][] = [
	[U + 2, R + 2, F + 2, L + 2],
	[U + 5, B + 7, r + 5, R + 7],
	[U + 7, L + 5, l + 7, B + 5],
	[l + 2, D + 2, r + 2, B + 2],
	[F + 5, D + 7, l + 5, L + 7],
	[r + 7, D + 5, F + 7, R + 5]
];

function phase2CpcoHash(fc: FtoCubie): string {
	const ret = String.fromCharCode.apply(null, ([] as number[]).concat(fc.cp, fc.co) as any);
	if (!(ret in p2cc2ufBit)) {
		const co: number[] = [];
		for (let i = 0; i < 6; i++) {
			co[i] = fc.co[i] * 2;
		}
		const facelet = fc.toFaceCube();
		fillFacelet(cornExFacelets, facelet, fc.cp, co, 9);
		const fc2 = new FtoCubie().fromFacelet(facelet) as FtoCubie;
		p2cc2ufBit[ret] = phase2CtHash(fc2.uf);
	}
	return ret;
}

// re-color the cube s.t. uf is minimized in lexicographical order
function phase2ufStd(uf: number[], symMap: number[]): number {
	const col1 = uf[0];
	let col2 = -1;
	for (let i = 1; i < 12; i++) {
		if (uf[i] != col1) {
			col2 = uf[i];
			break;
		}
	}
	const sym = symMap[col1 * 4 + col2];
	for (let i = 0; i < 12; i++) {
		uf[i] = ~~(FtoCubie.symCube[sym].uf[uf[i] * 3] / 3);
	}
	return sym;
}

function getPhase2ufIdx(uf: number[]): number {
	const ufstd: number[] = [];
	for (let i = 0; i < 12; i++) {
		ufstd[i] = ~~(uf[i] / 3);
	}
	const sym = phase2ufStd(ufstd, p2symMap);
	return ufRaw2Std[p2ufCoord.get(ufstd)] << 4 | sym;
}

function phase2Init(): void {
	const fc = new FtoCubie();
	p2epMoves = createMoveHash(fc.ep.slice(), phase2Moves, phase2EdgeHash as any, ftoPermMove.bind(null, 'ep') as any);
	p2rlMoves = createMoveHash(fc.rl.slice(), phase2Moves, phase2CtHash as any, ftoPermMove.bind(null, 'rl') as any);
	p2ccMoves = createMoveHash(fc, phase2Moves, phase2CpcoHash as any, ftoFullMove as any);

	const arr: number[] = [];
	const arr2: number[] = [];
	const p2ufMoveStd: number[][] = [[], [], [], [], []];
	const ufStd2Bit: number[] = [];
	const p2ccRecol: number[][] = [];
	for (let s = 0; s < 12; s++) {
		const uf = FtoCubie.symCube[s].uf;
		const col1 = ~~(uf.indexOf(0) / 3);
		const col2 = ~~(uf.indexOf(3) / 3);
		p2symMap[col1 * 4 + col2] = s;
		p2ccRecol[s] = [];
	}
	out: for (let i = 0; i < 42000; i++) {
		p2ufCoord.set(arr, i);
		for (let j = 1; j < 12; j++) {
			if (arr[j] > 1) {
				continue out;
			} else if (arr[j] == 1) {
				break;
			}
		}
		ufRaw2Std[i] = ufStd2Raw.length;
		ufStd2Raw.push(i);
	}
	for (let i = 0; i < ufStd2Raw.length; i++) {
		p2ufCoord.set(arr, ufStd2Raw[i]);
		let hash = 0;
		for (let j = 0; j < 12; j++) {
			hash |= arr[j] << (j * 2);
		}
		ufStd2Bit[i] = hash;
		for (let m = 0; m < phase2Moves.length; m++) {
			permOriMult(arr, FtoCubie.moveCube[phase2Moves[m]].uf, arr2);
			const sym = phase2ufStd(arr2, p2symMap);
			p2ufMoveStd[m][i] = ufRaw2Std[p2ufCoord.get(arr2)] << 4 | sym;
		}
	}
	const cc2Bit: number[] = [];
	for (const key in p2ccMoves[1]) {
		const idx = p2ccMoves[1][key];
		cc2Bit[idx] = p2cc2ufBit[key];
		const cpco: number[] = [];
		for (let s = 0; s < 12; s++) {
			const sc = FtoCubie.symCube[s];
			for (let i = 0; i < 6; i++) {
				const scpi = key.charCodeAt(i);
				cpco[i] = sc.cp[scpi];
				cpco[i + 6] = sc.co[scpi] ^ key.charCodeAt(i + 6);
			}
			const hash = String.fromCharCode.apply(null, cpco as any);
			p2ccRecol[s][idx] = p2ccMoves[1][hash];
		}
	}

	const p2necPrun = [ // idx = (a << 2 | b) * 7 + c, a: #mismatch in U faces, b: U corners w/o U faces, c: others
		 0, 99, 3, 4, 5, 6, 8,
		99, 2, 3, 4, 5, 6, 8,
		 1, 3, 4, 5, 6, 7, 8,
		 1, 3, 4, 5, 6, 7, 9,
		99, 2, 3, 4, 5, 6, 8,
		 2, 2, 4, 4, 5, 6, 8,
		 3, 3, 4, 5, 6, 7, 8,
		 3, 3, 4, 5, 6, 7, 9,
		 3, 3, 4, 5, 6, 7, 8,
		 4, 4, 4, 5, 6, 7, 8,
		 4, 4, 5, 6, 7, 8, 9,
		 4, 4, 5, 6, 7, 8, 9,
		 4, 4, 5, 6, 7, 8, 9,
		 4, 4, 5, 6, 7, 8, 9,
		 5, 5, 6, 7, 8, 9, 10,
		 5, 5, 6, 7, 8, 9, 10
	];

	const N_P2EP = p2epMoves[0][0].length;
	const N_P2RL = p2rlMoves[0][0].length;
	const p2eprlPrun: number[] = [];
	createPrun(p2eprlPrun, 0, N_P2EP * N_P2RL, P2EPRL_MAXL - 2, function(idx, move) {
		const rl = ~~(idx / N_P2EP);
		const ep = idx % N_P2EP;
		return p2rlMoves![0][move][rl] * N_P2EP + p2epMoves![0][move][ep];
	}, phase2Moves.length, 2);
	ckmv2 = genCkmv(phase2Moves);

	solv2 = new Searcher(null, function(idx) {
		let xors = ufStd2Bit[idx[3] >> 4] ^ cc2Bit[p2ccRecol[idx[3] & 0xf][idx[2]]];
		xors = (xors | xors >> 1) & 0x555555;
		const necIdx = (bitCount(xors & 0x3f) << 2 | bitCount(xors & 0xc0c0c0)) * 7 + bitCount(xors & 0x3f3f00);
		return Math.max(
			Math.min(P2EPRL_MAXL, getPruning(p2eprlPrun, idx[1] * N_P2EP + idx[0])),
			p2necPrun[necIdx]
		);
	}, function(idx, move) {
		const ufidx1 = p2ufMoveStd[move][idx[3] >> 4];
		const ufcol = FtoCubie.symMult[ufidx1 & 0xf][idx[3] & 0xf];
		return [
			p2epMoves![0][move][idx[0]],
			p2rlMoves![0][move][idx[1]],
			p2ccMoves![0][move][idx[2]],
			ufidx1 & ~0xf | ufcol,
		];
	}, phase2Moves.length, 2, ckmv2!);

	// cstimer: the block below is guarded by `1 != 1 && !isInWorker` (permanently disabled).
	// It regenerates the hardcoded p2necPrun table above. Kept disabled — output already inlined.
}

function solvePhase2(solvInfos: any[]): any[] {
	if (!solv2) {
		phase2Init();
	}
	const tt = Date.now();
	const idxs: number[][] = [];
	for (let i = 0; i < solvInfos.length; i++) {
		idxs.push([
			p2epMoves![1][phase2EdgeHash(solvInfos[i][0].ep)],
			p2rlMoves![1][phase2CtHash(solvInfos[i][0].rl)],
			p2ccMoves![1][phase2CpcoHash(solvInfos[i][0])],
			getPhase2ufIdx(solvInfos[i][0].uf)
		]);
	}
	const sol2s = solv2!.solveMulti(idxs, 0, 25) as [number[][], number];
	const sol: any[] = sol2s[0];
	const src = sol2s[1];
	const solvInfo = solvInfos[src];
	let fc = solvInfo[0];
	for (let i = 0; i < sol.length; i++) {
		const move = phase2Moves[sol[i][0]] + sol[i][1];
		sol[i] = FtoCubie.symMulM[FtoCubie.symMulI[0][solvInfo[3]]][move >> 1] * 2 + (move & 1);
		fc = FtoCubie.FtoMult(fc, FtoCubie.moveCube[move], null);
	}
	return [fc, sol, solvInfo[2], solvInfo[3], src, Date.now() - tt];
}

const phase3Moves = [8, 10, 12, 14];
let p3epMoves: [number[][], Record<string, number>] | null = null;
let p3ufMoves: [number[][], Record<string, number>] | null = null;
let p3epPrun: number[] | null = null;
let p3ufPrun: number[] | null = null;
let ckmv3: number[] | null = null;
let solv3: Searcher | null = null;

function phase3Init(): void {
	const fc = new FtoCubie();
	p3epMoves = createMoveHash(fc.ep.slice(), phase3Moves, phase3EdgeHash as any, ftoPermMove.bind(null, 'ep') as any);
	p3ufMoves = createMoveHash(new FtoCubie(), phase3Moves, phase3CcufHash as any, ftoFullMove as any);
	p3epPrun = [];
	p3ufPrun = [];
	createPrun(p3epPrun, 0, 81, 14, p3epMoves[0], 4, 2);
	createPrun(p3ufPrun, 0, 11520, 14, p3ufMoves[0], 4, 2);
	ckmv3 = genCkmv(phase3Moves);

	solv3 = new Searcher(null, function(idx) {
		return Math.max(
			getPruning(p3epPrun!, idx[0]),
			getPruning(p3ufPrun!, idx[1])
		);
	}, function(idx, move) {
		return [p3epMoves![0][move][idx[0]], p3ufMoves![0][move][idx[1]]];
	}, 4, 2, ckmv3!);
}

function solvePhase3(solvInfo: any[]): any[] {
	let fc = solvInfo[0];
	if (!p3epPrun) {
		phase3Init();
	}

	const tt = Date.now();
	const p3epidx = p3epMoves![1][phase3EdgeHash(fc.ep)];
	const p3ufidx = p3ufMoves![1][phase3CcufHash(fc)];

	const sol = solv3!.solve([p3epidx, p3ufidx], 0, 25) as number[][];

	for (let i = 0; i < sol.length; i++) {
		const move = phase3Moves[sol[i][0]] + sol[i][1];
		(sol as any)[i] = FtoCubie.symMulM[FtoCubie.symMulI[0][solvInfo[3]]][move >> 1] * 2 + (move & 1);

		fc = FtoCubie.FtoMult(fc, FtoCubie.moveCube[(sol as any)[i]], null);
	}
	return [fc, sol, solvInfo[2], solvInfo[3], Date.now() - tt];
}

// convert wide moves to face moves
function move2std(moves: number[]): [number[], number] {
	let sym = 0;
	const ret: number[] = [];
	// Uw = [U] * D, Fw = [F] * B, Rw = [R] * l, Lw = [L] * r
	const w2axis = [4, 5, 3, 2];
	const w2rot = [1, 10, 5, 11];
	for (let i = 0; i < moves.length; i++) {
		let rot = 0;
		let axis = moves[i] >> 1;
		const pow = moves[i] & 1;
		if (axis >= 8) {
			rot = w2rot[axis - 8];
			axis = w2axis[axis - 8];
		}
		if (!pow) {
			rot = FtoCubie.symMult[rot][rot];
		}
		ret.push(FtoCubie.symMulM[sym][axis] * 2 + pow);
		sym = FtoCubie.symMult[rot][sym];
	}
	return [ret, sym];
}

function applyMoves(fc: FtoCubie, moves: number[]): FtoCubie {
	for (let i = 0; i < moves.length; i++) {
		fc = FtoCubie.FtoMult(fc, FtoCubie.moveCube[moves[i]], null);
	}
	return fc;
}

const move2str = ["U", "U'", "F", "F'", "r", "r'", "l", "l'", "D", "D'", "B", "B'", "R", "R'", "L", "L'"];

function prettyMoves(moves: number[]): string {
	const buf: string[] = [];
	for (let i = 0; i < moves.length; i++) {
		buf[i] = move2str[moves[i]];
	}
	return buf.join(' ').replace(/l/g, 'BL').replace(/r/g, 'BR');
}

class FtoSolver {
	sol1!: number[];
	sol2!: number[];
	sol3!: number[];
	tt1!: number;
	tt2!: number;
	tt3!: number;

	solveFto(fc: FtoCubie, invSol?: boolean): string {
		if (!solv1) {
			phase1Init();
			phase2Init();
			phase3Init();
		}
		const solvInfos = solvePhase1(fc);

		const solvInfo2 = solvePhase2(solvInfos);

		const solvInfo1 = solvInfos[solvInfo2[4]];
		this.sol1 = solvInfo1[1].slice();
		this.tt1 = solvInfo1[4];
		const sym1Idx = solvInfo1[2];

		this.sol2 = solvInfo2[1].slice();
		this.tt2 = solvInfo2[5];
		solvInfo2[0] = FtoCubie.FtoMult(pyraSymCube[FtoCubie.symMulI[0][~~(sym1Idx / 12)]], solvInfo2[0], null);

		const solvInfo3 = solvePhase3(solvInfo2);
		this.sol3 = solvInfo3[1].slice();
		this.tt3 = solvInfo3[4];

		const sol = ([] as number[]).concat(this.sol1, this.sol2, this.sol3);
		if (invSol) {
			for (let i = 0; i < sol.length; i++) {
				sol[i] ^= 1;
			}
			sol.reverse();
		}
		return prettyMoves(sol);
	}
}

const solver = new FtoSolver();

export function solveFacelet(facelet: number[], invSol?: boolean): string {
	const fc = new FtoCubie();
	if (fc.fromFacelet(facelet) == -1) {
		return "FTO Solver ERROR!";
	}
	return solver.solveFto(fc, invSol);
}

// Internal helpers exported for completeness / potential tooling (parity with cstimer).
export { randomMoves, applyMoves, prettyMoves };
