/**
 * Megaminx & Kilominx random-state solver.
 * Ported from cstimer megaminx.js solver (GPLv3) — https://github.com/cs0x7f/cstimer
 *
 * Exports: MgmCubie, solveKlmCubie, solveMgmCubie
 *
 * The solver uses a multi-phase IDA* approach:
 * - Kilominx: 3 phases (corners only, no edges)
 * - Megaminx: 10-phase block-building approach
 */

import {
	Cnk, fact, getNPerm, setNPerm, fillFacelet, detectFacelet,
	createMove, createPrun, getPruning, Searcher, minx, rn
} from '../lib/mathlib';

// ==================== Face Constants ====================

const U = 0, R = 10, F = 20, L = 30, BL = 40, BR = 50;
const DR = 60, DL = 70, DBL = 80, B = 90, DBR = 100, D = 110;

// ==================== Facelet Definitions ====================

const cornFacelet = [
	[U + 2, R + 3, F + 4],
	[U + 3, F + 3, L + 4],
	[U + 4, L + 3, BL + 4],
	[U + 0, BL + 3, BR + 4],
	[U + 1, BR + 3, R + 4],
	[D + 3, B + 0, DBL + 1],
	[D + 2, DBR + 0, B + 1],
	[D + 1, DR + 0, DBR + 1],
	[D + 0, DL + 0, DR + 1],
	[D + 4, DBL + 0, DL + 1],
	[DR + 3, F + 0, R + 2],
	[L + 0, F + 2, DL + 3],
	[BL + 0, L + 2, DBL + 3],
	[BR + 0, BL + 2, B + 3],
	[R + 0, BR + 2, DBR + 3],
	[B + 4, BL + 1, DBL + 2],
	[DBR + 4, BR + 1, B + 2],
	[DR + 4, R + 1, DBR + 2],
	[DL + 4, F + 1, DR + 2],
	[DBL + 4, L + 1, DL + 2]
];

const edgeFacelet = [
	[U + 6, R + 8],
	[U + 7, F + 8],
	[U + 8, L + 8],
	[U + 9, BL + 8],
	[U + 5, BR + 8],
	[D + 8, DBL + 5],
	[D + 7, B + 5],
	[D + 6, DBR + 5],
	[D + 5, DR + 5],
	[D + 9, DL + 5],
	[F + 9, R + 7],
	[F + 5, DR + 7],
	[L + 9, F + 7],
	[L + 5, DL + 7],
	[BL + 9, L + 7],
	[BL + 5, DBL + 7],
	[BR + 9, BL + 7],
	[BR + 5, B + 7],
	[BR + 7, R + 9],
	[DBR + 7, R + 5],
	[B + 9, DBL + 6],
	[B + 8, BL + 6],
	[DBR + 9, B + 6],
	[DBR + 8, BR + 6],
	[DR + 9, DBR + 6],
	[DR + 8, R + 6],
	[DL + 9, DR + 6],
	[DL + 8, F + 6],
	[DBL + 9, DL + 6],
	[DBL + 8, L + 6]
];

// ==================== MgmCubie Class ====================

export class MgmCubie {
	corn: number[];
	twst: number[];
	edge: number[];
	flip: number[];

	// Static tables (initialized lazily)
	static SOLVED: MgmCubie;
	static moveCube: MgmCubie[];
	static symCube: MgmCubie[];
	static symMult: number[][];
	static symMulI: number[][];
	static symMulM: number[][];

	constructor() {
		this.corn = [];
		this.twst = [];
		this.edge = [];
		this.flip = [];
		for (let i = 0; i < 20; i++) {
			this.corn[i] = i;
			this.twst[i] = 0;
		}
		for (let i = 0; i < 30; i++) {
			this.edge[i] = i;
			this.flip[i] = 0;
		}
	}

	static MgmMult(a: MgmCubie, b: MgmCubie, prod: MgmCubie): void {
		for (let i = 0; i < 20; i++) {
			prod.corn[i] = a.corn[b.corn[i]];
			prod.twst[i] = (a.twst[b.corn[i]] + b.twst[i]) % 3;
		}
		for (let i = 0; i < 30; i++) {
			prod.edge[i] = a.edge[b.edge[i]];
			prod.flip[i] = a.flip[b.edge[i]] ^ b.flip[i];
		}
	}

	static MgmMult3(a: MgmCubie, b: MgmCubie, c: MgmCubie, prod: MgmCubie): void {
		for (let i = 0; i < 20; i++) {
			prod.corn[i] = a.corn[b.corn[c.corn[i]]];
			prod.twst[i] = (a.twst[b.corn[c.corn[i]]] + b.twst[c.corn[i]] + c.twst[i]) % 3;
		}
		for (let i = 0; i < 30; i++) {
			prod.edge[i] = a.edge[b.edge[c.edge[i]]];
			prod.flip[i] = a.flip[b.edge[c.edge[i]]] ^ b.flip[c.edge[i]] ^ c.flip[i];
		}
	}

	toFaceCube(cFacelet?: number[][], eFacelet?: number[][]): number[] {
		cFacelet = cFacelet || cornFacelet;
		eFacelet = eFacelet || edgeFacelet;
		const f: number[] = [];
		fillFacelet(cFacelet, f, this.corn, this.twst, 10);
		fillFacelet(eFacelet, f, this.edge, this.flip, 10);
		return f;
	}

	fromFacelet(facelet: number[], cFacelet?: number[][], eFacelet?: number[][]): MgmCubie | -1 {
		cFacelet = cFacelet || cornFacelet;
		eFacelet = eFacelet || edgeFacelet;
		let count = 0;
		const f: number[] = [];
		for (let i = 0; i < 120; ++i) {
			f[i] = facelet[i];
			count += Math.pow(16, f[i]);
		}
		if (count !== 0xaaaaaaaaaaaa) {
			return -1;
		}
		if (detectFacelet(cFacelet, f, this.corn, this.twst, 10) === -1
			|| detectFacelet(eFacelet, f, this.edge, this.flip, 10) === -1) {
			return -1;
		}
		return this;
	}

	hashCode(): number {
		let ret = 0;
		for (let i = 0; i < 20; i++) {
			ret = 0 | (ret * 31 + this.corn[i] * 3 + this.twst[i]);
			ret = 0 | (ret * 31 + this.edge[i] * 2 + this.flip[i]);
		}
		return ret;
	}

	invFrom(cc: MgmCubie): MgmCubie {
		for (let i = 0; i < 20; i++) {
			this.corn[cc.corn[i]] = i;
			this.twst[cc.corn[i]] = (3 - cc.twst[i]) % 3;
		}
		for (let i = 0; i < 30; i++) {
			this.edge[cc.edge[i]] = i;
			this.flip[cc.edge[i]] = cc.flip[i];
		}
		return this;
	}

	copy(cc: MgmCubie): MgmCubie {
		this.corn = cc.corn.slice();
		this.twst = cc.twst.slice();
		this.edge = cc.edge.slice();
		this.flip = cc.flip.slice();
		return this;
	}

	isEqual(c: MgmCubie): boolean {
		for (let i = 0; i < 20; i++) {
			if (this.corn[i] !== c.corn[i] || this.twst[i] !== c.twst[i]) {
				return false;
			}
		}
		for (let i = 0; i < 30; i++) {
			if (this.edge[i] !== c.edge[i] || this.flip[i] !== c.flip[i]) {
				return false;
			}
		}
		return true;
	}

	setCComb(idx: number, r?: number): void {
		setComb(this.corn, this.twst, idx, 20, r || 4);
	}

	getCComb(r?: number): number[] {
		return getComb(this.corn, this.twst, 20, r || 4, 3);
	}

	setEComb(idx: number, r?: number): void {
		setComb(this.edge, this.flip, idx, 30, r || 4);
	}

	getEComb(r?: number): number[] {
		return getComb(this.edge, this.flip, 30, r || 4, 2);
	}

	faceletMove(face: number, pow: number, wide: number): void {
		const facelet = this.toFaceCube();
		const state: number[] = [];
		for (let i = 0; i < 12; i++) {
			for (let j = 0; j < 10; j++) {
				state[i * 11 + j] = facelet[i * 10 + j];
			}
			state[i * 11 + 10] = 0;
		}
		minx.doMove(state, face, pow, wide);
		for (let i = 0; i < 12; i++) {
			for (let j = 0; j < 10; j++) {
				facelet[i * 10 + j] = state[i * 11 + j];
			}
		}
		this.fromFacelet(facelet);
	}
}

MgmCubie.SOLVED = new MgmCubie();

// ==================== Comb Helpers ====================

function getComb(perm: number[], ori: number[], n: number, r: number, base: number): number[] {
	let thres = r;
	let idxComb = 0;
	let idxOri = 0;
	const permR: number[] = [];
	for (let i = n - 1; i >= 0; i--) {
		if (perm[i] < thres) {
			idxComb += Cnk[i][r--];
			idxOri = idxOri * base + ori[i];
			permR[r] = perm[i];
		}
	}
	return [idxComb, getNPerm(permR, thres), idxOri];
}

function setComb(perm: number[], ori: number[], idx: number, n: number, r: number): void {
	let fill = n - 1;
	for (let i = n - 1; i >= 0; i--) {
		if (idx >= Cnk[i][r]) {
			idx -= Cnk[i][r--];
			perm[i] = r;
		} else {
			perm[i] = fill--;
		}
		ori[i] = 0;
	}
}

// ==================== Perm4 Tables ====================

let perm4Mult: number[][] = [];
let perm4MulT: number[][] = [];
let perm4MulF: number[][] = [];
let perm4TT: number[][] = [];

// ==================== Move check table ====================

let ckmv: number[] = [];

// ==================== Move direction mappings ====================

const urfMove = [1, 2, 0, 5, 10, 6, 3, 4, 9, 11, 7, 8];
const y2Move = [0, 3, 4, 5, 1, 2, 8, 9, 10, 6, 7, 11];
const yMove = [0, 2, 3, 4, 5, 1, 7, 8, 9, 10, 6, 11];

// ==================== doCombMove4 ====================

function doCombMove4(moveTable: any[][], N_PERM: number, N_ORI: number, TT_OFFSET: number, idx: number, move: number): number {
	const slice = ~~(idx / N_ORI / N_PERM);
	let perm = ~~(idx / N_ORI) % N_PERM;
	let twst = idx % N_ORI;
	const val = moveTable[move][slice];
	const newSlice = val[0];
	perm = perm4Mult[perm][val[1]];
	twst = (N_ORI & 1) // is corner coord?
		? perm4TT[perm4MulT[val[1]][twst * TT_OFFSET] / TT_OFFSET][val[2]]
		: (perm4MulF[val[1]][twst * TT_OFFSET] / TT_OFFSET ^ val[2]);
	return (newSlice * N_PERM + perm) * N_ORI + twst;
}

// ==================== Comb4/Comb3 Full Move ====================

function comb4FullMove(moveTable: any[][], idx: number, move: number): number {
	const slice = ~~(idx / 81 / 24);
	let perm = ~~(idx / 81) % 24;
	let twst = idx % 81;
	const val = moveTable[move][slice];
	const newSlice = val[0];
	perm = perm4Mult[perm][val[1]];
	twst = perm4TT[perm4MulT[val[1]][twst]][val[2]];
	return newSlice * 81 * 24 + perm * 81 + twst;
}

function comb3FullMove(moveTable: any[][], idx: number, move: number): number {
	const slice = ~~(idx / 27 / 6);
	let perm = ~~(idx / 27) % 6;
	let twst = idx % 27;
	const val = moveTable[move][slice];
	const newSlice = val[0];
	perm = perm4Mult[perm][val[1]];
	twst = perm4TT[perm4MulT[val[1]][twst * 3] / 3][val[2]];
	return newSlice * 27 * 6 + perm * 27 + twst;
}

// ==================== Coordinate Classes ====================

class CCombCoord {
	map: MgmCubie;
	imap: MgmCubie;
	tmp: MgmCubie;

	constructor(cubieMap: number[]) {
		this.map = new MgmCubie();
		this.imap = new MgmCubie();
		this.map.corn = cubieMap.slice();
		for (let i = 0; i < 20; i++) {
			if (cubieMap.indexOf(i) === -1) {
				this.map.corn.push(i);
			}
		}
		this.imap.invFrom(this.map);
		this.tmp = new MgmCubie();
	}

	get(cc: MgmCubie, r?: number): number[] {
		MgmCubie.MgmMult3(this.imap, cc, this.map, this.tmp);
		return this.tmp.getCComb(r);
	}

	set(cc: MgmCubie, idx: number, r?: number): void {
		this.tmp.setCComb(idx, r);
		MgmCubie.MgmMult3(this.map, this.tmp, this.imap, cc);
	}
}

class ECombCoord {
	map: MgmCubie;
	imap: MgmCubie;
	tmp: MgmCubie;

	constructor(cubieMap: number[]) {
		this.map = new MgmCubie();
		this.imap = new MgmCubie();
		this.map.edge = cubieMap.slice();
		for (let i = 0; i < 30; i++) {
			if (cubieMap.indexOf(i) === -1) {
				this.map.edge.push(i);
			}
		}
		this.imap.invFrom(this.map);
		this.tmp = new MgmCubie();
	}

	get(cc: MgmCubie, r?: number): number[] {
		MgmCubie.MgmMult3(this.imap, cc, this.map, this.tmp);
		return this.tmp.getEComb(r);
	}

	set(cc: MgmCubie, idx: number, r?: number): void {
		this.tmp.setEComb(idx, r);
		MgmCubie.MgmMult3(this.map, this.tmp, this.imap, cc);
	}
}

class EOriCoord {
	map: MgmCubie;
	imap: MgmCubie;
	tmp: MgmCubie;

	constructor(cubieMap: number[]) {
		const base = new ECombCoord(cubieMap);
		this.map = base.map;
		this.imap = base.imap;
		this.tmp = base.tmp;
	}

	get(cc: MgmCubie, r: number): number {
		let idx = 0;
		MgmCubie.MgmMult3(this.imap, cc, this.map, this.tmp);
		for (let i = 0; i < r; i++) {
			idx = idx | (this.tmp.flip[i] << i);
		}
		return idx;
	}

	set(cc: MgmCubie, idx: number, r: number): void {
		for (let i = 0; i < 30; i++) {
			this.tmp.flip[i] = i < r ? (idx >> i) & 1 : 0;
		}
		MgmCubie.MgmMult3(this.map, this.tmp, this.imap, cc);
	}
}

class EPermCoord {
	map: MgmCubie;
	imap: MgmCubie;
	tmp: MgmCubie;

	constructor(cubieMap: number[]) {
		const base = new ECombCoord(cubieMap);
		this.map = base.map;
		this.imap = base.imap;
		this.tmp = base.tmp;
	}

	get(cc: MgmCubie, r: number): number {
		MgmCubie.MgmMult3(this.imap, cc, this.map, this.tmp);
		return getNPerm(this.tmp.edge, r);
	}

	set(cc: MgmCubie, idx: number, r: number): void {
		const edge: number[] = [];
		setNPerm(edge, idx, r);
		for (let i = 0; i < 30; i++) {
			this.tmp.edge[i] = i < r ? edge[i] : i;
		}
		MgmCubie.MgmMult3(this.map, this.tmp, this.imap, cc);
	}
}

class COriCoord {
	map: MgmCubie;
	imap: MgmCubie;
	tmp: MgmCubie;

	constructor(cubieMap: number[]) {
		const base = new CCombCoord(cubieMap);
		this.map = base.map;
		this.imap = base.imap;
		this.tmp = base.tmp;
	}

	get(cc: MgmCubie, r: number): number {
		let idx = 0;
		MgmCubie.MgmMult3(this.imap, cc, this.map, this.tmp);
		for (let i = 0, base = 1; i < r; i++, base *= 3) {
			idx += this.tmp.twst[i] * base;
		}
		return idx;
	}

	set(cc: MgmCubie, idx: number, r: number): void {
		for (let i = 0; i < 30; i++) {
			this.tmp.twst[i] = i < r ? idx % 3 : 0;
			idx = ~~(idx / 3);
		}
		MgmCubie.MgmMult3(this.map, this.tmp, this.imap, cc);
	}
}

class CPermCoord {
	map: MgmCubie;
	imap: MgmCubie;
	tmp: MgmCubie;

	constructor(cubieMap: number[]) {
		const base = new CCombCoord(cubieMap);
		this.map = base.map;
		this.imap = base.imap;
		this.tmp = base.tmp;
	}

	get(cc: MgmCubie, r: number): number {
		MgmCubie.MgmMult3(this.imap, cc, this.map, this.tmp);
		return getNPerm(this.tmp.corn, r);
	}

	set(cc: MgmCubie, idx: number, r: number): void {
		const corn: number[] = [];
		setNPerm(corn, idx, r);
		for (let i = 0; i < 20; i++) {
			this.tmp.corn[i] = i < r ? corn[i] : i;
		}
		MgmCubie.MgmMult3(this.map, this.tmp, this.imap, cc);
	}
}

// ==================== Base Init ====================

let baseInitDone = false;

function initBase(): void {
	if (baseInitDone) return;
	baseInitDone = true;

	createMoveCube();

	function setTwst4(arr: number[], idx: number, base: number): void {
		for (let k = 0; k < 4; k++) {
			arr[k] = idx % base;
			idx = ~~(idx / base);
		}
	}

	function getTwst4(arr: number[], base: number): number {
		let idx = 0;
		for (let k = 3; k >= 0; k--) {
			idx = idx * base + arr[k];
		}
		return idx;
	}

	const perm1: number[] = [];
	const perm2: number[] = [];
	const perm3: number[] = [];
	for (let i = 0; i < 24; i++) {
		perm4Mult[i] = [];
		setNPerm(perm1, i, 4);
		for (let j = 0; j < 24; j++) {
			setNPerm(perm2, j, 4);
			for (let k = 0; k < 4; k++) {
				perm3[k] = perm1[perm2[k]];
			}
			perm4Mult[i][j] = getNPerm(perm3, 4);
		}
	}
	for (let j = 0; j < 24; j++) {
		setNPerm(perm2, j, 4);
		perm4MulT[j] = [];
		for (let i = 0; i < 81; i++) {
			setTwst4(perm1, i, 3);
			for (let k = 0; k < 4; k++) {
				perm3[k] = perm1[perm2[k]];
			}
			perm4MulT[j][i] = getTwst4(perm3, 3);
		}
		perm4MulF[j] = [];
		for (let i = 0; i < 16; i++) {
			setTwst4(perm1, i, 2);
			for (let k = 0; k < 4; k++) {
				perm3[k] = perm1[perm2[k]];
			}
			perm4MulF[j][i] = getTwst4(perm3, 2);
		}
	}
	for (let j = 0; j < 81; j++) {
		perm4TT[j] = [];
		setTwst4(perm2, j, 3);
		for (let i = 0; i < 81; i++) {
			setTwst4(perm1, i, 3);
			for (let k = 0; k < 4; k++) {
				perm3[k] = (perm1[k] + perm2[k]) % 3;
			}
			perm4TT[j][i] = getTwst4(perm3, 3);
		}
	}

	const tmp1 = new MgmCubie();
	const tmp2 = new MgmCubie();
	for (let m1 = 0; m1 < 12; m1++) {
		ckmv[m1] = 1 << m1;
		for (let m2 = 0; m2 < m1; m2++) {
			MgmCubie.MgmMult(MgmCubie.moveCube[m1 * 4], MgmCubie.moveCube[m2 * 4], tmp1);
			MgmCubie.MgmMult(MgmCubie.moveCube[m2 * 4], MgmCubie.moveCube[m1 * 4], tmp2);
			if (tmp1.isEqual(tmp2)) {
				ckmv[m1] |= 1 << m2;
			}
		}
	}
}

// ==================== Create Move Cube & Symmetries ====================

function createMoveCube(): void {
	const moveCube: MgmCubie[] = [];
	const moveHash: number[] = [];
	for (let i = 0; i < 12 * 4; i++) {
		moveCube[i] = new MgmCubie();
	}
	for (let a = 0; a < 48; a += 4) {
		moveCube[a].faceletMove(a >> 2, 1, 0);
		moveHash[a] = moveCube[a].hashCode();
		for (let p = 0; p < 3; p++) {
			MgmCubie.MgmMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1]);
			moveHash[a + p + 1] = moveCube[a + p + 1].hashCode();
		}
	}
	MgmCubie.moveCube = moveCube;

	// init sym
	const symCube: MgmCubie[] = [];
	const symMult: number[][] = [];
	const symMulI: number[][] = [];
	const symMulM: number[][] = [];
	const symHash: number[] = [];
	const tmp = new MgmCubie();
	for (let s = 0; s < 60; s++) {
		symCube[s] = new MgmCubie().copy(tmp);
		symHash[s] = symCube[s].hashCode();
		symMult[s] = [];
		symMulI[s] = [];
		tmp.faceletMove(0, 1, 1); // [U]
		if (s % 5 === 4) { // [F] or [R]
			tmp.faceletMove(s % 10 === 4 ? 1 : 2, 1, 1);
		}
		if (s % 30 === 29) {
			tmp.faceletMove(1, 2, 1);
			tmp.faceletMove(2, 1, 1);
			tmp.faceletMove(0, 3, 1);
		}
	}
	for (let i = 0; i < 60; i++) {
		for (let j = 0; j < 60; j++) {
			MgmCubie.MgmMult(symCube[i], symCube[j], tmp);
			const k = symHash.indexOf(tmp.hashCode());
			symMult[i][j] = k;
			symMulI[k][j] = i;
		}
	}
	for (let s = 0; s < 60; s++) {
		symMulM[s] = [];
		for (let j = 0; j < 12; j++) {
			MgmCubie.MgmMult3(symCube[symMulI[0][s]], moveCube[j * 4], symCube[s], tmp);
			const k = moveHash.indexOf(tmp.hashCode());
			symMulM[s][j] = k >> 2;
		}
	}
	MgmCubie.symCube = symCube;
	MgmCubie.symMult = symMult;
	MgmCubie.symMulI = symMulI;
	MgmCubie.symMulM = symMulM;
}

// ==================== Move to String ====================

const FACE_NAMES = ['U', 'R', 'F', 'L', 'BL', 'BR', 'DR', 'DL', 'DBL', 'B', 'DBR', 'D'];
const POW_SUFFIXES = ['', '2', "2'", "'"];

function move2str(moves: number[][]): string {
	const ret: string[] = [];
	for (let i = 0; i < moves.length; i++) {
		ret.push(FACE_NAMES[moves[i][0]] + POW_SUFFIXES[moves[i][1]]);
	}
	return ret.join(' ');
}

function move2strRURp(moves: number[][]): string {
	const ret: string[] = [];
	for (let i = 0; i < moves.length; i++) {
		const suffix = POW_SUFFIXES[moves[i][1]];
		ret.push(moves[i][0] === 0 ? 'U' + suffix : "R U" + suffix + " R'");
	}
	return ret.join(' ');
}

// ==================== Kilominx Solver ====================

let KlmPhase1Move: any[][] = [];
let KlmPhase2Move: any[][] = [];
let KlmPhase3Move: any[][] = [];
let KlmPhase1Prun: number[] = [];
let KlmPhase2Prun: number[] = [];
let KlmPhase3Prun: number[] = [];
let klmPhase1Coord: CCombCoord;
let klmPhase2Coord: CCombCoord;
let klmPhase3Coord: CCombCoord;
let klmSolv1: Searcher | null = null;
let klmSolv2: Searcher | null = null;
let klmSolv3: Searcher | null = null;

function initKlmPhase1(): void {
	klmPhase1Coord = new CCombCoord([5, 6, 7, 8, 9]);
	const tmp1 = new MgmCubie();
	const tmp2 = new MgmCubie();
	createMove(KlmPhase1Move as any, 1140, function (idx: number, move: number) {
		klmPhase1Coord.set(tmp1, idx, 3);
		MgmCubie.MgmMult(tmp1, MgmCubie.moveCube[move * 4], tmp2);
		return klmPhase1Coord.get(tmp2, 3) as any;
	}, 12);
	createPrun(KlmPhase1Prun, 0, 1140 * 27 * 6, 8, comb3FullMove.bind(null, KlmPhase1Move), 12, 4, 5);
	const doKlmPhase1Move = comb3FullMove.bind(null, KlmPhase1Move);
	klmSolv1 = new Searcher(null, function (idx: any) {
		return Math.max(getPruning(KlmPhase1Prun, idx[0]), getPruning(KlmPhase1Prun, idx[1]));
	}, function (idx: any, move: number) {
		const idx1 = [doKlmPhase1Move(idx[0], move), doKlmPhase1Move(idx[1], y2Move[move])];
		if (idx1[0] === idx[0] && idx1[1] === idx[1]) {
			return null;
		}
		return idx1;
	}, 12, 4, ckmv);
}

function initKlmPhase2(): void {
	klmPhase2Coord = new CCombCoord([13, 15, 16, 0, 1, 2, 3, 4, 10, 11, 12, 14, 17, 18, 19]);
	const tmp1 = new MgmCubie();
	const tmp2 = new MgmCubie();
	createMove(KlmPhase2Move as any, 455, function (idx: number, move: number) {
		klmPhase2Coord.set(tmp1, idx, 3);
		MgmCubie.MgmMult(tmp1, MgmCubie.moveCube[move * 4], tmp2);
		return klmPhase2Coord.get(tmp2, 3) as any;
	}, 6);
	createPrun(KlmPhase2Prun, 0, 455 * 27 * 6, 8, comb3FullMove.bind(null, KlmPhase2Move), 6, 4, 4);
	const doKlmPhase2Move = comb3FullMove.bind(null, KlmPhase2Move);
	klmSolv2 = new Searcher(null, function (idx: any) {
		return Math.max(getPruning(KlmPhase2Prun, idx[0]), getPruning(KlmPhase2Prun, idx[1]));
	}, function (idx: any, move: number) {
		const idx1 = [doKlmPhase2Move(idx[0], move), doKlmPhase2Move(idx[1], yMove[move])];
		if (idx1[0] === idx[0] && idx1[1] === idx[1]) {
			return null;
		}
		return idx1;
	}, 6, 4, ckmv);
}

function initKlmPhase3(): void {
	klmPhase3Coord = new CCombCoord([0, 1, 2, 3, 4, 10, 11, 14, 17, 18]);
	const tmp1 = new MgmCubie();
	const tmp2 = new MgmCubie();
	createMove(KlmPhase3Move as any, 210, function (idx: number, move: number) {
		klmPhase3Coord.set(tmp1, idx);
		MgmCubie.MgmMult(tmp1, MgmCubie.moveCube[move * 4], tmp2);
		return klmPhase3Coord.get(tmp2) as any;
	}, 3);
	const doKlmPhase3Move = comb4FullMove.bind(null, KlmPhase3Move);
	createPrun(KlmPhase3Prun, 0, 210 * 81 * 24, 14, doKlmPhase3Move, 3, 4, 6);
	klmSolv3 = new Searcher(null, function (idx: any) {
		return Math.max(getPruning(KlmPhase3Prun, idx[0]), getPruning(KlmPhase3Prun, idx[1]), getPruning(KlmPhase3Prun, idx[2]));
	}, function (idx: any, move: number) {
		return [doKlmPhase3Move(idx[0], move), doKlmPhase3Move(idx[1], (move + 1) % 3), doKlmPhase3Move(idx[2], (move + 2) % 3)];
	}, 3, 4, ckmv);
}

let klmInitDone = false;

function initKlm(): void {
	if (klmInitDone) return;
	klmInitDone = true;
	initBase();
	initKlmPhase1();
	initKlmPhase2();
	initKlmPhase3();
}

// ==================== solveKlmCubie ====================

export function solveKlmCubie(cc: MgmCubie, inverse?: boolean): string {
	initKlm();
	const kc0 = new MgmCubie();
	const kc1 = new MgmCubie();
	const kc2 = new MgmCubie();

	kc0.copy(cc);

	let solsym = 0;

	// klmPhase1
	const idx1s: number[][] = [];
	for (let s = 0; s < (inverse ? 12 : 1); s++) {
		MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][s * 5]], kc0, MgmCubie.symCube[s * 5], kc1);
		const val0 = klmPhase1Coord.get(kc1, 3);
		MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][2]], kc1, MgmCubie.symCube[2], kc2);
		const val1 = klmPhase1Coord.get(kc2, 3);
		idx1s.push([val0[0] * 27 * 6 + val0[1] * 27 + val0[2], val1[0] * 27 * 6 + val1[1] * 27 + val1[2]]);
	}
	const sol1s = klmSolv1!.solveMulti(idx1s, 0, 9) as [number[][], number];
	let ksym = sol1s[1] * 5;
	const sol1 = sol1s[0];
	MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][ksym]], kc0, MgmCubie.symCube[ksym], kc1);
	kc0.copy(kc1);
	solsym = MgmCubie.symMult[solsym][ksym];
	for (let i = 0; i < sol1.length; i++) {
		const move = sol1[i];
		MgmCubie.MgmMult(kc0, MgmCubie.moveCube[move[0] * 4 + move[1]], kc1);
		kc0.copy(kc1);
		move[0] = MgmCubie.symMulM[MgmCubie.symMulI[0][solsym]][move[0]];
	}

	// klmPhase2
	const idx2s: number[][] = [];
	for (let s = 0; s < (inverse ? 5 : 1); s++) {
		MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][s]], kc0, MgmCubie.symCube[s], kc1);
		const val0 = klmPhase2Coord.get(kc1, 3);
		MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][1]], kc1, MgmCubie.symCube[1], kc2);
		const val1 = klmPhase2Coord.get(kc2, 3);
		idx2s.push([val0[0] * 27 * 6 + val0[1] * 27 + val0[2], val1[0] * 27 * 6 + val1[1] * 27 + val1[2]]);
	}
	const sol2s = klmSolv2!.solveMulti(idx2s, 0, 14) as [number[][], number];
	ksym = sol2s[1];
	const sol2 = sol2s[0];
	MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][ksym]], kc0, MgmCubie.symCube[ksym], kc1);
	kc0.copy(kc1);
	solsym = MgmCubie.symMult[solsym][ksym];
	for (let i = 0; i < sol2.length; i++) {
		const move = sol2[i];
		MgmCubie.MgmMult(kc0, MgmCubie.moveCube[move[0] * 4 + move[1]], kc1);
		kc0.copy(kc1);
		move[0] = MgmCubie.symMulM[MgmCubie.symMulI[0][solsym]][move[0]];
	}

	// klmPhase3
	const val0 = klmPhase3Coord.get(kc0);
	MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][6]], kc0, MgmCubie.symCube[6], kc1);
	const val1 = klmPhase3Coord.get(kc1);
	MgmCubie.MgmMult3(MgmCubie.symCube[MgmCubie.symMulI[0][29]], kc0, MgmCubie.symCube[29], kc1);
	const val2 = klmPhase3Coord.get(kc1);
	const idx = [
		(val0[0] * 24 + val0[1]) * 81 + val0[2],
		(val1[0] * 24 + val1[1]) * 81 + val1[2],
		(val2[0] * 24 + val2[1]) * 81 + val2[2]
	];
	const sol3 = klmSolv3!.solve(idx, 0, 14) as number[][];
	for (let i = 0; i < sol3.length; i++) {
		const move = sol3[i];
		move[0] = MgmCubie.symMulM[MgmCubie.symMulI[0][solsym]][move[0]];
	}
	return move2str(([] as number[][]).concat(sol1, sol2, sol3));
}

// ==================== Megaminx Solver ====================

let mgmSolv1: BlockSolver | null = null;
let mgmSolv2: BlockSolver | null = null;
let mgmSolv3: BlockSolver | null = null;
let mgmSolv4: BlockSolver | null = null;
let mgmSolv5: BlockSolver | null = null;
let mgmSolv6: BlockSolver | null = null;
let mgmSolv7: BlockSolver | null = null;
let mgmSolv8: BlockSolver | null = null;
let mgmSolv9: BlockSolver | null = null;
let mgmSolvA: BlockRURpSolver | null = null;

// ==================== BlockSolver ====================

class BlockSolver {
	solv: Searcher;
	mgmECoord: ECombCoord;
	mgmCCoord: CCombCoord;
	mgmOCoord: EOriCoord | COriCoord | null;
	N_EDGE: number;
	N_CORN: number;
	N_ELEN: number;

	constructor(edges: number[], corns: number[], N_EDGE: number, N_CORN: number, N_MOVE: number, SOLV_ORI?: number) {
		SOLV_ORI = SOLV_ORI || 0;

		const mgmECoord = new ECombCoord(edges);
		const mgmCCoord = new CCombCoord(corns);
		const mgmOCoord = SOLV_ORI === 1 ? new EOriCoord(edges) : SOLV_ORI === 2 ? new COriCoord(corns) : null;

		const MgmEMove: any[][] = [];
		const MgmCMove: any[][] = [];
		const MgmOMove: number[][] = [];
		const MgmEPrun: number[] = [];
		const MgmCPrun: number[] = [];
		const MgmOPrun: number[] = [];

		const N_ECOMB = Cnk[edges.length][N_EDGE];
		const N_CCOMB = Cnk[corns.length][N_CORN];
		const N_EPERM = fact[N_EDGE];
		const N_CPERM = fact[N_CORN];
		const N_EORI = Math.pow(2, N_EDGE);
		const N_CORI = Math.pow(3, N_CORN);
		const N_ORI = Math.pow(1 + (SOLV_ORI || 0), SOLV_ORI === 1 ? edges.length : corns.length);

		const tmp1 = new MgmCubie();
		const tmp2 = new MgmCubie();

		createMove(MgmEMove as any, N_ECOMB, function (idx: number, move: number) {
			mgmECoord.set(tmp1, idx, N_EDGE);
			MgmCubie.MgmMult(tmp1, MgmCubie.moveCube[move * 4], tmp2);
			return mgmECoord.get(tmp2, N_EDGE) as any;
		}, N_MOVE);

		createMove(MgmCMove as any, N_CCOMB, function (idx: number, move: number) {
			mgmCCoord.set(tmp1, idx, N_CORN);
			MgmCubie.MgmMult(tmp1, MgmCubie.moveCube[move * 4], tmp2);
			return mgmCCoord.get(tmp2, N_CORN) as any;
		}, N_MOVE);

		const doMgmEMove = doCombMove4.bind(null, MgmEMove, N_EPERM, N_EORI, 16 / N_EORI);
		const doMgmCMove = doCombMove4.bind(null, MgmCMove, N_CPERM, N_CORI, 81 / N_CORI);

		createPrun(MgmEPrun, 0, N_ECOMB * N_EPERM * N_EORI, 14, doMgmEMove, N_MOVE, 4);
		createPrun(MgmCPrun, 0, N_CCOMB * N_CPERM * N_CORI, 14, doMgmCMove, N_MOVE, 4);
		if (SOLV_ORI) {
			createMove(MgmOMove as any, N_ORI, function (idx: number, move: number) {
				mgmOCoord!.set(tmp1, idx, edges.length);
				MgmCubie.MgmMult(tmp1, MgmCubie.moveCube[move * 4], tmp2);
				return mgmOCoord!.get(tmp2, edges.length) as any;
			}, N_MOVE);
			createPrun(MgmOPrun, 0, N_CCOMB * N_ORI, 14, function (idx: number, move: number) {
				const slice = ~~(idx / N_ORI);
				const twst = idx % N_ORI;
				return MgmCMove[move][slice][0] * N_ORI + MgmOMove[move][twst];
			}, N_MOVE, 4);
		}

		const MgmECPrun: number[] = [];
		createPrun(MgmECPrun, 0, N_ECOMB * N_CCOMB, 14, function (idx: number, move: number) {
			const idxE = ~~(idx / N_CCOMB);
			const idxC = idx % N_CCOMB;
			return MgmEMove[move][idxE][0] * N_CCOMB + MgmCMove[move][idxC][0];
		}, N_MOVE, 4);

		this.solv = new Searcher(null, function (idx: any) {
			return Math.max(
				getPruning(MgmEPrun, idx[0]),
				getPruning(MgmCPrun, idx[1]),
				SOLV_ORI ? getPruning(MgmOPrun, ~~(idx[1] / N_CPERM / N_CORI) * N_ORI + idx[2]) : 0,
				getPruning(MgmECPrun, ~~(idx[0] / N_EPERM / N_EORI) * N_CCOMB + ~~(idx[1] / N_CPERM / N_CORI))
			);
		}, function (idx: any, move: number) {
			const idx1 = [
				doMgmEMove(idx[0], move),
				doMgmCMove(idx[1], move),
				SOLV_ORI ? MgmOMove[move][idx[2]] : 0
			];
			if (idx1[0] === idx[0] && idx1[1] === idx[1] && idx1[2] === idx[2]) {
				return null;
			}
			return idx1;
		}, N_MOVE, 4, ckmv);

		this.mgmECoord = mgmECoord;
		this.mgmCCoord = mgmCCoord;
		this.mgmOCoord = mgmOCoord;
		this.N_EDGE = N_EDGE;
		this.N_CORN = N_CORN;
		this.N_ELEN = edges.length;
	}

	getIdx(cc: MgmCubie): number[] {
		const idxE = this.mgmECoord.get(cc, this.N_EDGE);
		const idxC = this.mgmCCoord.get(cc, this.N_CORN);
		const idxO = this.mgmOCoord ? this.mgmOCoord.get(cc, this.N_ELEN) : 0;
		return [
			(idxE[0] * fact[this.N_EDGE] + idxE[1]) * Math.pow(2, this.N_EDGE) + idxE[2],
			(idxC[0] * fact[this.N_CORN] + idxC[1]) * Math.pow(3, this.N_CORN) + idxC[2],
			idxO as number
		];
	}

	solve(kc0: MgmCubie): number[][] {
		const kc1 = new MgmCubie();
		const idx = this.getIdx(kc0);
		const sol = this.solv.solve(idx, 0, 30) as number[][];
		for (let i = 0; i < sol.length; i++) {
			const move = sol[i];
			MgmCubie.MgmMult(kc0, MgmCubie.moveCube[move[0] * 4 + move[1]], kc1);
			kc0.copy(kc1);
		}
		return sol;
	}

	solveMulti(kcs: MgmCubie[], nsol: number): [MgmCubie[], [number[][], number][]] {
		const kc1 = new MgmCubie();
		const idxs: number[][] = [];
		for (let i = 0; i < kcs.length; i++) {
			idxs.push(this.getIdx(kcs[i]));
		}
		const solSet = new Set<number>();
		const sols: [number[][], number][] = [];
		const kcsRet: MgmCubie[] = [];
		this.solv.solveMulti(idxs, 0, 30, function (sol: number[][], sidx: number) {
			const kc0 = new MgmCubie();
			kc0.copy(kcs[sidx]);
			for (let i = 0; i < sol.length; i++) {
				const move = sol[i];
				MgmCubie.MgmMult(kc0, MgmCubie.moveCube[move[0] * 4 + move[1]], kc1);
				kc0.copy(kc1);
			}
			const hashCode = kc0.hashCode();
			if (solSet.has(hashCode)) {
				return false;
			}
			solSet.add(hashCode);
			sols.push([sol.slice(), sidx]);
			kcsRet.push(kc0);
			return sols.length >= nsol;
		});
		return [kcsRet, sols];
	}
}

// ==================== BlockRURpSolver ====================

class BlockRURpSolver {
	solv: Searcher;
	mgmECoord: { get: (cc: MgmCubie) => number };
	mgmCCoord: { get: (cc: MgmCubie) => number };
	N_EDGE: number;
	N_CORN: number;

	constructor(edges: number[], corns: number[], N_EDGE: number, N_CORN: number, N_MOVE: number) {
		const mgmEPCoord = new EPermCoord(edges);
		const mgmCPCoord = new CPermCoord(corns);
		const mgmEOCoord = new EOriCoord(edges);
		const mgmCOCoord = new COriCoord(corns);

		const MgmEPMove: number[][] = [];
		const MgmCPMove: number[][] = [];
		const MgmEOMove: number[][] = [];
		const MgmCOMove: number[][] = [];
		const MgmEPrun: number[] = [];
		const MgmCPrun: number[] = [];

		const N_EPERM = fact[N_EDGE];
		const N_CPERM = fact[N_CORN];
		const N_EORI = Math.pow(2, N_EDGE);
		const N_CORI = Math.pow(3, N_CORN);

		const tmp1 = new MgmCubie();
		const tmp2 = new MgmCubie();
		const moveRURp = new MgmCubie();
		MgmCubie.MgmMult3(MgmCubie.moveCube[4], MgmCubie.moveCube[0], MgmCubie.moveCube[7], moveRURp);

		const coordMove = function (coord: EPermCoord | CPermCoord | EOriCoord | COriCoord, N_PIECE: number, idx: number, move: number): number {
			coord.set(tmp1, idx, N_PIECE);
			MgmCubie.MgmMult(tmp1, move === 0 ? MgmCubie.moveCube[0] : moveRURp, tmp2);
			return coord.get(tmp2, N_PIECE) as number;
		};

		createMove(MgmEPMove, N_EPERM, coordMove.bind(null, mgmEPCoord, N_EDGE), N_MOVE);
		createMove(MgmCPMove, N_CPERM, coordMove.bind(null, mgmCPCoord, N_CORN), N_MOVE);
		createMove(MgmEOMove, N_EORI, coordMove.bind(null, mgmEOCoord, N_EDGE), N_MOVE);
		createMove(MgmCOMove, N_CORI, coordMove.bind(null, mgmCOCoord, N_CORN), N_MOVE);

		const doXMove = function (PMove: number[][], OMove: number[][], N_ORI_X: number, idx: number, move: number): number {
			let perm = ~~(idx / N_ORI_X);
			let ori = idx % N_ORI_X;
			perm = PMove[move][perm];
			ori = OMove[move][ori];
			return perm * N_ORI_X + ori;
		};

		const doMgmEMove = doXMove.bind(null, MgmEPMove, MgmEOMove, N_EORI);
		const doMgmCMove = doXMove.bind(null, MgmCPMove, MgmCOMove, N_CORI);

		createPrun(MgmEPrun, 0, N_EPERM * N_EORI, 14, doMgmEMove, N_MOVE, 4);
		createPrun(MgmCPrun, 0, N_CPERM * N_CORI, 14, doMgmCMove, N_MOVE, 4);

		this.solv = new Searcher(null, function (idx: any) {
			return Math.max(
				getPruning(MgmEPrun, idx[0]),
				getPruning(MgmCPrun, idx[1])
			);
		}, function (idx: any, move: number) {
			return [
				doMgmEMove(idx[0], move),
				doMgmCMove(idx[1], move)
			];
		}, N_MOVE, 4, ckmv);

		this.mgmECoord = { get: (cc: MgmCubie) => mgmEPCoord.get(cc, N_EDGE) * N_EORI + mgmEOCoord.get(cc, N_EDGE) };
		this.mgmCCoord = { get: (cc: MgmCubie) => mgmCPCoord.get(cc, N_CORN) * N_CORI + mgmCOCoord.get(cc, N_CORN) };
		this.N_EDGE = N_EDGE;
		this.N_CORN = N_CORN;
	}

	getIdx(cc: MgmCubie): number[] {
		const idxE = this.mgmECoord.get(cc);
		const idxC = this.mgmCCoord.get(cc);
		return [idxE, idxC];
	}

	solve(kc0: MgmCubie): number[][] {
		return BlockSolver.prototype.solve.call(this, kc0);
	}

	solveMulti(kcs: MgmCubie[], nsol: number): [MgmCubie[], [number[][], number][]] {
		return BlockSolver.prototype.solveMulti.call(this, kcs, nsol);
	}
}

// ==================== initMgm ====================

let mgmInitDone = false;

function initMgm(): void {
	if (mgmInitDone) return;
	mgmInitDone = true;
	initBase();

	const edgeOrder = [6, 7, 22, 5, 20, 9, 28, 8, 24, 26, 17, 23, 15, 16, 21, 13, 14, 29, 11, 12, 27, 18, 19, 25, 0, 1, 2, 3, 4, 10];
	const cornOrder = [6, 5, 9, 7, 8, 16, 13, 15, 12, 19, 11, 18, 14, 17, 0, 1, 2, 3, 4, 10];

	mgmSolv1 = new BlockSolver(edgeOrder, cornOrder, 3, 1, 12);
	mgmSolv2 = new BlockSolver(edgeOrder.slice(3), cornOrder.slice(1), 2, 1, 9);
	mgmSolv3 = new BlockSolver(edgeOrder.slice(5), cornOrder.slice(2), 2, 1, 8);
	mgmSolv4 = new BlockSolver(edgeOrder.slice(7), cornOrder.slice(3), 3, 2, 7);
	mgmSolv5 = new BlockSolver(edgeOrder.slice(10), cornOrder.slice(5), 2, 1, 6);
	mgmSolv6 = new BlockSolver(edgeOrder.slice(12), cornOrder.slice(6), 3, 2, 5);
	mgmSolv7 = new BlockSolver(edgeOrder.slice(15), cornOrder.slice(8), 3, 2, 4);
	mgmSolv8 = new BlockSolver(edgeOrder.slice(18), cornOrder.slice(10), 3, 2, 3, 1);
	mgmSolv9 = new BlockSolver(edgeOrder.slice(21), cornOrder.slice(12), 3, 2, 2);
	mgmSolvA = new BlockRURpSolver(edgeOrder.slice(24), cornOrder.slice(14), 6, 6, 2);
}

// ==================== solveMgmCubie ====================

export function solveMgmCubie(cc: MgmCubie, inverse?: boolean): string {
	initMgm();

	const kc0 = new MgmCubie();
	kc0.copy(cc);

	const kcs0 = [kc0];
	const [kcs1, sol1s] = mgmSolv1!.solveMulti(kcs0, 100);
	const [kcs2, sol2s] = mgmSolv2!.solveMulti(kcs1, 100);
	const [kcs3, sol3s] = mgmSolv3!.solveMulti(kcs2, 100);
	const [kcs4, sol4s] = mgmSolv4!.solveMulti(kcs3, 10);
	const [kcs5, sol5s] = mgmSolv5!.solveMulti(kcs4, 100);
	const [kcs6, sol6s] = mgmSolv6!.solveMulti(kcs5, 100);
	const [kcs7, sol7s] = mgmSolv7!.solveMulti(kcs6, 100);
	const [kcs8, sol8s] = mgmSolv8!.solveMulti(kcs7, 5);
	const [kcs9, sol9s] = mgmSolv9!.solveMulti(kcs8, 20);
	const [kcsA, solAs] = mgmSolvA!.solveMulti(kcs9, 1);

	const [solA, sidxA] = solAs[0];
	const [sol9, sidx9] = sol9s[sidxA];
	const [sol8, sidx8] = sol8s[sidx9];
	const [sol7, sidx7] = sol7s[sidx8];
	const [sol6, sidx6] = sol6s[sidx7];
	const [sol5, sidx5] = sol5s[sidx6];
	const [sol4, sidx4] = sol4s[sidx5];
	const [sol3, sidx3] = sol3s[sidx4];
	const [sol2, sidx2] = sol2s[sidx3];
	const [sol1, sidx1] = sol1s[sidx2];

	const ret = [
		move2str(([] as number[][]).concat(sol1, sol2, sol3, sol4, sol5, sol6, sol7, sol8, sol9)),
		move2strRURp(solA)
	].join(' ');

	return ret;
}
