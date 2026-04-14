/**
 * mathlib.ts — Full port of cstimer's mathlib.js
 * Core math utilities for all scramble solvers: coordinate encoding,
 * IDA* search, pruning tables, CubieCube representation, random utilities.
 *
 * Ported from cstimer (GPLv3) — https://github.com/cs0x7f/cstimer
 */

// ==================== Binomial Coefficients & Factorials ====================

export const Cnk: number[][] = [];
export const fact: number[] = [1];

for (let i = 0; i < 32; ++i) {
	Cnk[i] = [];
	for (let j = 0; j < 32; ++j) {
		Cnk[i][j] = 0;
	}
}
for (let i = 0; i < 32; ++i) {
	Cnk[i][0] = Cnk[i][i] = 1;
	fact[i + 1] = fact[i] * (i + 1);
	for (let j = 1; j < i; ++j) {
		Cnk[i][j] = Cnk[i - 1][j - 1] + Cnk[i - 1][j];
	}
}

// ==================== Permutation Multiplication Table (4-element) ====================

export const permMul4: number[][] = [];
(() => {
	for (let i = 0; i < 24; i++) {
		const perm1: number[] = [];
		const perm2: number[] = [];
		const perm3: number[] = [];
		permMul4[i] = [];
		setNPerm(perm1, i, 4);
		for (let j = 0; j < 24; j++) {
			setNPerm(perm2, j, 4);
			for (let k = 0; k < 4; k++) {
				perm3[k] = perm1[perm2[k]];
			}
			permMul4[i][j] = getNPerm(perm3, 4);
		}
	}
})();

// ==================== Basic Array Operations ====================

export function circleOri(arr: number[], a: number, b: number, c: number, d: number, ori: number): void {
	const temp = arr[a];
	arr[a] = arr[d] ^ ori;
	arr[d] = arr[c] ^ ori;
	arr[c] = arr[b] ^ ori;
	arr[b] = temp ^ ori;
}

/**
 * Cyclic rotation of elements: arr[args[0]] <- arr[args[last]], arr[args[1]] <- arr[args[0]], etc.
 * Chainable — returns itself for consecutive calls: circle(arr, 0, 1)(arr, 2, 3)
 */
export function circle(arr: number[], ...indices: number[]): typeof circle {
	const length = indices.length;
	const temp = arr[indices[length - 1]];
	for (let i = length - 1; i > 0; i--) {
		arr[indices[i]] = arr[indices[i - 1]];
	}
	arr[indices[0]] = temp;
	return circle;
}

/**
 * Apply a cyclic permutation to arr, with optional orientation changes.
 * perm: [idx1, idx2, ..., idxn]
 * pow: power of the cycle (default 1)
 * ori: [ori1, ori2, ..., orin, base] — orientation deltas with base at the end
 */
export function acycle(arr: number[], perm: number[], pow?: number, ori?: number[] | null): typeof acycle {
	pow = pow || 1;
	const plen = perm.length;
	const tmp: number[] = [];
	for (let i = 0; i < plen; i++) {
		tmp[i] = arr[perm[i]];
	}
	for (let i = 0; i < plen; i++) {
		const j = (i + pow) % plen;
		arr[perm[j]] = tmp[i];
		if (ori) {
			arr[perm[j]] += ori[j] - ori[i] + ori[ori.length - 1];
		}
	}
	return acycle;
}

// ==================== Pruning Table Access ====================

export function getPruning(table: number[], index: number): number {
	return (table[index >> 3] >> ((index & 7) << 2)) & 15;
}

export function setPruning(table: number[], index: number, value: number): void {
	table[index >> 3] ^= (15 ^ value) << ((index & 7) << 2);
}

// ==================== Permutation Encoding/Decoding ====================

export function setNPerm(arr: number[], idx: number, n: number, even?: number): number[] {
	let prt = 0;
	if (even !== undefined && even < 0) {
		idx <<= 1;
	}
	const vall_init = 0x76543210;
	const valh_init = 0xfedcba98;
	let vall = vall_init;
	let valh = valh_init;
	for (let i = 0; i < n - 1; i++) {
		const p = fact[n - 1 - i];
		let v = Math.floor(idx / p);
		idx = idx % p;
		prt ^= v;
		v <<= 2;
		if (v >= 32) {
			v = v - 32;
			arr[i] = (valh >> v) & 0xf;
			const m = (1 << v) - 1;
			valh = (valh & m) + ((valh >> 4) & ~m);
		} else {
			arr[i] = (vall >> v) & 0xf;
			const m = (1 << v) - 1;
			vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28);
			valh = valh >> 4;
		}
	}
	if (even !== undefined && even < 0 && (prt & 1) !== 0) {
		arr[n - 1] = arr[n - 2];
		arr[n - 2] = vall & 0xf;
	} else {
		arr[n - 1] = vall & 0xf;
	}
	return arr;
}

export function getNPerm(arr: number[], n?: number, even?: number): number {
	n = n || arr.length;
	let idx = 0;
	let vall = 0x76543210;
	let valh = 0xfedcba98;
	for (let i = 0; i < n - 1; i++) {
		const v = arr[i] << 2;
		idx *= n - i;
		if (v >= 32) {
			idx += (valh >> (v - 32)) & 0xf;
			valh -= 0x11111110 << (v - 32);
		} else {
			idx += (vall >> v) & 0xf;
			valh -= 0x11111111;
			vall -= 0x11111110 << v;
		}
	}
	return even !== undefined && even < 0 ? idx >> 1 : idx;
}

export function getNParity(idx: number, n: number): number {
	let p = 0;
	for (let i = n - 2; i >= 0; --i) {
		p ^= idx % (n - i);
		idx = ~~(idx / (n - i));
	}
	return p & 1;
}

// ==================== Orientation Encoding/Decoding ====================

export function getNOri(arr: number[], n: number, evenbase: number): number {
	const base = Math.abs(evenbase);
	let idx = evenbase < 0 ? 0 : arr[0] % base;
	for (let i = n - 1; i > 0; i--) {
		idx = idx * base + (arr[i] % base);
	}
	return idx;
}

export function setNOri(arr: number[], idx: number, n: number, evenbase: number): number[] {
	const base = Math.abs(evenbase);
	let parity = base * n;
	for (let i = 1; i < n; i++) {
		arr[i] = idx % base;
		parity -= arr[i];
		idx = ~~(idx / base);
	}
	arr[0] = (evenbase < 0 ? parity : idx) % base;
	return arr;
}

// ==================== Bit Utilities ====================

export function bitCount(x: number): number {
	x -= (x >> 1) & 0x55555555;
	x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
	return (((x + (x >> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}

// ==================== Combination (Multi-Permutation) Encoding ====================

export function getMPerm(arr: number[], n: number, cnts: number[], cums: number[]): number {
	let seen = ~0;
	let idx = 0;
	let x = 1;
	for (let i = 0; i < n; i++) {
		const pi = arr[i];
		idx = idx * (n - i) + bitCount(seen & ((1 << cums[pi]) - 1)) * x;
		x = x * cnts[pi]--;
		seen &= ~(1 << (cums[pi] + cnts[pi]));
	}
	return Math.round(idx / x);
}

export function setMPerm(arr: number[], idx: number, n: number, cnts: number[], x: number): number[] {
	for (let i = 0; i < n; i++) {
		for (let j = 0; j < cnts.length; j++) {
			if (cnts[j] === 0) continue;
			const x2 = ~~(x * cnts[j] / (n - i));
			if (idx < x2) {
				cnts[j]--;
				arr[i] = j;
				x = x2;
				break;
			}
			idx -= x2;
		}
	}
	return arr;
}

// ==================== Coord Class (Coordinate Abstraction) ====================

export class Coord {
	length: number;
	evenbase: number | number[];
	// For 'c' type
	cnts?: number[];
	cntn?: number;
	cums?: number[];
	n?: number;
	x?: number;

	get: (arr: number[]) => number;
	set: (arr: number[], idx: number) => number[];

	constructor(type: string, length: number, evenbase: number | number[]) {
		this.length = length;
		this.evenbase = evenbase;

		if (type === 'p') {
			this.get = (arr) => getNPerm(arr, this.length, this.evenbase as number);
			this.set = (arr, idx) => setNPerm(arr, idx, this.length, this.evenbase as number);
		} else if (type === 'o') {
			this.get = (arr) => getNOri(arr, this.length, this.evenbase as number);
			this.set = (arr, idx) => setNOri(arr, idx, this.length, this.evenbase as number);
		} else if (type === 'c') {
			const cnts = (evenbase as number[]);
			this.cnts = cnts.slice();
			this.cntn = this.cnts.length;
			this.cums = [0];
			for (let i = 1; i <= this.cntn; i++) {
				this.cums[i] = this.cums[i - 1] + cnts[i - 1];
			}
			this.n = this.cums[this.cntn];
			let n = this.n;
			let xVal = 1;
			for (let i = 0; i < this.cntn; i++) {
				for (let j = 1; j <= cnts[i]; j++, n--) {
					xVal *= n / j;
				}
			}
			this.x = Math.round(xVal);
			this.get = (arr) => getMPerm(arr, this.n!, this.cnts!.slice(), this.cums!);
			this.set = (arr, idx) => setMPerm(arr, idx, this.n!, this.cnts!.slice(), this.x!);
		} else {
			throw new Error(`Invalid Coord type: ${type}`);
		}
	}
}

// ==================== Facelet Operations ====================

export function fillFacelet(
	facelets: (number | number[])[], f: number[],
	perm: number[], ori: number[] | null, divcol: number
): void {
	for (let i = 0; i < facelets.length; i++) {
		const cubie = facelets[i];
		const p = perm[i] === undefined ? i : perm[i];
		if (typeof cubie === 'number') {
			f[cubie] = ~~((facelets[p] as number) / divcol);
			continue;
		}
		const o = (ori && ori[i]) || 0;
		for (let j = 0; j < cubie.length; j++) {
			f[cubie[(j + o) % cubie.length]] = ~~((facelets[p] as number[])[j] / divcol);
		}
	}
}

export function detectFacelet(
	facelets: number[][], f: number[],
	perm: number[], ori: number[], divcol: number
): number {
	for (let i = 0; i < facelets.length; i++) {
		const n_ori = facelets[i].length;
		let matched = false;
		for (let j = 0; j < facelets.length; j++) {
			if (facelets[j].length !== n_ori) continue;
			for (let o = 0; o < n_ori; o++) {
				let isMatch = true;
				for (let t = 0; t < n_ori; t++) {
					if (~~(facelets[j][t] / divcol) !== f[facelets[i][(t + o) % n_ori]]) {
						isMatch = false;
						break;
					}
				}
				if (isMatch) {
					perm[i] = j;
					ori[i] = o;
					matched = true;
					break;
				}
			}
			if (matched) break;
		}
		if (!matched) return -1;
	}
	return 0;
}

// ==================== Move Table & Pruning Table Creation ====================

export type DoMoveFunc = (idx: number, move: number) => number;
export type DoMoveArraySpec = [Function, string, number, number];

export function createMove(
	moveTable: number[][], size: number,
	doMove: DoMoveFunc | DoMoveArraySpec, N_MOVES?: number
): void {
	N_MOVES = N_MOVES || 6;
	if (Array.isArray(doMove)) {
		const cord = new Coord(doMove[1] as string, doMove[2] as number, doMove[3] as number);
		const moveFn = doMove[0] as (arr: number[], m: number) => void;
		for (let j = 0; j < N_MOVES; j++) {
			moveTable[j] = [];
			for (let i = 0; i < size; i++) {
				const arr = cord.set([], i);
				moveFn(arr, j);
				moveTable[j][i] = cord.get(arr);
			}
		}
	} else {
		for (let j = 0; j < N_MOVES; j++) {
			moveTable[j] = [];
			for (let i = 0; i < size; i++) {
				moveTable[j][i] = doMove(i, j);
			}
		}
	}
}

export function createMoveHash(
	initState: any, validMoves: any[],
	hashFunc: (state: any) => any,
	moveFunc: (state: any, move: any) => any | null
): [number[][], Record<string, number>] {
	const states = [initState];
	const hash2idx: Record<string, number> = {};
	const depthEnds: number[] = [];
	hash2idx[hashFunc(initState)] = 0;
	depthEnds[0] = 1;
	const moveTable: number[][] = [];
	for (let m = 0; m < validMoves.length; m++) {
		moveTable[m] = [];
	}
	for (let i = 0; i < states.length; i++) {
		if (i === depthEnds[depthEnds.length - 1]) {
			depthEnds.push(states.length);
		}
		const curState = states[i];
		for (let m = 0; m < validMoves.length; m++) {
			const newState = moveFunc(curState, validMoves[m]);
			if (!newState) {
				moveTable[m][i] = -1;
				continue;
			}
			const newHash = hashFunc(newState);
			if (!(newHash in hash2idx)) {
				hash2idx[newHash] = states.length;
				states.push(newState);
			}
			moveTable[m][i] = hash2idx[newHash];
		}
	}
	return [moveTable, hash2idx];
}

export function createPrun(
	prun: number[], initVal: number | number[], size: number,
	maxd?: number, doMove?: DoMoveFunc | number[][],
	N_MOVES?: number, N_POWER?: number, N_INV?: number
): void {
	const isMoveTable = Array.isArray(doMove);
	N_MOVES = N_MOVES || 6;
	N_POWER = N_POWER || 3;
	N_INV = N_INV || 256;
	maxd = maxd || 256;

	const len = (size + 7) >>> 3;
	for (let i = 0; i < len; i++) {
		prun[i] = -1;
	}

	const initArr = Array.isArray(initVal) ? initVal : [initVal];
	for (let i = 0; i < initArr.length; i++) {
		prun[initArr[i] >> 3] ^= 15 << ((initArr[i] & 7) << 2);
	}

	for (let l = 0; l <= maxd; l++) {
		let done = 0;
		const inv = l >= N_INV;
		const fill = (l + 1) ^ 15;
		const find = inv ? 0xf : l;
		const check = inv ? l : 0xf;

		let val = 0;
		for (let p = 0; p < size; p++) {
			if ((p & 7) === 0) {
				val = prun[p >> 3];
				if (!inv && val === -1) {
					p += 7;
					continue;
				}
			} else {
				val >>= 4;
			}
			if ((val & 0xf) !== find) continue;

			let skip = false;
			for (let m = 0; m < N_MOVES; m++) {
				let q = p;
				for (let c = 0; c < N_POWER; c++) {
					q = isMoveTable ? (doMove as number[][])[m][q] : (doMove as DoMoveFunc)(q, m);
					if (q < 0) break;
					if (getPruning(prun, q) !== check) continue;
					++done;
					if (inv) {
						prun[p >> 3] ^= fill << ((p & 7) << 2);
						skip = true;
						break;
					}
					prun[q >> 3] ^= fill << ((q & 7) << 2);
				}
				if (skip) break;
			}
		}
		if (done === 0) break;
	}
}

// ==================== Edge Move (3x3 face moves on edge array) ====================

export function edgeMove(arr: number[], m: number): void {
	if (m === 0) circleOri(arr, 0, 7, 8, 4, 1);       // F
	else if (m === 1) circleOri(arr, 3, 6, 11, 7, 0);  // R
	else if (m === 2) circleOri(arr, 0, 1, 2, 3, 0);   // U
	else if (m === 3) circleOri(arr, 2, 5, 10, 6, 1);  // B
	else if (m === 4) circleOri(arr, 1, 4, 9, 5, 0);   // L
	else if (m === 5) circleOri(arr, 11, 10, 9, 8, 0); // D
}

// ==================== CubieCube ====================

export class CubieCube {
	ca: number[];
	ea: number[];
	ori: number;
	ct?: number[];
	tstamp?: number;

	constructor() {
		this.ca = [0, 1, 2, 3, 4, 5, 6, 7];
		this.ea = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
		this.ori = 0;
	}

	init(ca: number[], ea: number[]): CubieCube {
		this.ca = ca.slice();
		this.ea = ea.slice();
		return this;
	}

	hashCode(): number {
		let ret = 0;
		for (let i = 0; i < 20; i++) {
			ret = 0 | (ret * 31 + (i < 12 ? this.ea[i] : this.ca[i - 12]));
		}
		return ret;
	}

	isEqual(c?: CubieCube): boolean {
		c = c || CubieCube.SOLVED;
		for (let i = 0; i < 8; i++) {
			if (this.ca[i] !== c.ca[i]) return false;
		}
		for (let i = 0; i < 12; i++) {
			if (this.ea[i] !== c.ea[i]) return false;
		}
		return true;
	}

	invFrom(cc: CubieCube): CubieCube {
		for (let edge = 0; edge < 12; edge++) {
			this.ea[cc.ea[edge] >> 1] = edge << 1 | (cc.ea[edge] & 1);
		}
		for (let corn = 0; corn < 8; corn++) {
			this.ca[cc.ca[corn] & 0x7] = corn | (0x20 >> (cc.ca[corn] >> 3)) & 0x18;
		}
		return this;
	}

	verify(): number {
		let mask = 0;
		let sum = 0;
		const ep: number[] = [];
		for (let e = 0; e < 12; e++) {
			mask |= 1 << 8 << (this.ea[e] >> 1);
			sum ^= this.ea[e] & 1;
			ep.push(this.ea[e] >> 1);
		}
		const cp: number[] = [];
		for (let c = 0; c < 8; c++) {
			mask |= 1 << (this.ca[c] & 7);
			sum += (this.ca[c] >> 3) << 1;
			cp.push(this.ca[c] & 0x7);
		}
		if (mask !== 0xfffff || sum % 6 !== 0
			|| getNParity(getNPerm(ep, 12), 12) !== getNParity(getNPerm(cp, 8), 8)) {
			return -1;
		}
		return 0;
	}

	fromFacelet(facelet: string, cFacelet?: number[][], eFacelet?: number[][]): CubieCube | number {
		cFacelet = cFacelet || CubieCube.cFacelet;
		eFacelet = eFacelet || CubieCube.eFacelet;
		let count = 0;
		const f: number[] = [];
		const centers = facelet[4] + facelet[13] + facelet[22] + facelet[31] + facelet[40] + facelet[49];
		for (let i = 0; i < 54; ++i) {
			f[i] = centers.indexOf(facelet[i]);
			if (f[i] === -1) return -1;
			count += 1 << (f[i] << 2);
		}
		if (count !== 0x999999) return -1;

		for (let i = 0; i < 8; ++i) {
			let ori: number;
			for (ori = 0; ori < 3; ++ori) {
				if (f[cFacelet[i][ori]] === 0 || f[cFacelet[i][ori]] === 3) break;
			}
			const col1 = f[cFacelet[i][(ori + 1) % 3]];
			const col2 = f[cFacelet[i][(ori + 2) % 3]];
			for (let j = 0; j < 8; ++j) {
				if (col1 === ~~(cFacelet[j][1] / 9) && col2 === ~~(cFacelet[j][2] / 9)) {
					this.ca[i] = j | (ori % 3) << 3;
					break;
				}
			}
		}
		for (let i = 0; i < 12; ++i) {
			for (let j = 0; j < 12; ++j) {
				if (f[eFacelet[i][0]] === ~~(eFacelet[j][0] / 9) && f[eFacelet[i][1]] === ~~(eFacelet[j][1] / 9)) {
					this.ea[i] = j << 1;
					break;
				}
				if (f[eFacelet[i][0]] === ~~(eFacelet[j][1] / 9) && f[eFacelet[i][1]] === ~~(eFacelet[j][0] / 9)) {
					this.ea[i] = j << 1 | 1;
					break;
				}
			}
		}
		return this;
	}

	toPerm(cFacelet?: number[][], eFacelet?: number[][], ctFacelet?: number[], withOri?: boolean): number[] {
		cFacelet = cFacelet || CubieCube.cFacelet;
		eFacelet = eFacelet || CubieCube.eFacelet;
		ctFacelet = ctFacelet || CubieCube.ctFacelet;
		const f: number[] = [];
		for (let i = 0; i < 54; i++) f[i] = i;

		let obj: CubieCube = this;
		if (withOri && obj.ori) {
			obj = new CubieCube();
			const rot = CubieCube.rotCube[CubieCube.rotMulI![0][this.ori]];
			CubieCube.CubeMult(this, rot, obj);
			for (let i = 0; i < 6; i++) {
				f[ctFacelet[i]] = ctFacelet[rot.ct![i]];
			}
		}
		for (let c = 0; c < 8; c++) {
			const j = obj.ca[c] & 0x7;
			const ori = obj.ca[c] >> 3;
			for (let n = 0; n < 3; n++) {
				f[cFacelet[c][(n + ori) % 3]] = cFacelet[j][n];
			}
		}
		for (let e = 0; e < 12; e++) {
			const j = obj.ea[e] >> 1;
			const ori = obj.ea[e] & 1;
			for (let n = 0; n < 2; n++) {
				f[eFacelet[e][(n + ori) % 2]] = eFacelet[j][n];
			}
		}
		return f;
	}

	toFaceCube(cFacelet?: number[][], eFacelet?: number[][], ctFacelet?: number[], withOri?: boolean): string {
		const perm = this.toPerm(cFacelet, eFacelet, ctFacelet, withOri);
		const ts = 'URFDLB';
		const f: string[] = [];
		for (let i = 0; i < 54; i++) {
			f[i] = ts[~~(perm[i] / 9)];
		}
		return f.join('');
	}

	edgeCycles(): number {
		const visited: boolean[] = [];
		const small_cycles = [0, 0, 0];
		let cycles = 0;
		let parity = false;
		for (let x = 0; x < 12; ++x) {
			if (visited[x]) continue;
			let length = -1;
			let flip = 0;
			let y = x;
			do {
				visited[y] = true;
				++length;
				flip ^= this.ea[y] & 1;
				y = this.ea[y] >> 1;
			} while (y !== x);
			cycles += length >> 1;
			if (length & 1) {
				parity = !parity;
				++cycles;
			}
			if (flip) {
				if (length === 0) {
					++small_cycles[0];
				} else if (length & 1) {
					small_cycles[2] ^= 1;
				} else {
					++small_cycles[1];
				}
			}
		}
		small_cycles[1] += small_cycles[2];
		if (small_cycles[0] < small_cycles[1]) {
			cycles += (small_cycles[0] + small_cycles[1]) >> 1;
		} else {
			const flip_cycles = [0, 2, 3, 5, 6, 8, 9];
			cycles += small_cycles[1] + flip_cycles[(small_cycles[0] - small_cycles[1]) >> 1];
		}
		return cycles - (parity ? 1 : 0);
	}

	selfMoveStr(moveStr: string, isInv?: boolean): number | undefined {
		const CubeMoveRE = /^\s*([URFDLB]w?|[EMSyxz]|2-2[URFDLB]w)(['2]?)(@\d+)?\s*$/;
		const m = CubeMoveRE.exec(moveStr);
		if (!m) return undefined;

		const face = m[1];
		let pow = '2\''.indexOf(m[2] || '-') + 2;
		if (isInv) pow = 4 - pow;
		if (m[3]) this.tstamp = ~~m[3].slice(1);
		this.ori = this.ori || 0;

		const tmpCubie = new CubieCube();

		let axis = 'URFDLB'.indexOf(face);
		if (axis !== -1) {
			let mv = axis * 3 + pow % 4 - 1;
			mv = CubieCube.rotMulM![this.ori][mv];
			CubieCube.CubeMult(this, CubieCube.moveCube[mv], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			return mv;
		}
		axis = 'UwRwFwDwLwBw'.indexOf(face);
		if (axis !== -1) {
			axis >>= 1;
			let mv = (axis + 3) % 6 * 3 + pow % 4 - 1;
			mv = CubieCube.rotMulM![this.ori][mv];
			CubieCube.CubeMult(this, CubieCube.moveCube[mv], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			const rot = [3, 15, 17, 1, 11, 23][axis];
			for (let i = 0; i < pow; i++) {
				this.ori = CubieCube.rotMult![rot][this.ori];
			}
			return mv;
		}
		const sliceFaces = ['2-2Uw', '2-2Rw', '2-2Fw', '2-2Dw', '2-2Lw', '2-2Bw'];
		axis = sliceFaces.indexOf(face);
		if (axis === -1) {
			axis = [null, null, 'S', 'E', 'M', null].indexOf(face as any);
		}
		if (axis !== -1) {
			let m1 = axis * 3 + (4 - pow) % 4 - 1;
			let m2 = (axis + 3) % 6 * 3 + pow % 4 - 1;
			m1 = CubieCube.rotMulM![this.ori][m1];
			CubieCube.CubeMult(this, CubieCube.moveCube[m1], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			m2 = CubieCube.rotMulM![this.ori][m2];
			CubieCube.CubeMult(this, CubieCube.moveCube[m2], tmpCubie);
			this.init(tmpCubie.ca, tmpCubie.ea);
			const rot = [3, 15, 17, 1, 11, 23][axis];
			for (let i = 0; i < pow; i++) {
				this.ori = CubieCube.rotMult![rot][this.ori];
			}
			return m1 + 18;
		}
		axis = 'yxz'.indexOf(face);
		if (axis !== -1) {
			const rot = [3, 15, 17][axis];
			for (let i = 0; i < pow; i++) {
				this.ori = CubieCube.rotMult![rot][this.ori];
			}
			return undefined;
		}
		return undefined;
	}

	selfConj(conj?: number): void {
		if (conj === undefined) conj = this.ori;
		if (conj !== 0) {
			const tmpCubie = new CubieCube();
			CubieCube.CubeMult(CubieCube.rotCube[conj], this, tmpCubie);
			CubieCube.CubeMult(tmpCubie, CubieCube.rotCube[CubieCube.rotMulI![0][conj]], this);
			this.ori = CubieCube.rotMulI![this.ori][conj] || 0;
		}
	}

	// Static members
	static SOLVED = new CubieCube();

	static EdgeMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		for (let ed = 0; ed < 12; ed++) {
			prod.ea[ed] = a.ea[b.ea[ed] >> 1] ^ (b.ea[ed] & 1);
		}
	}

	static CornMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		for (let corn = 0; corn < 8; corn++) {
			const ori = ((a.ca[b.ca[corn] & 7] >> 3) + (b.ca[corn] >> 3)) % 3;
			prod.ca[corn] = (a.ca[b.ca[corn] & 7] & 7) | (ori << 3);
		}
	}

	static CubeMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		CubieCube.CornMult(a, b, prod);
		CubieCube.EdgeMult(a, b, prod);
	}

	static CentMult(a: CubieCube, b: CubieCube, prod: CubieCube): void {
		prod.ct = [];
		for (let cent = 0; cent < 6; cent++) {
			prod.ct[cent] = a.ct![b.ct![cent]];
		}
	}

	static cFacelet = [
		[8, 9, 20],   // URF
		[6, 18, 38],  // UFL
		[0, 36, 47],  // ULB
		[2, 45, 11],  // UBR
		[29, 26, 15], // DFR
		[27, 44, 24], // DLF
		[33, 53, 42], // DBL
		[35, 17, 51]  // DRB
	];

	static eFacelet = [
		[5, 10],  // UR
		[7, 19],  // UF
		[3, 37],  // UL
		[1, 46],  // UB
		[32, 16], // DR
		[28, 25], // DF
		[30, 43], // DL
		[34, 52], // DB
		[23, 12], // FR
		[21, 41], // FL
		[50, 39], // BL
		[48, 14]  // BR
	];

	static ctFacelet = [4, 13, 22, 31, 40, 49];

	static faceMap: [number, number, number][] = (() => {
		const f: [number, number, number][] = [];
		for (let c = 0; c < 8; c++) {
			for (let n = 0; n < 3; n++) {
				f[CubieCube.cFacelet[c][n]] = [0, c, n];
			}
		}
		for (let e = 0; e < 12; e++) {
			for (let n = 0; n < 2; n++) {
				f[CubieCube.eFacelet[e][n]] = [1, e, n];
			}
		}
		return f;
	})();

	static moveCube: CubieCube[] = (() => {
		const mc: CubieCube[] = [];
		for (let i = 0; i < 18; i++) mc[i] = new CubieCube();
		mc[0].init([3, 0, 1, 2, 4, 5, 6, 7], [6, 0, 2, 4, 8, 10, 12, 14, 16, 18, 20, 22]);       // U
		mc[3].init([20, 1, 2, 8, 15, 5, 6, 19], [16, 2, 4, 6, 22, 10, 12, 14, 8, 18, 20, 0]);     // R
		mc[6].init([9, 21, 2, 3, 16, 12, 6, 7], [0, 19, 4, 6, 8, 17, 12, 14, 3, 11, 20, 22]);     // F
		mc[9].init([0, 1, 2, 3, 5, 6, 7, 4], [0, 2, 4, 6, 10, 12, 14, 8, 16, 18, 20, 22]);        // D
		mc[12].init([0, 10, 22, 3, 4, 17, 13, 7], [0, 2, 20, 6, 8, 10, 18, 14, 16, 4, 12, 22]);   // L
		mc[15].init([0, 1, 11, 23, 4, 5, 18, 14], [0, 2, 4, 23, 8, 10, 12, 21, 16, 18, 7, 15]);   // B
		for (let a = 0; a < 18; a += 3) {
			for (let p = 0; p < 2; p++) {
				CubieCube.CubeMult(mc[a + p], mc[a], mc[a + p + 1]);
			}
		}
		return mc;
	})();

	static rotCube: CubieCube[] = [];
	static rotMult: number[][] | null = null;
	static rotMulI: number[][] | null = null;
	static rotMulM: number[][] | null = null;
	static rot2str: string[] = [];
}

// Initialize rotCube and rotation tables
(() => {
	const u4 = new CubieCube().init([3, 0, 1, 2, 7, 4, 5, 6], [6, 0, 2, 4, 14, 8, 10, 12, 23, 17, 19, 21]);
	u4.ct = [0, 5, 1, 3, 2, 4];
	const f2 = new CubieCube().init([5, 4, 7, 6, 1, 0, 3, 2], [12, 10, 8, 14, 4, 2, 0, 6, 18, 16, 22, 20]);
	f2.ct = [3, 4, 2, 0, 1, 5];
	const urf = new CubieCube().init([8, 20, 13, 17, 19, 15, 22, 10], [3, 16, 11, 18, 7, 22, 15, 20, 1, 9, 13, 5]);
	urf.ct = [2, 0, 1, 5, 3, 4];

	const c = new CubieCube();
	c.ct = [0, 1, 2, 3, 4, 5];
	const d = new CubieCube();

	for (let i = 0; i < 24; i++) {
		CubieCube.rotCube[i] = new CubieCube().init(c.ca, c.ea);
		CubieCube.rotCube[i].ct = c.ct!.slice();
		CubieCube.CubeMult(c, u4, d);
		CubieCube.CentMult(c, u4, d);
		c.init(d.ca, d.ea);
		c.ct = d.ct!.slice();
		if (i % 4 === 3) {
			CubieCube.CubeMult(c, f2, d);
			CubieCube.CentMult(c, f2, d);
			c.init(d.ca, d.ea);
			c.ct = d.ct!.slice();
		}
		if (i % 8 === 7) {
			CubieCube.CubeMult(c, urf, d);
			CubieCube.CentMult(c, urf, d);
			c.init(d.ca, d.ea);
			c.ct = d.ct!.slice();
		}
	}

	const movHash: number[] = [];
	const rotHash: number[] = [];
	const rotMult: number[][] = [];
	const rotMulI: number[][] = [];
	const rotMulM: number[][] = [];

	for (let i = 0; i < 24; i++) {
		rotHash[i] = CubieCube.rotCube[i].hashCode();
		rotMult[i] = [];
		rotMulI[i] = [];
		rotMulM[i] = [];
	}
	for (let i = 0; i < 18; i++) {
		movHash[i] = CubieCube.moveCube[i].hashCode();
	}

	const tmp = new CubieCube();
	for (let i = 0; i < 24; i++) {
		for (let j = 0; j < 24; j++) {
			CubieCube.CubeMult(CubieCube.rotCube[i], CubieCube.rotCube[j], tmp);
			const k = rotHash.indexOf(tmp.hashCode());
			rotMult[i][j] = k;
			rotMulI[k][j] = i;
		}
	}
	for (let i = 0; i < 24; i++) {
		for (let j = 0; j < 18; j++) {
			CubieCube.CubeMult(CubieCube.rotCube[rotMulI[0][i]], CubieCube.moveCube[j], tmp);
			CubieCube.CubeMult(tmp, CubieCube.rotCube[i], d);
			const k = movHash.indexOf(d.hashCode());
			rotMulM[i][j] = k;
		}
	}

	CubieCube.rotMult = rotMult;
	CubieCube.rotMulI = rotMulI;
	CubieCube.rotMulM = rotMulM;
	CubieCube.rot2str = [
		'', "y'", 'y2', 'y',
		'z2', "y' z2", 'y2 z2', 'y z2',
		"y' x'", "y2 x'", "y x'", "x'",
		"y' x", "y2 x", "y x", 'x',
		'y z', 'z', "y' z", 'y2 z',
		"y' z'", "y2 z'", "y z'", "z'"
	];
})();

// ==================== Megaminx Operations ====================

export const minx = (() => {
	const U = 0, R = 1, F = 2, L = 3, BL = 4, BR = 5, DR = 6, DL = 7, DBL = 8, B = 9, DBR = 10, D = 11;
	const oppFace = [D, DBL, B, DBR, DR, DL, BL, BR, R, F, L, U];
	const adjFaces = [
		[BR, R, F, L, BL],
		[DBR, DR, F, U, BR],
		[DR, DL, L, U, R],
		[DL, DBL, BL, U, F],
		[DBL, B, BR, U, L],
		[B, DBR, R, U, BL],
		[D, DL, F, R, DBR],
		[D, DBL, L, F, DR],
		[D, B, BL, L, DL],
		[D, DBR, BR, BL, DBL],
		[D, DR, R, BR, B],
		[DR, DBR, B, DBL, DL]
	];

	function doMove(state: number[], face: number, pow: number, wide: number): void {
		pow = (pow % 5 + 5) % 5;
		if (pow === 0) return;
		const base = face * 11;
		const swaps: number[][] = [[], [], [], [], []];
		for (let i = 0; i < 5; i++) {
			const aface = adjFaces[face][i];
			const ridx = adjFaces[aface].indexOf(face);
			if (wide === 0 || wide === 1) {
				swaps[i].push(
					base + i,
					base + i + 5,
					aface * 11 + ridx % 5 + 5,
					aface * 11 + ridx % 5,
					aface * 11 + (ridx + 1) % 5
				);
			}
			if (wide === 1 || wide === 2) {
				swaps[i].push(aface * 11 + 10);
				for (let j = 1; j < 5; j++) {
					swaps[i].push(aface * 11 + (ridx + j) % 5 + 5);
				}
				for (let j = 2; j < 5; j++) {
					swaps[i].push(aface * 11 + (ridx + j) % 5);
				}
				const ii = 4 - i;
				const opp = oppFace[face];
				const oaface = adjFaces[opp][ii];
				const oridx = adjFaces[oaface].indexOf(opp);
				swaps[i].push(
					opp * 11 + ii,
					opp * 11 + ii + 5,
					oaface * 11 + 10
				);
				for (let j = 0; j < 5; j++) {
					swaps[i].push(
						oaface * 11 + (oridx + j) % 5 + 5,
						oaface * 11 + (oridx + j) % 5
					);
				}
			}
		}
		for (let i = 0; i < swaps[0].length; i++) {
			acycle(state, [swaps[0][i], swaps[1][i], swaps[2][i], swaps[3][i], swaps[4][i]], pow);
		}
	}

	return { doMove, oppFace, adjFaces };
})();

// ==================== IDA* Searcher ====================

export class Searcher {
	private isSolved: (state: any) => boolean;
	private getPrunFn: (state: any) => number;
	private doMoveFn: (state: any, axis: number, pow?: number) => any;
	private N_AXIS: number;
	private N_POWER: number;
	private ckmv: number[];
	private sol: number[][];
	private length: number;
	private idxs: any[];
	private sidx: number;
	private cost: number;
	private callback: (sol: number[][], sidx: number) => boolean;

	constructor(
		isSolved: ((state: any) => boolean) | null,
		getPrunFn: (state: any) => number,
		doMoveFn: (state: any, axis: number, pow?: number) => any,
		N_AXIS: number, N_POWER: number, ckmv?: number[]
	) {
		this.isSolved = isSolved || (() => true);
		this.getPrunFn = getPrunFn;
		this.doMoveFn = doMoveFn;
		this.N_AXIS = N_AXIS;
		this.N_POWER = N_POWER;
		this.ckmv = ckmv || valuedArray(N_AXIS, (i: number) => 1 << i);
		this.sol = [];
		this.length = 0;
		this.idxs = [];
		this.sidx = 0;
		this.cost = 0;
		this.callback = () => true;
	}

	solve(idx: any, minl: number, MAXL: number, callback?: (sol: number[][], sidx: number) => boolean, cost?: number): number[][] | null {
		const sols = this.solveMulti([idx], minl, MAXL, callback, cost);
		return sols == null ? null : sols[0];
	}

	solveMulti(idxs: any[], minl: number, MAXL: number, callback?: (sol: number[][], sidx: number) => boolean, cost?: number): [number[][], number] | null {
		this.sidx = 0;
		this.sol = [];
		this.length = minl;
		this.idxs = idxs;
		return this.nextMulti(MAXL, callback, cost);
	}

	next(MAXL: number, callback?: (sol: number[][], sidx: number) => boolean, cost?: number): number[][] | null {
		const sols = this.nextMulti(MAXL, callback, cost);
		return sols == null ? null : sols[0];
	}

	nextMulti(MAXL: number, callback?: (sol: number[][], sidx: number) => boolean, cost?: number): [number[][], number] | null {
		this.cost = (cost || 1e9) + 1;
		this.callback = callback || (() => true);
		for (; this.length <= MAXL; this.length++) {
			for (; this.sidx < this.idxs.length; this.sidx++) {
				if (this.idaSearch(this.idxs[this.sidx], this.length, 0, -1, this.sol) === 0) {
					return this.cost <= 0 ? null : [this.sol, this.sidx];
				}
			}
			this.sidx = 0;
		}
		return null;
	}

	private idaSearch(idx: any, maxl: number, depth: number, lm: number, sol: number[][]): number {
		if (--this.cost <= 0) return 0;
		const prun = this.getPrunFn(idx);
		if (prun > maxl) return prun > maxl + 1 ? 2 : 1;
		if (maxl === 0) return this.isSolved(idx) && this.callback(sol, this.sidx) ? 0 : 1;
		if (prun === 0 && maxl === 1 && this.isSolved(idx)) return 1;

		let axis = sol.length > depth ? sol[depth][0] : 0;
		for (; axis < this.N_AXIS; axis++) {
			if (lm >= 0 && (this.ckmv[lm] >> axis) & 1) continue;
			let idx1 = Array.isArray(idx) ? idx.slice() : idx;
			let pow = sol.length > depth ? sol[depth][1] : 0;
			for (; pow < this.N_POWER; pow++) {
				idx1 = this.doMoveFn(idx1, axis, pow);
				if (idx1 == null) break;
				sol[depth] = [axis, pow];
				const ret = this.idaSearch(idx1, maxl - 1, depth + 1, axis, sol);
				if (ret === 0) return 0;
				sol.pop();
				if (ret === 2) break;
			}
		}
		return 1;
	}
}

// ==================== Solver (Multi-coordinate IDA* wrapper) ====================

export class Solver {
	N_STATES: number;
	N_MOVES: number;
	N_POWER: number;
	stateParams: any[][];
	coords: (Coord | undefined)[];
	move: number[][][];
	prun: number[][];
	solv: Searcher | null;
	inited: boolean;

	constructor(N_MOVES: number, N_POWER: number, stateParams: any[][]) {
		this.N_STATES = stateParams.length;
		this.N_MOVES = N_MOVES;
		this.N_POWER = N_POWER;
		this.stateParams = stateParams;
		this.coords = [];
		for (let i = 0; i < this.N_STATES; i++) {
			const doMove = stateParams[i][1];
			if (Array.isArray(doMove)) {
				this.coords[i] = new Coord(doMove[1], doMove[2], doMove[3]);
			}
		}
		this.move = [];
		this.prun = [];
		this.solv = null;
		this.inited = false;
	}

	init(): void {
		if (this.inited) return;
		this.move = [];
		this.prun = [];
		for (let i = 0; i < this.N_STATES; i++) {
			const stateParam = this.stateParams[i];
			const initVal = stateParam[0];
			const doMove = stateParam[1];
			const size = stateParam[2];
			const maxd = stateParam[3];
			const N_INV = stateParam[4];
			this.move[i] = [];
			this.prun[i] = [];
			createMove(this.move[i], size, doMove, this.N_MOVES);
			createPrun(this.prun[i], initVal, size, maxd, this.move[i], this.N_MOVES, this.N_POWER, N_INV);
		}
		this.solv = new Searcher(
			null,
			(state: number[]) => {
				let prun = 0;
				for (let i = 0; i < this.N_STATES; i++) {
					prun = Math.max(prun, getPruning(this.prun[i], state[i]));
				}
				return prun;
			},
			(state: number[], move: number) => {
				const newState = state.slice();
				for (let i = 0; i < this.N_STATES; i++) {
					newState[i] = this.move[i][move][state[i]];
				}
				return newState;
			},
			this.N_MOVES,
			this.N_POWER
		);
		this.inited = true;
	}

	search(state: number[], minl?: number, MAXL?: number): number[][] | null {
		MAXL = (MAXL || 99) + 1;
		if (!this.inited) this.init();
		return this.solv!.solve(state, minl || 0, MAXL);
	}

	toStr(sol: number[][] | null, move_map: string, power_map: string): string {
		if (!sol) return '';
		return sol.map((move) => move_map[move[0]] + power_map[move[1]]).join(' ').replace(/ +/g, ' ');
	}
}

// ==================== gSolver (String-based generic IDA*) ====================

type GSolverMoveFunc = (state: string, move: string) => string | null;

export class GSolver {
	solvedStates: string[];
	doMove: GSolverMoveFunc;
	movesList: [string, number][];
	prunTable: Record<string, number>;
	prunTableSize: number;
	prunDepth: number;
	prevSize: number;
	toUpdateArr: string[] | null;
	cost: number;
	MAX_PRUN_SIZE: number;
	sol: number[];
	subOpt: boolean;
	state: string;
	visited: Record<string, number>;
	maxl: number;
	solArr: string[] | null;
	prevSolStr: string | null;

	constructor(solvedStates: string[], doMove: GSolverMoveFunc, moves: Record<string, number>) {
		this.solvedStates = solvedStates;
		this.doMove = doMove;
		this.movesList = [];
		for (const move in moves) {
			this.movesList.push([move, moves[move]]);
		}
		this.prunTable = {};
		this.prunTableSize = 0;
		this.prunDepth = -1;
		this.prevSize = 0;
		this.toUpdateArr = null;
		this.cost = 0;
		this.MAX_PRUN_SIZE = 100000;
		this.sol = [];
		this.subOpt = false;
		this.state = '';
		this.visited = {};
		this.maxl = 0;
		this.solArr = null;
		this.prevSolStr = null;
	}

	updatePrun(targetDepth?: number): void {
		targetDepth = targetDepth === undefined ? this.prunDepth + 1 : targetDepth;
		for (let depth = this.prunDepth + 1; depth <= targetDepth; depth++) {
			if (this.prevSize >= this.MAX_PRUN_SIZE) break;
			if (depth < 1) {
				this.prevSize = 0;
				for (let i = 0; i < this.solvedStates.length; i++) {
					const state = this.solvedStates[i];
					if (!(state in this.prunTable)) {
						this.prunTable[state] = depth;
						this.prunTableSize++;
					}
				}
			} else {
				this.updatePrunBFS(depth - 1);
			}
			if (this.cost === 0) return;
			this.prunDepth = depth;
			this.prevSize = this.prunTableSize;
		}
	}

	private updatePrunBFS(fromDepth: number): void {
		if (this.toUpdateArr == null) {
			this.toUpdateArr = [];
			for (const state in this.prunTable) {
				if (this.prunTable[state] !== fromDepth) continue;
				this.toUpdateArr.push(state);
			}
		}
		while (this.toUpdateArr.length !== 0) {
			const state = this.toUpdateArr.pop()!;
			for (let moveIdx = 0; moveIdx < this.movesList.length; moveIdx++) {
				const newState = this.doMove(state, this.movesList[moveIdx][0]);
				if (!newState || newState in this.prunTable) continue;
				this.prunTable[newState] = fromDepth + 1;
				this.prunTableSize++;
			}
			if (this.cost >= 0) {
				if (this.cost === 0) return;
				this.cost--;
			}
		}
		this.toUpdateArr = null;
	}

	search(state: string, minl?: number, MAXL?: number): string[] | null {
		this.sol = [];
		this.subOpt = false;
		this.state = state;
		this.visited = {};
		this.maxl = minl || 0;
		return this.searchNext(MAXL);
	}

	searchNext(MAXL?: number, cost?: number): string[] | null {
		MAXL = (MAXL !== undefined ? MAXL + 1 : undefined) || 99;
		this.prevSolStr = this.solArr ? this.solArr.join(',') : null;
		this.solArr = null;
		this.cost = cost || -1;
		for (; this.maxl < MAXL; this.maxl++) {
			this.updatePrun(Math.ceil(this.maxl / 2));
			if (this.cost === 0) return null;
			if (this.idaSearch(this.state, this.maxl, null, 0)) break;
		}
		return this.solArr;
	}

	private getPrun(state: string): number {
		const prun = this.prunTable[state];
		return prun === undefined ? this.prunDepth + 1 : prun;
	}

	private idaSearch(state: string, maxl: number, lm: number | null, depth: number): boolean {
		if (this.getPrun(state) > maxl) return false;
		if (maxl === 0) {
			if (this.solvedStates.indexOf(state) === -1) return false;
			const solArr = this.sol.map((move) => this.movesList[move][0]);
			this.subOpt = true;
			if (solArr.join(',') === this.prevSolStr) return false;
			this.solArr = solArr;
			return true;
		}
		if (!this.subOpt) {
			if (state in this.visited && this.visited[state] < depth) return false;
			this.visited[state] = depth;
		}
		if (this.cost >= 0) {
			if (this.cost === 0) return true;
			this.cost--;
		}
		const lastMove = lm == null ? '' : this.movesList[lm][0];
		const lastAxisFace = lm == null ? -1 : this.movesList[lm][1];
		for (let moveIdx = this.sol[depth] || 0; moveIdx < this.movesList.length; moveIdx++) {
			const moveArgs = this.movesList[moveIdx];
			const axisface = moveArgs[1] ^ lastAxisFace;
			const move = moveArgs[0];
			if (axisface === 0 || ((axisface & 0xf) === 0 && move <= lastMove)) continue;
			const newState = this.doMove(state, move);
			if (!newState || newState === state) continue;
			this.sol[depth] = moveIdx;
			if (this.idaSearch(newState, maxl - 1, moveIdx, depth + 1)) return true;
			this.sol.pop();
		}
		return false;
	}
}

// ==================== Random Number Utilities ====================

export function rn(n: number): number {
	return ~~(Math.random() * n);
}

export function rndEl<T>(x: T[]): T {
	return x[~~(Math.random() * x.length)];
}

export function rndHit(prob: number): boolean {
	return Math.random() < prob;
}

export function rndPerm(n: number, isEven?: boolean): number[] {
	const arr: number[] = [];
	let p = 0;
	for (let i = 0; i < n; i++) arr[i] = i;
	for (let i = 0; i < n - 1; i++) {
		const k = rn(n - i);
		if (k !== 0) {
			const tmp = arr[i];
			arr[i] = arr[i + k];
			arr[i + k] = tmp;
			p ^= 1;
		}
	}
	if (isEven && p) {
		const tmp = arr[0];
		arr[0] = arr[1];
		arr[1] = tmp;
	}
	return arr;
}

export function rndProb(plist: number[]): number {
	let cum = 0;
	let curIdx = 0;
	for (let i = 0; i < plist.length; i++) {
		if (plist[i] === 0) continue;
		if (Math.random() < plist[i] / (cum + plist[i])) {
			curIdx = i;
		}
		cum += plist[i];
	}
	return curIdx;
}

// ==================== Utility Functions ====================

export function valuedArray(len: number, val: number | ((i: number) => number)): number[] {
	const ret: number[] = [];
	const isFun = typeof val === 'function';
	for (let i = 0; i < len; i++) {
		ret[i] = isFun ? (val as (i: number) => number)(i) : (val as number);
	}
	return ret;
}

export function idxArray<T>(arr: T[][], idx: number): T[] {
	return arr.map((elem) => elem[idx]);
}

export function permOriMult(
	p1: number[], p2: number[], prod: number[],
	o1?: number[], o2?: number[], ori?: number[], oriMod?: number
): void {
	for (let i = 0; i < p2.length; i++) {
		if (oriMod && ori && o1 && o2) {
			ori[i] = (o1[p2[i]] + o2[i]) % oriMod;
		}
		prod[i] = p1[p2[i]];
	}
}

export const SOLVED_FACELET = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';
