/**
 * min2phase - Kociemba two-phase 3x3 solver
 * Ported from cstimer's min2phase.js to TypeScript
 *
 * IMPORTANT: This file is self-contained. It has its OWN CubieCube class,
 * its own setPruning/getPruning, its own setNPerm/getNPerm.
 * Do NOT import from mathlib.ts — min2phase uses different bit packing:
 *   - Corners: ca[i] = cornerIndex | (orientation << 4)
 *   - Edges: ea[i] = edgeIndex | (flip << 4)
 */

const USE_TWST_FLIP_PRUN = true;
let PARTIAL_INIT_LEVEL = 2;

const MAX_PRE_MOVES = 20;
const TRY_INVERSE = true;
const TRY_THREE_AXES = true;

const USE_CONJ_PRUN: boolean = USE_TWST_FLIP_PRUN;
const MIN_P1LENGTH_PRE = 7;
const MAX_DEPTH2 = 13;

export const INVERSE_SOLUTION = 0x2;

const Ux1 = 0;
const Ux2 = 1;
const Ux3 = 2;
const Rx1 = 3;
const Rx2 = 4;
const Rx3 = 5;
const Fx1 = 6;
const Fx2 = 7;
const Fx3 = 8;
const Dx1 = 9;
const Dx2 = 10;
const Dx3 = 11;
const Lx1 = 12;
const Lx2 = 13;
const Lx3 = 14;
const Bx1 = 15;
const Bx2 = 16;
const Bx3 = 17;

const N_MOVES = 18;
const N_MOVES2 = 10;
const N_FLIP = 2048;
const N_FLIP_SYM = 336;
const N_TWST = 2187;
const N_TWST_SYM = 324;
const N_PERM = 40320;
const N_PERM_SYM = 2768;
const N_MPERM = 24;
const N_SLICE = 495;
const N_COMB = 140;

const SYM_E2C_MAGIC = 0x00DDDD00;
const Cnk: number[][] = [];
const fact: number[] = [1];
const move2str: string[] = [
	"U ", "U2", "U'", "R ", "R2", "R'", "F ", "F2", "F'",
	"D ", "D2", "D'", "L ", "L2", "L'", "B ", "B2", "B'"
];
const ud2std: number[] = [Ux1, Ux2, Ux3, Rx2, Fx2, Dx1, Dx2, Dx3, Lx2, Bx2, Rx1, Rx3, Fx1, Fx3, Lx1, Lx3, Bx1, Bx3];
const std2ud: number[] = [];
const ckmv2bit: number[] = [];
const urfMove: number[][] = [
	[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
	[6, 7, 8, 0, 1, 2, 3, 4, 5, 15, 16, 17, 9, 10, 11, 12, 13, 14],
	[3, 4, 5, 6, 7, 8, 0, 1, 2, 12, 13, 14, 15, 16, 17, 9, 10, 11],
	[2, 1, 0, 5, 4, 3, 8, 7, 6, 11, 10, 9, 14, 13, 12, 17, 16, 15],
	[8, 7, 6, 2, 1, 0, 5, 4, 3, 17, 16, 15, 11, 10, 9, 14, 13, 12],
	[5, 4, 3, 8, 7, 6, 2, 1, 0, 14, 13, 12, 17, 16, 15, 11, 10, 9]
];

// init util
{
	for (let i = 0; i < 18; i++) {
		std2ud[ud2std[i]] = i;
	}
	for (let i = 0; i < 10; i++) {
		const ix = ~~(ud2std[i] / 3);
		ckmv2bit[i] = 0;
		for (let j = 0; j < 10; j++) {
			const jx = ~~(ud2std[j] / 3);
			ckmv2bit[i] |= ((ix === jx) || ((ix % 3 === jx % 3) && (ix >= jx)) ? 1 : 0) << j;
		}
	}
	ckmv2bit[10] = 0;
	for (let i = 0; i < 13; i++) {
		Cnk[i] = [];
		fact[i + 1] = fact[i] * (i + 1);
		Cnk[i][0] = Cnk[i][i] = 1;
		for (let j = 1; j < 13; j++) {
			Cnk[i][j] = j <= i ? Cnk[i - 1][j - 1] + Cnk[i - 1][j] : 0;
		}
	}
}

function setPruning(table: number[], index: number, value: number): void {
	table[index >> 3] ^= value << (index << 2); // index << 2 <=> (index & 7) << 2
}

function getPruning(table: number[], index: number): number {
	return table[index >> 3] >> (index << 2) & 0xf; // index << 2 <=> (index & 7) << 2
}

function getPruningMax(maxValue: number, table: number[], index: number): number {
	return Math.min(maxValue, table[index >> 3] >> (index << 2) & 0xf);
}

function hasZero(val: number): boolean {
	return ((val - 0x11111111) & ~val & 0x88888888) !== 0;
}

function ESym2CSym(idx: number): number {
	return idx ^ (SYM_E2C_MAGIC >> ((idx & 0xf) << 1) & 3);
}

function getPermSymInv(idx: number, sym: number, isCorner: boolean): number {
	let idxi = PermInvEdgeSym[idx];
	if (isCorner) {
		idxi = ESym2CSym(idxi);
	}
	return idxi & 0xfff0 | SymMult[idxi & 0xf][sym];
}

class CubieCube {
	ca: number[];
	ea: number[];

	static urf1: CubieCube;
	static urf2: CubieCube;

	constructor() {
		this.ca = [0, 1, 2, 3, 4, 5, 6, 7];
		this.ea = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
	}

	static EdgeMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		for (let ed = 0; ed < 12; ed++) {
			prod.ea[ed] = a.ea[b.ea[ed] & 0xf] ^ (b.ea[ed] & 0x10);
		}
	}

	static CornMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		for (let corn = 0; corn < 8; corn++) {
			const ori = ((a.ca[b.ca[corn] & 0xf] >> 4) + (b.ca[corn] >> 4)) % 3;
			prod.ca[corn] = a.ca[b.ca[corn] & 0xf] & 0xf | ori << 4;
		}
	}

	static CornMultFull(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		for (let corn = 0; corn < 8; corn++) {
			const oriA = a.ca[b.ca[corn] & 0xf] >> 4;
			const oriB = b.ca[corn] >> 4;
			let ori = oriA + ((oriA < 3) ? oriB : 6 - oriB);
			ori = ori % 3 + ((oriA < 3) === (oriB < 3) ? 0 : 3);
			prod.ca[corn] = a.ca[b.ca[corn] & 0xf] & 0xf | ori << 4;
		}
	}

	static CornConjugate(a: CubieCube, idx: number, b: CubieCube): void {
		const sinv = SymCube[SymMultInv[0][idx]];
		const s = SymCube[idx];
		for (let corn = 0; corn < 8; corn++) {
			const oriA = sinv.ca[a.ca[s.ca[corn] & 0xf] & 0xf] >> 4;
			const oriB = a.ca[s.ca[corn] & 0xf] >> 4;
			const ori = (oriA < 3) ? oriB : (3 - oriB) % 3;
			b.ca[corn] = sinv.ca[a.ca[s.ca[corn] & 0xf] & 0xf] & 0xf | ori << 4;
		}
	}

	static EdgeConjugate(a: CubieCube, idx: number, b: CubieCube): void {
		const sinv = SymCube[SymMultInv[0][idx]];
		const s = SymCube[idx];
		for (let ed = 0; ed < 12; ed++) {
			b.ea[ed] = sinv.ea[a.ea[s.ea[ed] & 0xf] & 0xf] ^ (a.ea[s.ea[ed] & 0xf] & 0x10) ^ (s.ea[ed] & 0x10);
		}
	}

	init(ca: number[], ea: number[]): CubieCube {
		this.ca = ca.slice();
		this.ea = ea.slice();
		return this;
	}

	initCoord(cperm: number, twst: number, eperm: number, flip: number): CubieCube {
		setNPerm(this.ca, cperm, 8);
		this.setTwst(twst);
		setNPermFull(this.ea, eperm, 12);
		this.setFlip(flip);
		return this;
	}

	isEqual(c: CubieCube): boolean {
		for (let i = 0; i < 8; i++) {
			if (this.ca[i] !== c.ca[i]) {
				return false;
			}
		}
		for (let i = 0; i < 12; i++) {
			if (this.ea[i] !== c.ea[i]) {
				return false;
			}
		}
		return true;
	}

	setFlip(idx: number): void {
		let parity = 0;
		for (let i = 10; i >= 0; i--, idx >>= 1) {
			this.ea[i] = this.ea[i] & 0xf | (idx & 1) << 4;
			parity ^= this.ea[i];
		}
		this.ea[11] = this.ea[11] & 0xf | parity & 0x10;
	}

	getFlip(): number {
		let idx = 0;
		for (let i = 0; i < 11; i++) {
			idx = idx << 1 | this.ea[i] >> 4 & 1;
		}
		return idx;
	}

	getFlipSym(): number {
		return FlipR2S[this.getFlip()];
	}

	setTwst(idx: number): void {
		let twst = 15;
		for (let i = 6; i >= 0; i--, idx = ~~(idx / 3)) {
			this.ca[i] = this.ca[i] & 0xf | idx % 3 << 4;
			twst -= this.ca[i] >> 4;
		}
		this.ca[7] = this.ca[7] & 0xf | (twst % 3) << 4;
	}

	getTwst(): number {
		let idx = 0;
		for (let i = 0; i < 7; i++) {
			idx += (idx << 1) + (this.ca[i] >> 4);
		}
		return idx;
	}

	getTwstSym(): number {
		return TwstR2S[this.getTwst()];
	}

	setCPerm(idx: number): void {
		setNPerm(this.ca, idx, 8);
	}

	getCPerm(): number {
		return getNPerm(this.ca, 8);
	}

	getCPermSym(): number {
		return ESym2CSym(EPermR2S[getNPerm(this.ca, 8)]);
	}

	setEPerm(idx: number): void {
		setNPerm(this.ea, idx, 8);
	}

	getEPerm(): number {
		return getNPerm(this.ea, 8);
	}

	getEPermSym(): number {
		return EPermR2S[getNPerm(this.ea, 8)];
	}

	getSlice(): number {
		return 494 - getComb(this.ea, 8);
	}

	setSlice(idx: number): void {
		setComb(this.ea, 494 - idx, 8);
	}

	getMPerm(): number {
		return getNPermFull(this.ea, 12) % 24;
	}

	setMPerm(idx: number): void {
		setNPermFull(this.ea, idx, 12);
	}

	getCComb(): number {
		return getComb(this.ca, 0);
	}

	setCComb(idx: number): void {
		setComb(this.ca, idx, 0);
	}

	URFConjugate(): void {
		const temps = new CubieCube();
		CubieCube.CornMult(CubieCube.urf2, this, temps);
		CubieCube.CornMult(temps, CubieCube.urf1, this);
		CubieCube.EdgeMult(CubieCube.urf2, this, temps);
		CubieCube.EdgeMult(temps, CubieCube.urf1, this);
	}

	toFaceCube(cFacelet?: number[][], eFacelet?: number[][]): string {
		cFacelet = cFacelet || cornerFacelet;
		eFacelet = eFacelet || edgeFacelet;
		const ts = "URFDLB";
		const f: string[] = [];
		for (let i = 0; i < 54; i++) {
			f[i] = ts[~~(i / 9)];
		}
		for (let c = 0; c < 8; c++) {
			const j = this.ca[c] & 0xf;
			const ori = this.ca[c] >> 4;
			for (let n = 0; n < 3; n++)
				f[cFacelet[c][(n + ori) % 3]] = ts[~~(cFacelet[j][n] / 9)];
		}
		for (let e = 0; e < 12; e++) {
			const j = this.ea[e] & 0xf;
			const ori = this.ea[e] >> 4;
			for (let n = 0; n < 2; n++)
				f[eFacelet[e][(n + ori) % 2]] = ts[~~(eFacelet[j][n] / 9)];
		}
		return f.join("");
	}

	invFrom(cc: CubieCube): CubieCube {
		for (let edge = 0; edge < 12; edge++) {
			this.ea[cc.ea[edge] & 0xf] = edge & 0xf | cc.ea[edge] & 0x10;
		}
		for (let corn = 0; corn < 8; corn++) {
			this.ca[cc.ca[corn] & 0xf] = corn | 0x40 >> (cc.ca[corn] >> 4) & 0x30;
		}
		return this;
	}

	fromFacelet(facelet: string, cFacelet?: number[][], eFacelet?: number[][]): number {
		cFacelet = cFacelet || cornerFacelet;
		eFacelet = eFacelet || edgeFacelet;
		let count = 0;
		const f: number[] = [];
		const centers = facelet[4] + facelet[13] + facelet[22] + facelet[31] + facelet[40] + facelet[49];
		for (let i = 0; i < 54; ++i) {
			f[i] = centers.indexOf(facelet[i]);
			if (f[i] === -1) {
				return -1;
			}
			count += 1 << (f[i] << 2);
		}
		if (count !== 0x999999) {
			return -1;
		}
		let col1: number, col2: number, i: number, j: number, ori: number;
		for (i = 0; i < 8; ++i) {
			for (ori = 0; ori < 3; ++ori)
				if (f[cFacelet[i][ori]] === 0 || f[cFacelet[i][ori]] === 3)
					break;
			col1 = f[cFacelet[i][(ori + 1) % 3]];
			col2 = f[cFacelet[i][(ori + 2) % 3]];
			for (j = 0; j < 8; ++j) {
				if (col1 === ~~(cFacelet[j][1] / 9) && col2 === ~~(cFacelet[j][2] / 9)) {
					this.ca[i] = j | ori % 3 << 4;
					break;
				}
			}
		}
		for (i = 0; i < 12; ++i) {
			for (j = 0; j < 12; ++j) {
				if (f[eFacelet[i][0]] === ~~(eFacelet[j][0] / 9) && f[eFacelet[i][1]] === ~~(eFacelet[j][1] / 9)) {
					this.ea[i] = j;
					break;
				}
				if (f[eFacelet[i][0]] === ~~(eFacelet[j][1] / 9) && f[eFacelet[i][1]] === ~~(eFacelet[j][0] / 9)) {
					this.ea[i] = j | 0x10;
					break;
				}
			}
		}
		return 0;
	}
}

function setNPerm(arr: number[], idx: number, n: number): void {
	n--;
	let val = 0x76543210;
	for (let i = 0; i < n; ++i) {
		const p = fact[n - i];
		const v = ~~(idx / p);
		idx %= p;
		const vShift = v << 2;
		arr[i] = arr[i] & 0xf0 | val >> vShift & 0xf;
		const m = (1 << vShift) - 1;
		val = (val & m) + (val >> 4 & ~m);
	}
	arr[n] = arr[n] & 0xf0 | val & 0xf;
}

function getNPerm(arr: number[], n: number): number {
	let idx = 0;
	let val = 0x76543210;
	for (let i = 0; i < n - 1; ++i) {
		const v = (arr[i] & 0xf) << 2;
		idx = (n - i) * idx + (val >> v & 0xf);
		val -= 0x11111110 << v;
	}
	return idx;
}

function setNPermFull(arr: number[], idx: number, n: number): void {
	arr[n - 1] = arr[n - 1] & 0xf0;
	for (let i = n - 2; i >= 0; --i) {
		arr[i] = arr[i] & 0xf0 | idx % (n - i);
		idx = ~~(idx / (n - i));
		for (let j = i + 1; j < n; ++j) {
			if ((arr[j] & 0xf) >= (arr[i] & 0xf)) {
				arr[j] += 1;
			}
		}
	}
}

function getNPermFull(arr: number[], n: number): number {
	let idx = 0;
	for (let i = 0; i < n; ++i) {
		idx *= n - i;
		for (let j = i + 1; j < n; ++j) {
			if ((arr[j] & 0xf) < (arr[i] & 0xf)) {
				++idx;
			}
		}
	}
	return idx;
}

function getComb(arr: number[], mask: number): number {
	const end = arr.length - 1;
	let idxC = 0;
	let r = 4;
	for (let i = end; i >= 0; i--) {
		const perm = arr[i] & 0xf;
		if ((perm & 0xc) === mask) {
			idxC += Cnk[i][r--];
		}
	}
	return idxC;
}

function setComb(arr: number[], idxC: number, mask: number): void {
	const end = arr.length - 1;
	let r = 4;
	let fill = end;
	for (let i = end; i >= 0; i--) {
		if (idxC >= Cnk[i][r]) {
			idxC -= Cnk[i][r--];
			arr[i] = arr[i] & 0xf0 | r | mask;
		} else {
			if ((fill & 0xc) === mask) {
				fill -= 4;
			}
			arr[i] = arr[i] & 0xf0 | fill--;
		}
	}
}

function getNParity(idx: number, n: number): number {
	let p = 0;
	for (let i = n - 2; i >= 0; i--) {
		p ^= idx % (n - i);
		idx = ~~(idx / (n - i));
	}
	return p & 1;
}

const cornerFacelet: number[][] = [
	[8, 9, 20],
	[6, 18, 38],
	[0, 36, 47],
	[2, 45, 11],
	[29, 26, 15],
	[27, 44, 24],
	[33, 53, 42],
	[35, 17, 51]
];
const edgeFacelet: number[][] = [
	[5, 10],
	[7, 19],
	[3, 37],
	[1, 46],
	[32, 16],
	[28, 25],
	[30, 43],
	[34, 52],
	[23, 12],
	[21, 41],
	[50, 39],
	[48, 14]
];

class CoordCube {
	twst: number;
	flip: number;
	slice: number;
	prun: number;
	twstc: number;
	flipc: number;

	constructor() {
		this.twst = 0;
		this.flip = 0;
		this.slice = 0;
		this.prun = 0;
		this.twstc = 0;
		this.flipc = 0;
	}

	set(node: CoordCube): void {
		this.twst = node.twst;
		this.flip = node.flip;
		this.slice = node.slice;
		this.prun = node.prun;
		if (USE_CONJ_PRUN) {
			this.twstc = node.twstc;
			this.flipc = node.flipc;
		}
	}

	calcPruning(_isPhase1: boolean): void {
		this.prun = Math.max(
			getPruningMax(SliceTwstPrunMax, SliceTwstPrun,
				(this.twst >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.twst & 7]),
			getPruningMax(SliceFlipPrunMax, SliceFlipPrun,
				(this.flip >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.flip & 7]),
			USE_CONJ_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
				(this.twstc >> 3) << 11 | FlipS2RF[this.flipc ^ (this.twstc & 7)]) : 0,
			USE_TWST_FLIP_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
				(this.twst >> 3) << 11 | FlipS2RF[this.flip ^ (this.twst & 7)]) : 0
		);
	}

	setWithPrun(cc: CubieCube, depth: number): boolean {
		this.twst = cc.getTwstSym();
		this.flip = cc.getFlipSym();
		this.prun = USE_TWST_FLIP_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
			(this.twst >> 3) << 11 | FlipS2RF[this.flip ^ (this.twst & 7)]) : 0;
		if (this.prun > depth) {
			return false;
		}
		this.slice = cc.getSlice();
		this.prun = Math.max(this.prun,
			getPruningMax(SliceTwstPrunMax, SliceTwstPrun,
				(this.twst >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.twst & 7]),
			getPruningMax(SliceFlipPrunMax, SliceFlipPrun,
				(this.flip >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.flip & 7]));
		if (this.prun > depth) {
			return false;
		}
		if (USE_CONJ_PRUN) {
			const pc = new CubieCube();
			CubieCube.CornConjugate(cc, 1, pc);
			CubieCube.EdgeConjugate(cc, 1, pc);
			this.twstc = pc.getTwstSym();
			this.flipc = pc.getFlipSym();
			this.prun = Math.max(this.prun,
				getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
					(this.twstc >> 3) << 11 | FlipS2RF[this.flipc ^ (this.twstc & 7)]));
		}
		return this.prun <= depth;
	}

	doMovePrun(cc: CoordCube, m: number, _isPhase1: boolean): number {
		this.slice = SliceMove[cc.slice * N_MOVES + m];
		this.flip = FlipMove[(cc.flip >> 3) * N_MOVES + Sym8Move[m << 3 | cc.flip & 7]] ^ (cc.flip & 7);
		this.twst = TwstMove[(cc.twst >> 3) * N_MOVES + Sym8Move[m << 3 | cc.twst & 7]] ^ (cc.twst & 7);
		this.prun = Math.max(
			getPruningMax(SliceTwstPrunMax, SliceTwstPrun,
				(this.twst >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.twst & 7]),
			getPruningMax(SliceFlipPrunMax, SliceFlipPrun,
				(this.flip >> 3) * N_SLICE + SliceConj[this.slice << 3 | this.flip & 7]),
			USE_TWST_FLIP_PRUN ? getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
				(this.twst >> 3) << 11 | FlipS2RF[this.flip ^ (this.twst & 7)]) : 0);
		return this.prun;
	}

	doMovePrunConj(cc: CoordCube, m: number): number {
		const mc = SymMove[3][m];
		this.flipc = FlipMove[(cc.flipc >> 3) * N_MOVES + Sym8Move[mc << 3 | cc.flipc & 7]] ^ (cc.flipc & 7);
		this.twstc = TwstMove[(cc.twstc >> 3) * N_MOVES + Sym8Move[mc << 3 | cc.twstc & 7]] ^ (cc.twstc & 7);
		return getPruningMax(TwstFlipPrunMax, TwstFlipPrun,
			(this.twstc >> 3) << 11 | FlipS2RF[this.flipc ^ (this.twstc & 7)]);
	}
}

export class Search {
	move: number[];
	moveSol: number[] | null;
	moveSolStr: string | null;
	nodeUD: CoordCube[];
	valid1: number;
	allowShorter: boolean;
	cc: CubieCube;
	urfCubieCube: CubieCube[];
	urfCoordCube: CoordCube[];
	phase1Cubie: CubieCube[];
	preMoveCubes: CubieCube[];
	preMoves: number[];
	preMoveLen: number;
	maxPreMoves: number;
	isRec: boolean;

	sol: number;
	probe: number;
	probeMax: number;
	probeMin: number;
	verbose: number;
	conjMask: number;
	depth1: number;
	length1: number;
	urfIdx: number;
	firstFilter: number;
	lastFilter: number;
	firstFilters: number[];
	lastFilters: number[];

	constructor() {
		this.move = [];
		this.moveSol = [];
		this.moveSolStr = null;
		this.nodeUD = [];
		this.valid1 = 0;
		this.allowShorter = false;
		this.cc = new CubieCube();
		this.urfCubieCube = [];
		this.urfCoordCube = [];
		this.phase1Cubie = [];
		this.preMoveCubes = [];
		this.preMoves = [];
		this.preMoveLen = 0;
		this.maxPreMoves = 0;
		this.isRec = false;

		this.sol = 0;
		this.probe = 0;
		this.probeMax = 0;
		this.probeMin = 0;
		this.verbose = 0;
		this.conjMask = 0;
		this.depth1 = 0;
		this.length1 = 0;
		this.urfIdx = 0;
		this.firstFilter = 0;
		this.lastFilter = 0;
		this.firstFilters = [];
		this.lastFilters = [];

		for (let i = 0; i < 21; i++) {
			this.nodeUD[i] = new CoordCube();
			this.phase1Cubie[i] = new CubieCube();
		}
		for (let i = 0; i < 6; i++) {
			this.urfCubieCube[i] = new CubieCube();
			this.urfCoordCube[i] = new CoordCube();
		}
		for (let i = 0; i < MAX_PRE_MOVES; i++) {
			this.preMoveCubes[i + 1] = new CubieCube();
		}
	}

	solution(
		facelets: string,
		maxDepth?: number,
		probeMax?: number,
		probeMin?: number,
		verbose?: number,
		firstAxisFilter?: number,
		lastAxisFilter?: number
	): string {
		initPrunTables();
		const check = this.verify(facelets);
		if (check !== 0) {
			return "Error " + Math.abs(check);
		}
		if (maxDepth === undefined) {
			maxDepth = 21;
		}
		if (probeMax === undefined) {
			probeMax = 1e9;
		}
		if (probeMin === undefined) {
			probeMin = 0;
		}
		if (verbose === undefined) {
			verbose = 0;
		}
		this.sol = maxDepth + 1;
		this.probe = 0;
		this.probeMax = probeMax;
		this.probeMin = Math.min(probeMin, probeMax);
		this.verbose = verbose;
		this.moveSol = null;
		this.moveSolStr = null;
		this.isRec = false;
		this.firstFilters = [0, 0, 0, 0, 0, 0];
		this.lastFilters = [0, 0, 0, 0, 0, 0];
		for (let i = 0; i < 3; i++) {
			if (firstAxisFilter !== undefined) {
				this.firstFilters[i] |= 0xe07 << (~~(urfMove[(3 - i) % 3][firstAxisFilter * 3] / 3)) * 3;
				this.lastFilters[i + 3] |= 0xe07 << (~~(urfMove[(3 - i) % 3][firstAxisFilter * 3] / 3)) * 3;
			}
			if (lastAxisFilter !== undefined) {
				this.lastFilters[i] |= 0xe07 << (~~(urfMove[(3 - i) % 3][lastAxisFilter * 3] / 3)) * 3;
				this.firstFilters[i + 3] |= 0xe07 << (~~(urfMove[(3 - i) % 3][lastAxisFilter * 3] / 3)) * 3;
			}
		}
		this.initSearch();
		return this.search();
	}

	initSearch(): void {
		this.conjMask = (TRY_INVERSE ? 0 : 0x38) | (TRY_THREE_AXES ? 0 : 0x36);
		this.maxPreMoves = this.conjMask > 7 ? 0 : MAX_PRE_MOVES;

		for (let i = 0; i < 6; i++) {
			this.urfCubieCube[i].init(this.cc.ca, this.cc.ea);
			this.urfCoordCube[i].setWithPrun(this.urfCubieCube[i], 20);
			this.cc.URFConjugate();
			if (i % 3 === 2) {
				const tmp = new CubieCube().invFrom(this.cc);
				this.cc.init(tmp.ca, tmp.ea);
			}
		}
	}

	next(probeMax: number, probeMin: number, verbose: number): string {
		this.probe = 0;
		this.probeMax = probeMax;
		this.probeMin = Math.min(probeMin, probeMax);
		this.moveSol = null;
		this.moveSolStr = null;
		this.isRec = true;
		this.verbose = verbose;
		return this.search();
	}

	verify(facelets: string): number {
		if (this.cc.fromFacelet(facelets) === -1) {
			return -1;
		}
		let sum = 0;
		let edgeMask = 0;
		for (let e = 0; e < 12; e++) {
			edgeMask |= 1 << (this.cc.ea[e] & 0xf);
			sum ^= this.cc.ea[e] >> 4;
		}
		if (edgeMask !== 0xfff) {
			return -2; // missing edges
		}
		if (sum !== 0) {
			return -3;
		}
		let cornMask = 0;
		sum = 0;
		for (let c = 0; c < 8; c++) {
			cornMask |= 1 << (this.cc.ca[c] & 0xf);
			sum += this.cc.ca[c] >> 4;
		}
		if (cornMask !== 0xff) {
			return -4; // missing corners
		}
		if (sum % 3 !== 0) {
			return -5; // twisted corner
		}
		if ((getNParity(getNPermFull(this.cc.ea, 12), 12) ^ getNParity(this.cc.getCPerm(), 8)) !== 0) {
			return -6; // parity error
		}
		return 0; // cube ok
	}

	phase1PreMoves(maxl: number, lm: number, cc: CubieCube): number {
		if (maxl === this.maxPreMoves - 1 && (this.lastFilter >> lm & 1) !== 0) {
			return 1;
		}
		this.preMoveLen = this.maxPreMoves - maxl;
		if (this.isRec ? (this.depth1 === this.length1 - this.preMoveLen) :
			(this.preMoveLen === 0 || (0x36FB7 >> lm & 1) === 0)) {
			this.depth1 = this.length1 - this.preMoveLen;
			this.phase1Cubie[0].init(cc.ca, cc.ea);
			this.allowShorter = this.depth1 === MIN_P1LENGTH_PRE && this.preMoveLen !== 0;

			if (this.nodeUD[this.depth1 + 1].setWithPrun(cc, this.depth1) &&
				this.phase1(this.nodeUD[this.depth1 + 1], this.depth1, -1) === 0) {
				return 0;
			}
		}

		if (maxl === 0 || this.preMoveLen + MIN_P1LENGTH_PRE >= this.length1) {
			return 1;
		}

		let skipMoves = 0;
		if (maxl === 1 || this.preMoveLen + 1 + MIN_P1LENGTH_PRE >= this.length1) { //last pre move
			skipMoves |= 0x36FB7; // 11 0110 1111 1011 0111
		}

		lm = ~~(lm / 3) * 3;
		for (let m = 0; m < 18; m++) {
			if (m === lm || m === lm - 9 || m === lm + 9) {
				m += 2;
				continue;
			}
			if (this.isRec && m !== this.preMoves[this.maxPreMoves - maxl] || (skipMoves & 1 << m) !== 0) {
				continue;
			}
			CubieCube.CornMult(moveCube[m], cc, this.preMoveCubes[maxl]);
			CubieCube.EdgeMult(moveCube[m], cc, this.preMoveCubes[maxl]);
			this.preMoves[this.maxPreMoves - maxl] = m;
			const ret = this.phase1PreMoves(maxl - 1, m, this.preMoveCubes[maxl]);
			if (ret === 0) {
				return 0;
			}
		}
		return 1;
	}

	search(): string {
		for (this.length1 = this.isRec ? this.length1 : 0; this.length1 < this.sol; this.length1++) {
			for (this.urfIdx = this.isRec ? this.urfIdx : 0; this.urfIdx < 6; this.urfIdx++) {
				if ((this.conjMask & 1 << this.urfIdx) !== 0) {
					continue;
				}
				this.firstFilter = this.firstFilters[this.urfIdx];
				this.lastFilter = this.lastFilters[this.urfIdx];
				if (this.phase1PreMoves(this.maxPreMoves, -30, this.urfCubieCube[this.urfIdx]) === 0) {
					return this.moveSolStr === null ? "Error 8" : this.moveSolStr;
				}
			}
		}
		return this.moveSolStr === null ? "Error 7" : this.moveSolStr;
	}

	initPhase2Pre(): number {
		this.isRec = false;
		if (this.probe >= (this.moveSolStr === null ? this.probeMax : this.probeMin)) {
			return 0;
		}
		++this.probe;

		for (let i = this.valid1; i < this.depth1; i++) {
			CubieCube.CornMult(this.phase1Cubie[i], moveCube[this.move[i]], this.phase1Cubie[i + 1]);
			CubieCube.EdgeMult(this.phase1Cubie[i], moveCube[this.move[i]], this.phase1Cubie[i + 1]);
		}
		this.valid1 = this.depth1;

		const ret = this.initPhase2(this.phase1Cubie[this.depth1]);
		if (ret === 0 || this.preMoveLen === 0 || ret === 2) {
			return ret;
		}

		const m = ~~(this.preMoves[this.preMoveLen - 1] / 3) * 3 + 1;
		CubieCube.CornMult(moveCube[m], this.phase1Cubie[this.depth1], this.phase1Cubie[this.depth1 + 1]);
		CubieCube.EdgeMult(moveCube[m], this.phase1Cubie[this.depth1], this.phase1Cubie[this.depth1 + 1]);

		this.preMoves[this.preMoveLen - 1] += 2 - this.preMoves[this.preMoveLen - 1] % 3 * 2;
		const ret2 = this.initPhase2(this.phase1Cubie[this.depth1 + 1]);
		this.preMoves[this.preMoveLen - 1] += 2 - this.preMoves[this.preMoveLen - 1] % 3 * 2;
		return ret2;
	}

	initPhase2(phase2Cubie: CubieCube): number {
		let p2corn = phase2Cubie.getCPermSym();
		const p2csym = p2corn & 0xf;
		p2corn >>= 4;
		let p2edge = phase2Cubie.getEPermSym();
		const p2esym = p2edge & 0xf;
		p2edge >>= 4;
		const p2mid = phase2Cubie.getMPerm();
		const prun = Math.max(
			getPruningMax(EPermCCombPPrunMax, EPermCCombPPrun,
				p2edge * N_COMB + CCombPConj[(Perm2CombP[p2corn] & 0xff) << 4 | SymMultInv[p2esym][p2csym]]),
			getPruningMax(MCPermPrunMax, MCPermPrun,
				p2corn * N_MPERM + MPermConj[p2mid << 4 | p2csym]));
		const maxDep2 = Math.min(MAX_DEPTH2, this.sol - this.length1);
		if (prun >= maxDep2) {
			return prun > maxDep2 ? 2 : 1;
		}
		let depth2: number;
		for (depth2 = maxDep2 - 1; depth2 >= prun; depth2--) {
			const ret = this.phase2(p2edge, p2esym, p2corn, p2csym, p2mid, depth2, this.depth1, 10);
			if (ret < 0) {
				break;
			}
			depth2 -= ret;
			this.moveSol = [];
			for (let i = 0; i < this.depth1 + depth2; i++) {
				this.appendSolMove(this.move[i]);
			}
			for (let i = this.preMoveLen - 1; i >= 0; i--) {
				this.appendSolMove(this.preMoves[i]);
			}
			this.sol = this.moveSol!.length;
			this.moveSolStr = this.solutionToString();
		}
		if (depth2 !== maxDep2 - 1) { //At least one solution has been found.
			return this.probe >= this.probeMin ? 0 : 1;
		} else {
			return 1;
		}
	}

	phase1(node: CoordCube, maxl: number, lm: number): number {
		if (maxl === this.depth1 - 1 && (this.firstFilter >> lm & 1) !== 0) {
			return 1;
		}
		if (node.prun === 0 && maxl < 5) {
			if (this.allowShorter || maxl === 0) {
				this.depth1 -= maxl;
				const ret = this.initPhase2Pre();
				this.depth1 += maxl;
				return ret;
			} else {
				return 1;
			}
		}
		for (let axis = 0; axis < 18; axis += 3) {
			if (axis === lm || axis === lm - 9) {
				continue;
			}
			for (let power = 0; power < 3; power++) {
				const m = axis + power;

				if (this.isRec && m !== this.move[this.depth1 - maxl]) {
					continue;
				}

				let prun = this.nodeUD[maxl].doMovePrun(node, m, true);
				if (prun > maxl) {
					break;
				} else if (prun === maxl) {
					continue;
				}

				if (USE_CONJ_PRUN) {
					prun = this.nodeUD[maxl].doMovePrunConj(node, m);
					if (prun > maxl) {
						break;
					} else if (prun === maxl) {
						continue;
					}
				}
				this.move[this.depth1 - maxl] = m;
				this.valid1 = Math.min(this.valid1, this.depth1 - maxl);
				const ret = this.phase1(this.nodeUD[maxl], maxl - 1, axis);
				if (ret === 0) {
					return 0;
				} else if (ret === 2) {
					break;
				}
			}
		}
		return 1;
	}

	appendSolMove(curMove: number): void {
		if (this.moveSol!.length === 0) {
			this.moveSol!.push(curMove);
			return;
		}
		const axisCur = ~~(curMove / 3);
		const axisLast = ~~(this.moveSol!.at(-1)! / 3);
		if (axisCur === axisLast) {
			const pow = (curMove % 3 + this.moveSol!.at(-1)! % 3 + 1) % 4;
			if (pow === 3) {
				this.moveSol!.pop();
			} else {
				this.moveSol!.splice(-1, 1, axisCur * 3 + pow);
			}
			return;
		}
		if (this.moveSol!.length > 1 &&
			axisCur % 3 === axisLast % 3 &&
			axisCur === ~~(this.moveSol!.at(-2)! / 3)) {
			const pow = (curMove % 3 + this.moveSol!.at(-2)! % 3 + 1) % 4;
			if (pow === 3) {
				this.moveSol!.splice(-2, 1, this.moveSol!.at(-1)!);
				this.moveSol!.pop();
			} else {
				this.moveSol!.splice(-2, 1, axisCur * 3 + pow);
			}
			return;
		}
		this.moveSol!.push(curMove);
	}

	phase2(edge: number, esym: number, corn: number, csym: number, mid: number, maxl: number, depth: number, lm: number): number {
		if (this.depth1 === 0 && depth === 1 && (this.firstFilter >> ud2std[lm] & 1) !== 0) {
			return -1;
		}
		if (edge === 0 && corn === 0 && mid === 0 && (this.preMoveLen > 0 || (this.lastFilter >> ud2std[lm] & 1) === 0)) {
			return maxl;
		}
		const moveMask = ckmv2bit[lm];
		for (let m = 0; m < 10; m++) {
			if ((moveMask >> m & 1) !== 0) {
				m += 0x42 >> m & 3;
				continue;
			}
			const midx = MPermMove[mid * N_MOVES2 + m];
			let cornx = CPermMove[corn * N_MOVES2 + SymMoveUD[csym][m]];
			const csymx = SymMult[cornx & 0xf][csym];
			cornx >>= 4;
			if (getPruningMax(MCPermPrunMax, MCPermPrun,
					cornx * N_MPERM + MPermConj[midx << 4 | csymx]) >= maxl) {
				continue;
			}
			let edgex = EPermMove[edge * N_MOVES2 + SymMoveUD[esym][m]];
			const esymx = SymMult[edgex & 0xf][esym];
			edgex >>= 4;
			if (getPruningMax(EPermCCombPPrunMax, EPermCCombPPrun,
					edgex * N_COMB + CCombPConj[(Perm2CombP[cornx] & 0xff) << 4 | SymMultInv[esymx][csymx]]) >= maxl) {
				continue;
			}
			const edgei = getPermSymInv(edgex, esymx, false);
			const corni = getPermSymInv(cornx, csymx, true);
			if (getPruningMax(EPermCCombPPrunMax, EPermCCombPPrun,
					(edgei >> 4) * N_COMB + CCombPConj[(Perm2CombP[corni >> 4] & 0xff) << 4 | SymMultInv[edgei & 0xf][corni & 0xf]]) >= maxl) {
				continue;
			}

			const ret = this.phase2(edgex, esymx, cornx, csymx, midx, maxl - 1, depth + 1, m);
			if (ret >= 0) {
				this.move[depth] = ud2std[m];
				return ret;
			}
		}
		return -1;
	}

	solutionToString(): string {
		let sb = '';
		const urf = (this.verbose & INVERSE_SOLUTION) !== 0 ? (this.urfIdx + 3) % 6 : this.urfIdx;
		if (urf < 3) {
			for (let s = 0; s < this.moveSol!.length; ++s) {
				sb += move2str[urfMove[urf][(this.moveSol as number[])[s]]] + ' ';
			}
		} else {
			for (let s = this.moveSol!.length - 1; s >= 0; --s) {
				sb += move2str[urfMove[urf][(this.moveSol as number[])[s]]] + ' ';
			}
		}
		return sb;
	}
}

// --- Module-level tables ---
const moveCube: CubieCube[] = [];
const SymCube: CubieCube[] = [];
const SymMult: number[][] = [];
const SymMultInv: number[][] = [];
const SymMove: number[][] = [];
const SymMoveUD: number[][] = [];
const Sym8Move: number[] = [];
const FlipS2R: number[] = [];
const FlipR2S: number[] = [];
const FlipSelfSym: number[] = [];
const FlipS2RF: number[] = [];
const TwstS2R: number[] = [];
const TwstR2S: number[] = [];
const TwstSelfSym: number[] = [];
const EPermS2R: number[] = [];
const EPermR2S: number[] = [];
const PermSelfSym: number[] = [];
const Perm2CombP: number[] = [];
const PermInvEdgeSym: number[] = [];
const TwstMove: number[] = [];
const FlipMove: number[] = [];
const SliceMove: number[] = [];
const SliceConj: number[] = [];
const SliceTwstPrun: number[] = [];
const SliceFlipPrun: number[] = [];
const TwstFlipPrun: number[] = [];

// phase2
const CPermMove: number[] = [];
const EPermMove: number[] = [];
const MPermMove: number[] = [];
const MPermConj: number[] = [];
const CCombPMove: number[] = [];
const CCombPConj: number[] = [];
const MCPermPrun: number[] = [];
const EPermCCombPPrun: number[] = [];

let TwstFlipPrunMax = 15;
let SliceTwstPrunMax = 15;
let SliceFlipPrunMax = 15;
let MCPermPrunMax = 15;
let EPermCCombPPrunMax = 15;

// init move cubes
{
	for (let i = 0; i < 18; i++) {
		moveCube[i] = new CubieCube();
	}
	moveCube[0].initCoord(15120, 0, 119750400, 0);
	moveCube[3].initCoord(21021, 1494, 323403417, 0);
	moveCube[6].initCoord(8064, 1236, 29441808, 550);
	moveCube[9].initCoord(9, 0, 5880, 0);
	moveCube[12].initCoord(1230, 412, 2949660, 0);
	moveCube[15].initCoord(224, 137, 328552, 137);
	for (let a = 0; a < 18; a += 3) {
		for (let p = 0; p < 2; p++) {
			CubieCube.EdgeMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1]);
			CubieCube.CornMult(moveCube[a + p], moveCube[a], moveCube[a + p + 1]);
		}
	}
	CubieCube.urf1 = new CubieCube().initCoord(2531, 1373, 67026819, 1367);
	CubieCube.urf2 = new CubieCube().initCoord(2089, 1906, 322752913, 2040);
}

function initBasic(): void {
	// init sym cubes
	let c = new CubieCube();
	let d = new CubieCube();

	const f2 = new CubieCube().initCoord(28783, 0, 259268407, 0);
	const u4 = new CubieCube().initCoord(15138, 0, 119765538, 7);
	const lr2 = new CubieCube().initCoord(5167, 0, 83473207, 0);
	for (let i = 0; i < 8; i++) {
		lr2.ca[i] |= 3 << 4;
	}
	for (let i = 0; i < 16; i++) {
		SymCube[i] = new CubieCube().init(c.ca, c.ea);
		CubieCube.CornMultFull(c, u4, d);
		CubieCube.EdgeMult(c, u4, d);
		c.init(d.ca, d.ea);
		if (i % 4 === 3) {
			CubieCube.CornMultFull(c, lr2, d);
			CubieCube.EdgeMult(c, lr2, d);
			c.init(d.ca, d.ea);
		}
		if (i % 8 === 7) {
			CubieCube.CornMultFull(c, f2, d);
			CubieCube.EdgeMult(c, f2, d);
			c.init(d.ca, d.ea);
		}
	}

	// gen sym tables
	for (let i = 0; i < 16; i++) {
		SymMult[i] = [];
		SymMultInv[i] = [];
		SymMove[i] = [];
		SymMoveUD[i] = [];
	}
	for (let i = 0; i < 16; i++) {
		for (let j = 0; j < 16; j++) {
			SymMult[i][j] = i ^ j ^ (0x14ab4 >> j & i << 1 & 2);
			SymMultInv[SymMult[i][j]][j] = i;
		}
	}

	c = new CubieCube();
	for (let s = 0; s < 16; s++) {
		for (let j = 0; j < 18; j++) {
			CubieCube.CornConjugate(moveCube[j], SymMultInv[0][s], c);
			outloop: for (let m = 0; m < 18; m++) {
				for (let k = 0; k < 8; k++) {
					if (moveCube[m].ca[k] !== c.ca[k]) {
						continue outloop;
					}
				}
				SymMove[s][j] = m;
				SymMoveUD[s][std2ud[j]] = std2ud[m];
				break;
			}
			if (s % 2 === 0) {
				Sym8Move[j << 3 | s >> 1] = SymMove[s][j];
			}
		}
	}

	// init sym 2 raw tables
	function initSym2Raw(
		N_RAW: number,
		Sym2Raw: number[],
		Raw2Sym: number[],
		SelfSym: number[],
		coord: number,
		setFunc: (this: CubieCube, idx: number) => void,
		getFunc: (this: CubieCube) => number
	): number {
		const c2 = new CubieCube();
		const d2 = new CubieCube();
		let count = 0;
		const sym_inc = coord >= 2 ? 1 : 2;
		const conjFunc = coord !== 1 ? CubieCube.EdgeConjugate : CubieCube.CornConjugate;

		for (let i = 0; i < N_RAW; i++) {
			if (Raw2Sym[i] !== undefined) {
				continue;
			}
			setFunc.call(c2, i);
			SelfSym[count] = 0;
			for (let s = 0; s < 16; s += sym_inc) {
				conjFunc(c2, s, d2);
				const idx = getFunc.call(d2);
				if (USE_TWST_FLIP_PRUN && coord === 0) {
					FlipS2RF[count << 3 | s >> 1] = idx;
				}
				if (idx === i) {
					SelfSym[count] |= 1 << (s / sym_inc);
				}
				Raw2Sym[idx] = (count << 4 | s) / sym_inc;
			}
			Sym2Raw[count++] = i;
		}
		return count;
	}

	initSym2Raw(N_FLIP, FlipS2R, FlipR2S, FlipSelfSym, 0, CubieCube.prototype.setFlip, CubieCube.prototype.getFlip);
	initSym2Raw(N_TWST, TwstS2R, TwstR2S, TwstSelfSym, 1, CubieCube.prototype.setTwst, CubieCube.prototype.getTwst);
	initSym2Raw(N_PERM, EPermS2R, EPermR2S, PermSelfSym, 2, CubieCube.prototype.setEPerm, CubieCube.prototype.getEPerm);

	const cc = new CubieCube();
	for (let i = 0; i < N_PERM_SYM; i++) {
		setNPerm(cc.ea, EPermS2R[i], 8);
		Perm2CombP[i] = getComb(cc.ea, 0) + getNParity(EPermS2R[i], 8) * 70;
		c.invFrom(cc);
		PermInvEdgeSym[i] = EPermR2S[c.getEPerm()];
	}

	// init coord tables
	c = new CubieCube();
	d = new CubieCube();
	function initSymMoveTable(
		moveTable: number[],
		SymS2R: number[],
		N_SIZE: number,
		nMoves: number,
		setFunc: (this: CubieCube, idx: number) => void,
		getFunc: (this: CubieCube) => number,
		multFunc: (a: CubieCube, b: CubieCube, prod: CubieCube) => void,
		ud2stdMap?: number[]
	): void {
		for (let i = 0; i < N_SIZE; i++) {
			setFunc.call(c, SymS2R[i]);
			for (let j = 0; j < nMoves; j++) {
				multFunc(c, moveCube[ud2stdMap ? ud2stdMap[j] : j], d);
				moveTable[i * nMoves + j] = getFunc.call(d);
			}
		}
	}

	initSymMoveTable(FlipMove, FlipS2R, N_FLIP_SYM, N_MOVES,
		CubieCube.prototype.setFlip, CubieCube.prototype.getFlipSym, CubieCube.EdgeMult);
	initSymMoveTable(TwstMove, TwstS2R, N_TWST_SYM, N_MOVES,
		CubieCube.prototype.setTwst, CubieCube.prototype.getTwstSym, CubieCube.CornMult);
	initSymMoveTable(EPermMove, EPermS2R, N_PERM_SYM, N_MOVES2,
		CubieCube.prototype.setEPerm, CubieCube.prototype.getEPermSym, CubieCube.EdgeMult, ud2std);
	initSymMoveTable(CPermMove, EPermS2R, N_PERM_SYM, N_MOVES2,
		CubieCube.prototype.setCPerm, CubieCube.prototype.getCPermSym, CubieCube.CornMult, ud2std);

	for (let i = 0; i < N_SLICE; i++) {
		c.setSlice(i);
		for (let j = 0; j < N_MOVES; j++) {
			CubieCube.EdgeMult(c, moveCube[j], d);
			SliceMove[i * N_MOVES + j] = d.getSlice();
		}
		for (let j = 0; j < 16; j += 2) {
			CubieCube.EdgeConjugate(c, SymMultInv[0][j], d);
			SliceConj[i << 3 | j >> 1] = d.getSlice();
		}
	}

	for (let i = 0; i < N_MPERM; i++) {
		c.setMPerm(i);
		for (let j = 0; j < N_MOVES2; j++) {
			CubieCube.EdgeMult(c, moveCube[ud2std[j]], d);
			MPermMove[i * N_MOVES2 + j] = d.getMPerm();
		}
		for (let j = 0; j < 16; j++) {
			CubieCube.EdgeConjugate(c, SymMultInv[0][j], d);
			MPermConj[i << 4 | j] = d.getMPerm();
		}
	}

	for (let i = 0; i < N_COMB; i++) {
		c.setCComb(i % 70);
		for (let j = 0; j < N_MOVES2; j++) {
			CubieCube.CornMult(c, moveCube[ud2std[j]], d);
			CCombPMove[i * N_MOVES2 + j] = d.getCComb() + 70 * ((0xA5 >> j & 1) ^ ~~(i / 70));
		}
		for (let j = 0; j < 16; j++) {
			CubieCube.CornConjugate(c, SymMultInv[0][j], d);
			CCombPConj[i << 4 | j] = d.getCComb() + 70 * ~~(i / 70);
		}
	}
}

// init pruning tables
let InitPrunProgress = -1;

function initRawSymPrun(
	PrunTable: number[],
	N_RAW: number,
	N_SYM: number,
	RawMove: number[] | null,
	RawConj: number[] | null,
	SymMoveTable: number[],
	SelfSym: number[],
	PrunFlag: number
): number {
	const SYM_SHIFT = PrunFlag & 0xf;
	const SYM_E2C_MAGIC_LOCAL = ((PrunFlag >> 4) & 1) === 1 ? 0x00DDDD00 : 0x00000000;
	const IS_PHASE2 = ((PrunFlag >> 5) & 1) === 1;
	const INV_DEPTH = PrunFlag >> 8 & 0xf;
	const MAX_DEPTH = PrunFlag >> 12 & 0xf;
	const MIN_DEPTH = PrunFlag >> 16 & 0xf;

	const SYM_MASK = (1 << SYM_SHIFT) - 1;
	const ISTFP = RawMove === null;
	const N_SIZE = N_RAW * N_SYM;
	const N_MOVES_LOCAL = IS_PHASE2 ? 10 : 18;
	const NEXT_AXIS_MAGIC = N_MOVES_LOCAL === 10 ? 0x42 : 0x92492;

	let depth = getPruning(PrunTable, N_SIZE) - 1;

	if (depth === -1) {
		for (let i = 0; i < (N_SIZE >> 3) + 1; i++) {
			PrunTable[i] = -1;
		}
		setPruning(PrunTable, 0, 0 ^ 0xf);
		depth = 0;
	} else {
		setPruning(PrunTable, N_SIZE, 0xf ^ (depth + 1));
	}

	const SEARCH_DEPTH = PARTIAL_INIT_LEVEL > 0 ?
		Math.min(Math.max(depth + 1, MIN_DEPTH), MAX_DEPTH) : MAX_DEPTH;

	while (depth < SEARCH_DEPTH) {
		const inv = depth > INV_DEPTH;
		const select = inv ? 0xf : depth;
		const selArrMask = select * 0x11111111;
		const check = inv ? depth : 0xf;
		depth++;
		InitPrunProgress++;
		const xorVal = depth ^ 0xf;
		let done = 0;
		let val = 0;
		for (let i = 0; i < N_SIZE; i++, val >>= 4) {
			if ((i & 7) === 0) {
				val = PrunTable[i >> 3];
				if (!hasZero(val ^ selArrMask)) {
					i += 7;
					continue;
				}
			}
			if ((val & 0xf) !== select) {
				continue;
			}
			const raw = i % N_RAW;
			const sym = ~~(i / N_RAW);
			let flip = 0;
			let fsym = 0;
			if (ISTFP) {
				flip = FlipR2S[raw];
				fsym = flip & 7;
				flip >>= 3;
			}

			for (let m = 0; m < N_MOVES_LOCAL; m++) {
				let symx = SymMoveTable[sym * N_MOVES_LOCAL + m];
				let rawx: number;
				if (ISTFP) {
					rawx = FlipS2RF[
						FlipMove[flip * N_MOVES_LOCAL + Sym8Move[m << 3 | fsym]] ^
						fsym ^ (symx & SYM_MASK)];
				} else {
					rawx = RawConj![RawMove![raw * N_MOVES_LOCAL + m] << SYM_SHIFT | symx & SYM_MASK];
				}
				symx >>= SYM_SHIFT;
				const idx = symx * N_RAW + rawx;
				const prun = getPruning(PrunTable, idx);
				if (prun !== check) {
					if (prun < depth - 1) {
						m += NEXT_AXIS_MAGIC >> m & 3;
					}
					continue;
				}
				done++;
				if (inv) {
					setPruning(PrunTable, i, xorVal);
					break;
				}
				setPruning(PrunTable, idx, xorVal);
				for (let j = 1, selfSym = SelfSym[symx];
						(selfSym >>= 1) !== 0; j++) {
					if ((selfSym & 1) !== 1) {
						continue;
					}
					let idxx = symx * N_RAW;
					if (ISTFP) {
						idxx += FlipS2RF[FlipR2S[rawx] ^ j];
					} else {
						idxx += RawConj![rawx << SYM_SHIFT | (j ^ (SYM_E2C_MAGIC_LOCAL >> (j << 1) & 3))];
					}
					if (getPruning(PrunTable, idxx) === check) {
						setPruning(PrunTable, idxx, xorVal);
						done++;
					}
				}
			}
		}
	}
	setPruning(PrunTable, N_SIZE, (depth + 1) ^ 0xf);
	return depth + 1;
}

function doInitPrunTables(targetProgress: number): void {
	if (USE_TWST_FLIP_PRUN) {
		TwstFlipPrunMax = initRawSymPrun(
			TwstFlipPrun, N_FLIP, N_TWST_SYM,
			null, null,
			TwstMove, TwstSelfSym, 0x19603
		);
	}
	if (InitPrunProgress > targetProgress) {
		return;
	}
	SliceTwstPrunMax = initRawSymPrun(
		SliceTwstPrun, N_SLICE, N_TWST_SYM,
		SliceMove, SliceConj,
		TwstMove, TwstSelfSym, 0x69603
	);
	if (InitPrunProgress > targetProgress) {
		return;
	}
	SliceFlipPrunMax = initRawSymPrun(
		SliceFlipPrun, N_SLICE, N_FLIP_SYM,
		SliceMove, SliceConj,
		FlipMove, FlipSelfSym, 0x69603
	);
	if (InitPrunProgress > targetProgress) {
		return;
	}
	MCPermPrunMax = initRawSymPrun(
		MCPermPrun, 24, N_PERM_SYM,
		MPermMove, MPermConj,
		CPermMove, PermSelfSym, 0x8ea34
	);
	if (InitPrunProgress > targetProgress) {
		return;
	}
	EPermCCombPPrunMax = initRawSymPrun(
		EPermCCombPPrun, N_COMB, N_PERM_SYM,
		CCombPMove, CCombPConj,
		EPermMove, PermSelfSym, 0x7d824
	);
}

function initPrunTables(): boolean {
	if (InitPrunProgress < 0) {
		initBasic();
		InitPrunProgress = 0;
	}
	if (InitPrunProgress === 0) {
		doInitPrunTables(99);
	} else if (InitPrunProgress < 54) {
		doInitPrunTables(InitPrunProgress);
	} else {
		return true;
	}
	return false;
}

export function randomCube(): string {
	let ep: number, cp: number;
	const eo = ~~(Math.random() * 2048);
	const co = ~~(Math.random() * 2187);
	do {
		ep = ~~(Math.random() * fact[12]);
		cp = ~~(Math.random() * fact[8]);
	} while (getNParity(cp, 8) !== getNParity(ep, 12));
	const cc = new CubieCube().initCoord(cp, co, ep, eo);
	return cc.toFaceCube();
}

export function fromScramble(s: string): string {
	let axis = -1;
	const c1 = new CubieCube();
	const c2 = new CubieCube();
	for (let i = 0; i < s.length; i++) {
		switch (s[i]) {
			case 'U':
			case 'R':
			case 'F':
			case 'D':
			case 'L':
			case 'B':
				axis = "URFDLB".indexOf(s[i]) * 3;
				break;
			case ' ':
				if (axis !== -1) {
					CubieCube.CornMult(c1, moveCube[axis], c2);
					CubieCube.EdgeMult(c1, moveCube[axis], c2);
					c1.init(c2.ca, c2.ea);
				}
				axis = -1;
				break;
			case '2':
				axis++;
				break;
			case '\'':
				axis += 2;
				break;
			default:
				continue;
		}
	}
	if (axis !== -1) {
		CubieCube.CornMult(c1, moveCube[axis], c2);
		CubieCube.EdgeMult(c1, moveCube[axis], c2);
		c1.init(c2.ca, c2.ea);
	}
	return c2.toFaceCube();
}

export function solve(facelet: string): string {
	return new Search().solution(facelet);
}

export function initFull(): void {
	PARTIAL_INIT_LEVEL = 0;
	initPrunTables();
}
