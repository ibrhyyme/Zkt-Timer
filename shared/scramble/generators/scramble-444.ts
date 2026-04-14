/**
 * 4x4x4 random-state scramble generator.
 * Ported from cstimer scramble_444.js (GPLv3) — https://github.com/cs0x7f/cstimer
 *
 * Coordinate-based IDA* solver with 3 phases:
 *   Phase 1: Center reduction (UD/FB/RL center symmetry coordinate)
 *   Phase 2: Edge pairing + center refinement
 *   Phase 3: Reduce to 3x3x3 (edge permutation + center + parity)
 * Final: Solve the resulting 3x3x3 via min2phase
 *
 * Supports: 444wca, 444ll, 444ell, 444edo, 444cto, 444ctud, 444ud3c,
 *           444l8e, 444ctrl, 444rlda, 444rlca
 */

import {
	Cnk, circle, setNPerm, bitCount, rn, rndPerm, acycle
} from '../lib/mathlib';
import { solve as solvFacelet333 } from '../lib/min2phase';
import { registerGenerator } from '../registry';

// ==================== Constants ====================

const PHASE1_SOLS = 10000;
const PHASE2_ATTS = 500;
const PHASE2_SOLS = 100;
const MAX_SEARCH_DEPTH = 60;
const EDGE3_MAX_PRUN = 10;

// ==================== Utility Functions ====================

function createArray(length1: number, length2?: number): any[] {
	const result = new Array(length1);
	if (length2 !== undefined) {
		for (let i = 0; i < length1; i++) {
			result[i] = new Array(length2);
		}
	}
	return result;
}

function fill_0(a: number[]): void {
	for (let i = 0; i < a.length; i++) {
		a[i] = -1;
	}
}

function binarySearch_0(sortedArray: number[], key: number): number {
	let low = 0;
	let high = sortedArray.length - 1;
	while (low <= high) {
		const mid = low + ((high - low) >> 1);
		const midVal = sortedArray[mid];
		if (midVal < key) {
			low = mid + 1;
		} else if (midVal > key) {
			high = mid - 1;
		} else {
			return mid;
		}
	}
	return -low - 1;
}

function swap(arr: number[], a: number, b: number, c: number, d: number, key: number): void {
	let temp: number;
	switch (key) {
		case 0:
			temp = arr[d];
			arr[d] = arr[c];
			arr[c] = arr[b];
			arr[b] = arr[a];
			arr[a] = temp;
			return;
		case 1:
			temp = arr[a];
			arr[a] = arr[c];
			arr[c] = temp;
			temp = arr[b];
			arr[b] = arr[d];
			arr[d] = temp;
			return;
		case 2:
			temp = arr[a];
			arr[a] = arr[b];
			arr[b] = arr[c];
			arr[c] = arr[d];
			arr[d] = temp;
			return;
	}
}

function parity_0(arr: number[]): number {
	let parity = 0;
	let mask = 0;
	for (let i = 0; i < arr.length; i++) {
		const val = arr[i];
		parity ^= val - bitCount(mask & ((1 << val) - 1));
		mask |= 1 << val;
	}
	return parity & 1;
}

// ==================== 2-bit Pruning (Edge3-specific) ====================

function setPruning2(table: Int32Array | number[], index: number, value: number): void {
	(table as any)[index >> 4] ^= (3 ^ value) << ((index & 15) << 1);
}

function getPruning2(table: Int32Array | number[], index: number): number {
	return (table as any)[index >> 4] >> ((index & 15) << 1) & 3;
}

// ==================== Center1 (Phase 1 Symmetry Coordinate) ====================

let Center1SymMove: number[][];
let Center1Sym2Raw: number[];
let Center1SymPrun: number[];
let SymMult: number[][];
let SymMove: number[][];
let SymInv: number[];
let finish_0: number[];
let Center1Raw2Sym: number[] | null = null;
let Center1RotPerm: number[][];

class Center1 {
	ct: number[];

	constructor(cc?: Center1) {
		if (cc) {
			this.ct = cc.ct.slice();
			return;
		}
		this.ct = [];
		for (let i = 0; i < 24; ++i) {
			this.ct[i] = i < 8 ? 1 : 0;
		}
	}

	fromCube(cc: CenterCube, urf: number): this {
		for (let i = 0; i < 24; ++i) {
			this.ct[i] = cc.ct[i] % 3 === urf ? 1 : 0;
		}
		return this;
	}
}

function center1Equals(obj: Center1, c: Center1): boolean {
	for (let i = 0; i < 24; ++i) {
		if (obj.ct[i] !== c.ct[i]) {
			return false;
		}
	}
	return true;
}

function center1GetRaw(obj: Center1): number {
	let idx = 0;
	let r = 8;
	for (let i = 23; i >= 0; --i) {
		if (obj.ct[i] === 1) {
			idx += Cnk[i][r--];
		}
	}
	return idx;
}

function getCenter1RotThres(obj: Center1, rotPerm: number[], thres: number): number {
	let idx = 0;
	let r = 8;
	for (let i = 23; i >= 0; --i) {
		if (obj.ct[rotPerm[i]] === 1) {
			idx += Cnk[i][r--];
		}
		if (idx >= thres) {
			return -1;
		}
	}
	return idx;
}

function center1GetSym(obj: Center1): number {
	if (Center1Raw2Sym != null) {
		for (let s = 0; s < 48; s++) {
			const idx = getCenter1RotThres(obj, Center1RotPerm[s], Cnk[21][8]);
			if (idx !== -1) {
				const ret = Center1Raw2Sym[idx];
				return ret & ~0x3f | SymMult[s][ret & 0x3f];
			}
		}
	}
	for (let j = 0; j < 48; ++j) {
		const cord = raw2sym_0(center1GetRaw(obj));
		if (cord !== -1) {
			return cord * 64 + j;
		}
		center1Rot(obj, 0);
		if (j % 2 === 1) center1Rot(obj, 1);
		if (j % 8 === 7) center1Rot(obj, 2);
		if (j % 16 === 15) center1Rot(obj, 3);
	}
	return 0; // should never reach
}

function doMoveCenter1(obj: Center1, m_0: number): void {
	doMoveCenterCube_generic(obj.ct, m_0);
}

function center1Rot(obj: Center1, r: number): void {
	switch (r) {
		case 0:
			doMoveCenter1(obj, 19);
			doMoveCenter1(obj, 28);
			break;
		case 1:
			doMoveCenter1(obj, 21);
			doMoveCenter1(obj, 32);
			break;
		case 2:
			swap(obj.ct, 0, 3, 1, 2, 1);
			swap(obj.ct, 8, 11, 9, 10, 1);
			swap(obj.ct, 4, 7, 5, 6, 1);
			swap(obj.ct, 12, 15, 13, 14, 1);
			swap(obj.ct, 16, 19, 21, 22, 1);
			swap(obj.ct, 17, 18, 20, 23, 1);
			break;
		case 3:
			doMoveCenter1(obj, 18);
			doMoveCenter1(obj, 29);
			doMoveCenter1(obj, 24);
			doMoveCenter1(obj, 35);
			break;
	}
}

function center1Rotate(obj: Center1, r: number): void {
	for (let j = 0; j < r; ++j) {
		center1Rot(obj, 0);
		if (j % 2 === 1) center1Rot(obj, 1);
		if (j % 8 === 7) center1Rot(obj, 2);
		if (j % 16 === 15) center1Rot(obj, 3);
	}
}

function center1SetIdx(obj: Center1, idx: number): void {
	let r = 8;
	for (let i = 23; i >= 0; --i) {
		obj.ct[i] = 0;
		if (idx >= Cnk[i][r]) {
			idx -= Cnk[i][r--];
			obj.ct[i] = 1;
		}
	}
}

function center1Copy(obj: Center1, c: Center1): void {
	for (let i = 0; i < 24; ++i) {
		obj.ct[i] = c.ct[i];
	}
}

function raw2sym_0(n: number): number {
	const m_0 = binarySearch_0(Center1Sym2Raw, n);
	return m_0 >= 0 ? m_0 : -1;
}

function initCenter1MoveTable(): void {
	const c = new Center1();
	const d = new Center1();
	for (let i = 0; i < 15582; ++i) {
		center1SetIdx(d, Center1Sym2Raw[i]);
		for (let m = 0; m < 36; ++m) {
			if (m % 3 === 1 || Center1SymMove[i][m] !== undefined) {
				continue;
			}
			center1Copy(c, d);
			doMoveCenter1(c, m);
			const idx = center1GetSym(c);
			Center1SymMove[i][m] = idx;
			const invM = SymMove[idx & 0x3f][~~(m / 3) * 3 + 2 - m % 3];
			if (Center1SymMove[idx >> 6][invM] === undefined) {
				Center1SymMove[idx >> 6][invM] = i << 6 | SymInv[idx & 0x3f];
			}
		}
	}
	for (let i = 0; i < 15582; i++) {
		for (let m = 0; m < 36; m += 3) {
			const idx = Center1SymMove[i][m];
			const nextM = SymMove[idx & 0x3f][m];
			const nextIdx = Center1SymMove[idx >>> 6][nextM];
			const symx = SymMult[idx & 0x3f][nextIdx & 0x3f];
			Center1SymMove[i][m + 1] = nextIdx & ~0x3f | symx;
		}
	}
}

function initCenter1Prun(): void {
	fill_0(Center1SymPrun);
	Center1SymPrun[0] = 0;
	let depth = 0;
	let done = 1;
	while (done !== 15582) {
		const inv = depth > 4;
		const select = inv ? -1 : depth;
		const check = inv ? depth : -1;
		++depth;
		for (let i = 0; i < 15582; ++i) {
			if (Center1SymPrun[i] !== select) {
				continue;
			}
			for (let m_0 = 0; m_0 < 27; ++m_0) {
				const idx = Center1SymMove[i][m_0] >>> 6;
				if (Center1SymPrun[idx] !== check) {
					continue;
				}
				++done;
				if (inv) {
					Center1SymPrun[i] = depth;
					break;
				} else {
					Center1SymPrun[idx] = depth;
				}
			}
		}
	}
}

function getSolvedSym(cube: CenterCube): number {
	const c = new Center1();
	for (let i = 0; i < 24; ++i) {
		c.ct[i] = cube.ct[i];
	}
	for (let j = 0; j < 48; ++j) {
		let check = true;
		for (let i = 0; i < 24; ++i) {
			if (c.ct[i] !== (centerFacelet[i] >> 4)) {
				check = false;
				break;
			}
		}
		if (check) {
			return j;
		}
		center1Rot(c, 0);
		if (j % 2 === 1) center1Rot(c, 1);
		if (j % 8 === 7) center1Rot(c, 2);
		if (j % 16 === 15) center1Rot(c, 3);
	}
	return -1;
}

function initSymMeta(): void {
	const c = new Center1();
	for (let i = 0; i < 24; ++i) {
		c.ct[i] = i;
	}
	const d = new Center1(c);
	const e = new Center1(c);
	const f = new Center1(c);
	for (let i = 0; i < 48; ++i) {
		for (let j = 0; j < 48; ++j) {
			for (let k_0 = 0; k_0 < 48; ++k_0) {
				if (center1Equals(c, d)) {
					SymMult[i][j] = k_0;
					if (k_0 === 0) SymInv[i] = j;
				}
				center1Rot(d, 0);
				if (k_0 % 2 === 1) center1Rot(d, 1);
				if (k_0 % 8 === 7) center1Rot(d, 2);
				if (k_0 % 16 === 15) center1Rot(d, 3);
			}
			center1Rot(c, 0);
			if (j % 2 === 1) center1Rot(c, 1);
			if (j % 8 === 7) center1Rot(c, 2);
			if (j % 16 === 15) center1Rot(c, 3);
		}
		center1Rot(c, 0);
		if (i % 2 === 1) center1Rot(c, 1);
		if (i % 8 === 7) center1Rot(c, 2);
		if (i % 16 === 15) center1Rot(c, 3);
	}
	for (let i = 0; i < 48; ++i) {
		center1Copy(c, e);
		center1Rotate(c, SymInv[i]);
		for (let j = 0; j < 36; ++j) {
			center1Copy(d, c);
			doMoveCenter1(d, j);
			center1Rotate(d, i);
			for (let k_0 = 0; k_0 < 36; ++k_0) {
				center1Copy(f, e);
				doMoveCenter1(f, k_0);
				if (center1Equals(f, d)) {
					SymMove[i][j] = k_0;
					break;
				}
			}
		}
	}
	center1SetIdx(c, 0);
	for (let i = 0; i < 48; ++i) {
		finish_0[SymInv[i]] = center1GetRaw(c);
		center1Rot(c, 0);
		if (i % 2 === 1) center1Rot(c, 1);
		if (i % 8 === 7) center1Rot(c, 2);
		if (i % 16 === 15) center1Rot(c, 3);
	}
}

function initCenter1Sym2Raw(): void {
	const c = new Center1();
	const d = new Center1();

	Center1RotPerm = [];
	for (let i = 0; i < 24; i++) {
		c.ct[i] = i;
	}
	for (let s = 0; s < 48; s++) {
		Center1RotPerm[s] = c.ct.slice();
		center1Rot(c, 0);
		if (s % 2 === 1) center1Rot(c, 1);
		if (s % 8 === 7) center1Rot(c, 2);
		if (s % 16 === 15) center1Rot(c, 3);
	}

	const occ = createArray(22984);
	for (let i = 0; i < 22984; i++) {
		occ[i] = 0;
	}
	let count = 0;
	for (let i = 0; i < Cnk[21][8]; ++i) {
		if ((occ[i >>> 5] & 1 << (i & 31)) === 0) {
			center1SetIdx(c, i);
			for (let j = 0; j < 48; ++j) {
				const idx = getCenter1RotThres(c, Center1RotPerm[j], Cnk[21][8]);
				if (idx === -1) {
					continue;
				}
				occ[idx >>> 5] |= 1 << (idx & 31);
				if (Center1Raw2Sym != null) {
					Center1Raw2Sym[idx] = count << 6 | SymInv[j];
				}
			}
			Center1Sym2Raw[count++] = i;
		}
	}
}

// ==================== Center2 (Phase 2 Center) ====================

let rlmv: number[][];
let ctmv: number[][];
let rlrot: number[][];
let ctrot: number[][];
let ctprun: number[];
let pmv: number[];

class Center2 {
	rl: number[];
	ct: number[];
	parity: number;

	constructor() {
		this.rl = createArray(8);
		this.ct = createArray(16);
		this.parity = 0;
	}

	copy(obj: Center2): void {
		for (let i = 0; i < 8; i++) {
			this.rl[i] = obj.rl[i];
		}
		for (let i = 0; i < 16; i++) {
			this.ct[i] = obj.ct[i];
		}
		this.parity = obj.parity;
	}
}

function center2GetCt(obj: Center2): number {
	let idx = 0;
	let r = 8;
	for (let i = 14; i >= 0; --i) {
		if (obj.ct[i] !== obj.ct[15]) {
			idx += Cnk[i][r--];
		}
	}
	return idx;
}

function center2GetRl(obj: Center2): number {
	let idx = 0;
	let r = 4;
	for (let i = 6; i >= 0; --i) {
		if (obj.rl[i] !== obj.rl[7]) {
			idx += Cnk[i][r--];
		}
	}
	return idx * 2 + obj.parity;
}

function doMoveCenter2(obj: Center2, m_0: number): void {
	obj.parity ^= pmv[m_0];
	const key = m_0 % 3;
	m_0 = ~~(m_0 / 3);
	switch (m_0) {
		case 0:
			swap(obj.ct, 0, 1, 2, 3, key);
			break;
		case 1:
			swap(obj.rl, 0, 1, 2, 3, key);
			break;
		case 2:
			swap(obj.ct, 8, 9, 10, 11, key);
			break;
		case 3:
			swap(obj.ct, 4, 5, 6, 7, key);
			break;
		case 4:
			swap(obj.rl, 4, 5, 6, 7, key);
			break;
		case 5:
			swap(obj.ct, 12, 13, 14, 15, key);
			break;
		case 6:
			swap(obj.ct, 0, 1, 2, 3, key);
			swap(obj.rl, 0, 5, 4, 1, key);
			swap(obj.ct, 8, 9, 12, 13, key);
			break;
		case 7:
			swap(obj.rl, 0, 1, 2, 3, key);
			swap(obj.ct, 1, 15, 5, 9, key);
			swap(obj.ct, 2, 12, 6, 10, key);
			break;
		case 8:
			swap(obj.ct, 8, 9, 10, 11, key);
			swap(obj.rl, 0, 3, 6, 5, key);
			swap(obj.ct, 3, 2, 5, 4, key);
			break;
		case 9:
			swap(obj.ct, 4, 5, 6, 7, key);
			swap(obj.rl, 3, 2, 7, 6, key);
			swap(obj.ct, 11, 10, 15, 14, key);
			break;
		case 10:
			swap(obj.rl, 4, 5, 6, 7, key);
			swap(obj.ct, 0, 8, 4, 14, key);
			swap(obj.ct, 3, 11, 7, 13, key);
			break;
		case 11:
			swap(obj.ct, 12, 13, 14, 15, key);
			swap(obj.rl, 1, 4, 7, 2, key);
			swap(obj.ct, 1, 0, 7, 6, key);
			break;
	}
}

function center2Rot(obj: Center2, r: number): void {
	switch (r) {
		case 0:
			doMoveCenter2(obj, 19);
			doMoveCenter2(obj, 28);
			break;
		case 1:
			doMoveCenter2(obj, 21);
			doMoveCenter2(obj, 32);
			break;
		case 2:
			swap(obj.ct, 0, 3, 1, 2, 1);
			swap(obj.ct, 8, 11, 9, 10, 1);
			swap(obj.ct, 4, 7, 5, 6, 1);
			swap(obj.ct, 12, 15, 13, 14, 1);
			swap(obj.rl, 0, 3, 5, 6, 1);
			swap(obj.rl, 1, 2, 4, 7, 1);
			break;
	}
}

function center2Set(obj: Center2, c: CenterCube, edgeParity: number): void {
	for (let i = 0; i < 16; ++i) {
		obj.ct[i] = c.ct[i] % 3;
	}
	for (let i = 0; i < 8; ++i) {
		obj.rl[i] = c.ct[i + 16];
	}
	obj.parity = edgeParity;
}

function center2SetCt(obj: Center2, idx: number): void {
	let r = 8;
	obj.ct[15] = 0;
	for (let i = 14; i >= 0; --i) {
		if (idx >= Cnk[i][r]) {
			idx -= Cnk[i][r--];
			obj.ct[i] = 1;
		} else {
			obj.ct[i] = 0;
		}
	}
}

function center2SetRl(obj: Center2, idx: number): void {
	obj.parity = idx & 1;
	idx >>>= 1;
	let r = 4;
	obj.rl[7] = 0;
	for (let i = 6; i >= 0; --i) {
		if (idx >= Cnk[i][r]) {
			idx -= Cnk[i][r--];
			obj.rl[i] = 1;
		} else {
			obj.rl[i] = 0;
		}
	}
}

function initCenter2(): void {
	const c = new Center2();
	const d = new Center2();
	for (let i = 0; i < 70; ++i) {
		for (let m_0 = 0; m_0 < 28; ++m_0) {
			center2SetRl(c, i);
			doMoveCenter2(c, move2std[m_0]);
			rlmv[i][m_0] = center2GetRl(c);
		}
	}
	for (let i = 0; i < 70; ++i) {
		center2SetRl(c, i);
		for (let j = 0; j < 16; ++j) {
			rlrot[i][j] = center2GetRl(c);
			center2Rot(c, 0);
			if (j % 2 === 1) center2Rot(c, 1);
			if (j % 8 === 7) center2Rot(c, 2);
		}
	}
	for (let i = 0; i < 6435; ++i) {
		center2SetCt(c, i);
		for (let j = 0; j < 16; ++j) {
			ctrot[i][j] = center2GetCt(c);
			center2Rot(c, 0);
			if (j % 2 === 1) center2Rot(c, 1);
			if (j % 8 === 7) center2Rot(c, 2);
		}
	}
	for (let i = 0; i < 6435; ++i) {
		center2SetCt(c, i);
		for (let m_0 = 0; m_0 < 28; ++m_0) {
			d.copy(c);
			doMoveCenter2(d, move2std[m_0]);
			ctmv[i][m_0] = center2GetCt(d);
		}
	}
	fill_0(ctprun);
	ctprun[0] = ctprun[18] = ctprun[28] = ctprun[46] = ctprun[54] = ctprun[56] = 0;
	let depth = 0;
	let done = 6;

	while (done !== 450450) {
		const inv = depth > 6;
		const select = inv ? -1 : depth;
		const check = inv ? depth : -1;
		++depth;
		for (let i = 0; i < 450450; ++i) {
			if (ctprun[i] !== select) {
				continue;
			}
			const ct = ~~(i / 70);
			const rl = i % 70;
			for (let m_0 = 0; m_0 < 23; ++m_0) {
				const ctx = ctmv[ct][m_0];
				const rlx = rlmv[rl][m_0];
				const idx = ctx * 70 + rlx;
				if (ctprun[idx] !== check) {
					continue;
				}
				++done;
				if (inv) {
					ctprun[i] = depth;
					break;
				} else {
					ctprun[idx] = depth;
				}
			}
		}
	}
}

// ==================== Center3 (Phase 3 Center) ====================

let ctmove: number[][];
let pmove: number[];
let prun_0: number[];
let rl2std: number[];
let std2rl: number[];

class Center3 {
	ud: number[];
	rl: number[];
	fb: number[];
	parity: number;

	constructor() {
		this.ud = createArray(8);
		this.rl = createArray(8);
		this.fb = createArray(8);
		this.parity = 0;
	}

	copy(obj: Center3): void {
		for (let i = 0; i < 8; i++) {
			this.ud[i] = obj.ud[i];
			this.rl[i] = obj.rl[i];
			this.fb[i] = obj.fb[i];
		}
		this.parity = obj.parity;
	}
}

function center3GetCt(obj: Center3): number {
	let idx = 0;
	let r = 4;
	for (let i = 6; i >= 0; --i) {
		if (obj.ud[i] !== obj.ud[7]) {
			idx += Cnk[i][r--];
		}
	}
	idx *= 35;
	r = 4;
	for (let i = 6; i >= 0; --i) {
		if (obj.fb[i] !== obj.fb[7]) {
			idx += Cnk[i][r--];
		}
	}
	idx *= 12;
	const check = obj.fb[7] ^ obj.ud[7];
	let idxrl = 0;
	r = 4;
	for (let i = 7; i >= 0; --i) {
		if (obj.rl[i] !== check) {
			idxrl += Cnk[i][r--];
		}
	}
	return obj.parity + 2 * (idx + std2rl[idxrl]);
}

function doMoveCenter3(obj: Center3, i: number): void {
	obj.parity ^= pmove[i];
	switch (i) {
		case 0:
		case 1:
		case 2:
			swap(obj.ud, 0, 1, 2, 3, i % 3);
			break;
		case 3:
			swap(obj.rl, 0, 1, 2, 3, 1);
			break;
		case 4:
		case 5:
		case 6:
			swap(obj.fb, 0, 1, 2, 3, (i - 1) % 3);
			break;
		case 7:
		case 8:
		case 9:
			swap(obj.ud, 4, 5, 6, 7, (i - 1) % 3);
			break;
		case 10:
			swap(obj.rl, 4, 5, 6, 7, 1);
			break;
		case 11:
		case 12:
		case 13:
			swap(obj.fb, 4, 5, 6, 7, (i + 1) % 3);
			break;
		case 14:
			swap(obj.ud, 0, 1, 2, 3, 1);
			swap(obj.rl, 0, 5, 4, 1, 1);
			swap(obj.fb, 0, 5, 4, 1, 1);
			break;
		case 15:
			swap(obj.rl, 0, 1, 2, 3, 1);
			swap(obj.fb, 1, 4, 7, 2, 1);
			swap(obj.ud, 1, 6, 5, 2, 1);
			break;
		case 16:
			swap(obj.fb, 0, 1, 2, 3, 1);
			swap(obj.ud, 3, 2, 5, 4, 1);
			swap(obj.rl, 0, 3, 6, 5, 1);
			break;
		case 17:
			swap(obj.ud, 4, 5, 6, 7, 1);
			swap(obj.rl, 3, 2, 7, 6, 1);
			swap(obj.fb, 3, 2, 7, 6, 1);
			break;
		case 18:
			swap(obj.rl, 4, 5, 6, 7, 1);
			swap(obj.fb, 0, 3, 6, 5, 1);
			swap(obj.ud, 0, 3, 4, 7, 1);
			break;
		case 19:
			swap(obj.fb, 4, 5, 6, 7, 1);
			swap(obj.ud, 0, 7, 6, 1, 1);
			swap(obj.rl, 1, 4, 7, 2, 1);
			break;
	}
}

function center3Set(obj: Center3, c: CenterCube, eXc_parity: number): void {
	const a = c.ct[0] % 3, b = c.ct[8] % 3, cc = c.ct[16] % 3;
	const p = ((a > b ? 1 : 0) ^ (b > cc ? 1 : 0) ^ (a > cc ? 1 : 0)) ? 0 : 1;
	for (let i = 0; i < 8; ++i) {
		obj.ud[i] = ~~(c.ct[i] / 3) ^ 1;
		obj.fb[i] = ~~(c.ct[i + 8] / 3) ^ 1;
		obj.rl[i] = ~~(c.ct[i + 16] / 3) ^ 1 ^ p;
	}
	obj.parity = p ^ eXc_parity;
}

function center3SetCtFull(obj: Center3, origIdx: number): void {
	obj.parity = origIdx & 1;
	let idx = origIdx >>> 1;
	let idxrl = rl2std[idx % 12];
	idx = ~~(idx / 12);
	let r = 4;
	for (let i = 7; i >= 0; --i) {
		obj.rl[i] = 0;
		if (idxrl >= Cnk[i][r]) {
			idxrl -= Cnk[i][r--];
			obj.rl[i] = 1;
		}
	}
	let idxfb = idx % 35;
	idx = ~~(idx / 35);
	r = 4;
	obj.fb[7] = 0;
	for (let i = 6; i >= 0; --i) {
		if (idxfb >= Cnk[i][r]) {
			idxfb -= Cnk[i][r--];
			obj.fb[i] = 1;
		} else {
			obj.fb[i] = 0;
		}
	}
	r = 4;
	obj.ud[7] = 0;
	for (let i = 6; i >= 0; --i) {
		if (idx >= Cnk[i][r]) {
			idx -= Cnk[i][r--];
			obj.ud[i] = 1;
		} else {
			obj.ud[i] = 0;
		}
	}
}

function initCenter3(): void {
	for (let i = 0; i < 12; ++i) {
		std2rl[rl2std[i]] = i;
	}
	const c = new Center3();
	const d = new Center3();
	for (let i = 0; i < 29400; ++i) {
		center3SetCtFull(c, i);
		for (let m_0 = 0; m_0 < 20; ++m_0) {
			d.copy(c);
			doMoveCenter3(d, m_0);
			ctmove[i][m_0] = center3GetCt(d);
		}
	}
	fill_0(prun_0);
	prun_0[0] = 0;
	let depth = 0;
	let done = 1;
	while (done !== 29400) {
		for (let i = 0; i < 29400; ++i) {
			if (prun_0[i] !== depth) {
				continue;
			}
			for (let m_0 = 0; m_0 < 17; ++m_0) {
				if (prun_0[ctmove[i][m_0]] === -1) {
					prun_0[ctmove[i][m_0]] = depth + 1;
					++done;
				}
			}
		}
		++depth;
	}
}

// ==================== CenterCube (Full Center State) ====================

const centerFacelet = [5, 6, 10, 9, 53, 54, 58, 57, 37, 38, 42, 41, 85, 86, 90, 89, 21, 22, 26, 25, 69, 70, 74, 73];

function doMoveCenterCube_generic(ct: number[], m_0: number): void {
	const key = m_0 % 3;
	m_0 = ~~(m_0 / 3);
	switch (m_0) {
		case 6: // u
			swap(ct, 8, 20, 12, 16, key);
			swap(ct, 9, 21, 13, 17, key);
		// falls through
		case 0: // U
			swap(ct, 0, 1, 2, 3, key);
			break;
		case 7: // r
			swap(ct, 1, 15, 5, 9, key);
			swap(ct, 2, 12, 6, 10, key);
		// falls through
		case 1: // R
			swap(ct, 16, 17, 18, 19, key);
			break;
		case 8: // f
			swap(ct, 2, 19, 4, 21, key);
			swap(ct, 3, 16, 5, 22, key);
		// falls through
		case 2: // F
			swap(ct, 8, 9, 10, 11, key);
			break;
		case 9: // d
			swap(ct, 10, 18, 14, 22, key);
			swap(ct, 11, 19, 15, 23, key);
		// falls through
		case 3: // D
			swap(ct, 4, 5, 6, 7, key);
			break;
		case 10: // l
			swap(ct, 0, 8, 4, 14, key);
			swap(ct, 3, 11, 7, 13, key);
		// falls through
		case 4: // L
			swap(ct, 20, 21, 22, 23, key);
			break;
		case 11: // b
			swap(ct, 1, 20, 7, 18, key);
			swap(ct, 0, 23, 6, 17, key);
		// falls through
		case 5: // B
			swap(ct, 12, 13, 14, 15, key);
			break;
	}
}

class CenterCube {
	ct: number[];

	constructor() {
		this.ct = [];
		for (let i = 0; i < 24; ++i) {
			this.ct[i] = centerFacelet[i] >> 4;
		}
	}
}

function doMoveCenterCube(obj: CenterCube, m_0: number): void {
	doMoveCenterCube_generic(obj.ct, m_0);
}

function copyCenterCube(obj: CenterCube, c: CenterCube): void {
	for (let i = 0; i < 24; ++i) {
		obj.ct[i] = c.ct[i];
	}
}

// ==================== CornerCube ====================

let CornerMoveCube: CornerCube[];

const cornerFacelet_0 = [
	[8, 9, 20],
	[6, 18, 38],
	[0, 36, 47],
	[2, 45, 11],
	[29, 26, 15],
	[27, 44, 24],
	[33, 53, 42],
	[35, 17, 51]
];

class CornerCube {
	cp: number[];
	co: number[];
	temps: CornerCube | null;

	constructor(cperm?: number, twist?: number) {
		this.cp = [0, 1, 2, 3, 4, 5, 6, 7];
		this.co = [0, 0, 0, 0, 0, 0, 0, 0];
		this.temps = null;
		if (cperm !== undefined && twist !== undefined) {
			setNPerm(this.cp, cperm, 8);
			this.setTwist(twist);
		}
	}

	setTwist(idx: number): void {
		let twst = 0;
		for (let i = 6; i >= 0; --i) {
			twst += this.co[i] = idx % 3;
			idx = ~~(idx / 3);
		}
		this.co[7] = (15 - twst) % 3;
	}

	copy(c: CornerCube): void {
		for (let i = 0; i < 8; ++i) {
			this.cp[i] = c.cp[i];
			this.co[i] = c.co[i];
		}
	}

	move(idx: number): void {
		if (!this.temps) this.temps = new CornerCube();
		cornMult(this, CornerMoveCube[idx], this.temps);
		this.copy(this.temps);
	}
}

function cornMult(a: CornerCube, b: CornerCube, prod: CornerCube): void {
	for (let corn = 0; corn < 8; ++corn) {
		prod.cp[corn] = a.cp[b.cp[corn]];
		const oriA = a.co[b.cp[corn]];
		const oriB = b.co[corn];
		let ori = oriA;
		ori = ori + (oriA < 3 ? oriB : 6 - oriB);
		ori = ori % 3;
		if ((oriA >= 3) !== (oriB >= 3)) ori = ori + 3;
		prod.co[corn] = ori;
	}
}

function initCornerMoves(): void {
	CornerMoveCube = createArray(18);
	CornerMoveCube[0] = new CornerCube(15120, 0);
	CornerMoveCube[3] = new CornerCube(21021, 1494);
	CornerMoveCube[6] = new CornerCube(8064, 1236);
	CornerMoveCube[9] = new CornerCube(9, 0);
	CornerMoveCube[12] = new CornerCube(1230, 412);
	CornerMoveCube[15] = new CornerCube(224, 137);
	for (let a = 0; a < 18; a += 3) {
		for (let p_0 = 0; p_0 < 2; ++p_0) {
			CornerMoveCube[a + p_0 + 1] = new CornerCube();
			cornMult(CornerMoveCube[a + p_0], CornerMoveCube[a], CornerMoveCube[a + p_0 + 1]);
		}
	}
}

// ==================== Edge3 (Phase 3 Edge) ====================

const prunValues = [1, 4, 16, 55, 324, 1922, 12275, 77640, 485359, 2778197, 11742425, 27492416, 31002941, 31006080];
let Edge3Prun: Int32Array;
let Edge3Sym2Raw: number[];
let Edge3Sym2Mask: number[];
let symstate: number[];
let Edge3Raw2Sym: number[];
const syminv_0 = [0, 1, 6, 3, 4, 5, 2, 7];
let mvrot: number[][];
let mvroto: number[][];
const factX = [1, 1, 1, 3, 12, 60, 360, 2520, 20160, 181440, 1814400, 19958400, 239500800];
const FullEdgeMap = [0, 2, 4, 6, 1, 3, 7, 5, 8, 9, 10, 11];

class Edge3 {
	edge: number[];
	edgeo: number[];
	isStd: boolean;
	temp: number[] | null;

	constructor() {
		this.edge = createArray(12);
		this.edgeo = createArray(12);
		this.isStd = true;
		this.temp = null;
	}
}

function edge3Circlex(obj: Edge3, a: number, b: number, c: number, d: number): void {
	const temp = obj.edgeo[d];
	obj.edgeo[d] = obj.edge[c];
	obj.edge[c] = obj.edgeo[b];
	obj.edgeo[b] = obj.edge[a];
	obj.edge[a] = temp;
}

function edge3Get(obj: Edge3, end: number, returnMask?: boolean): number {
	if (!obj.isStd) edge3Std(obj);
	return get12Perm(obj.edge, end, returnMask);
}

function get12Perm(arr: number[], end: number, returnMask?: boolean): number {
	let idx = 0;
	let mask = 0;
	for (let i = 0; i < end; i++) {
		const val = arr[i];
		idx = idx * (12 - i) + val - bitCount(mask & ((1 << val) - 1));
		mask |= 1 << val;
	}
	return returnMask ? mask : idx;
}

function edge3GetSym(obj: Edge3): number {
	if (!obj.isStd) edge3Std(obj);
	return getMvSym(obj.edge, 20) >> 3;
}

function edge3Swap(arr: number[], a: number, b: number, c: number, d: number): void {
	let temp = arr[a];
	arr[a] = arr[c];
	arr[c] = temp;
	temp = arr[b];
	arr[b] = arr[d];
	arr[d] = temp;
}

function edge3Swapx(obj: Edge3, x: number, y: number): void {
	const temp = obj.edge[x];
	obj.edge[x] = obj.edgeo[y];
	obj.edgeo[y] = temp;
}

function edge3Move(obj: Edge3, i: number): void {
	obj.isStd = false;
	switch (i) {
		case 0:
			circle(obj.edge, 0, 4, 1, 5);
			circle(obj.edgeo, 0, 4, 1, 5);
			break;
		case 1:
			edge3Swap(obj.edge, 0, 4, 1, 5);
			edge3Swap(obj.edgeo, 0, 4, 1, 5);
			break;
		case 2:
			circle(obj.edge, 0, 5, 1, 4);
			circle(obj.edgeo, 0, 5, 1, 4);
			break;
		case 3:
			edge3Swap(obj.edge, 5, 10, 6, 11);
			edge3Swap(obj.edgeo, 5, 10, 6, 11);
			break;
		case 4:
			circle(obj.edge, 0, 11, 3, 8);
			circle(obj.edgeo, 0, 11, 3, 8);
			break;
		case 5:
			edge3Swap(obj.edge, 0, 11, 3, 8);
			edge3Swap(obj.edgeo, 0, 11, 3, 8);
			break;
		case 6:
			circle(obj.edge, 0, 8, 3, 11);
			circle(obj.edgeo, 0, 8, 3, 11);
			break;
		case 7:
			circle(obj.edge, 2, 7, 3, 6);
			circle(obj.edgeo, 2, 7, 3, 6);
			break;
		case 8:
			edge3Swap(obj.edge, 2, 7, 3, 6);
			edge3Swap(obj.edgeo, 2, 7, 3, 6);
			break;
		case 9:
			circle(obj.edge, 2, 6, 3, 7);
			circle(obj.edgeo, 2, 6, 3, 7);
			break;
		case 10:
			edge3Swap(obj.edge, 4, 8, 7, 9);
			edge3Swap(obj.edgeo, 4, 8, 7, 9);
			break;
		case 11:
			circle(obj.edge, 1, 9, 2, 10);
			circle(obj.edgeo, 1, 9, 2, 10);
			break;
		case 12:
			edge3Swap(obj.edge, 1, 9, 2, 10);
			edge3Swap(obj.edgeo, 1, 9, 2, 10);
			break;
		case 13:
			circle(obj.edge, 1, 10, 2, 9);
			circle(obj.edgeo, 1, 10, 2, 9);
			break;
		case 14:
			edge3Swap(obj.edge, 0, 4, 1, 5);
			edge3Swap(obj.edgeo, 0, 4, 1, 5);
			circle(obj.edge, 9, 11);
			circle(obj.edgeo, 8, 10);
			break;
		case 15:
			edge3Swap(obj.edge, 5, 10, 6, 11);
			edge3Swap(obj.edgeo, 5, 10, 6, 11);
			circle(obj.edge, 1, 3);
			circle(obj.edgeo, 0, 2);
			break;
		case 16:
			edge3Swap(obj.edge, 0, 11, 3, 8);
			edge3Swap(obj.edgeo, 0, 11, 3, 8);
			circle(obj.edge, 5, 7);
			circle(obj.edgeo, 4, 6);
			break;
		case 17:
			edge3Swap(obj.edge, 2, 7, 3, 6);
			edge3Swap(obj.edgeo, 2, 7, 3, 6);
			circle(obj.edge, 8, 10);
			circle(obj.edgeo, 9, 11);
			break;
		case 18:
			edge3Swap(obj.edge, 4, 8, 7, 9);
			edge3Swap(obj.edgeo, 4, 8, 7, 9);
			circle(obj.edge, 0, 2);
			circle(obj.edgeo, 1, 3);
			break;
		case 19:
			edge3Swap(obj.edge, 1, 9, 2, 10);
			edge3Swap(obj.edgeo, 1, 9, 2, 10);
			circle(obj.edge, 4, 6);
			circle(obj.edgeo, 5, 7);
			break;
	}
}

function edge3Rot(obj: Edge3, r: number): void {
	obj.isStd = false;
	switch (r) {
		case 0:
			edge3Move(obj, 14);
			edge3Move(obj, 17);
			break;
		case 1:
			edge3Circlex(obj, 11, 5, 10, 6);
			edge3Circlex(obj, 5, 10, 6, 11);
			edge3Circlex(obj, 1, 2, 3, 0);
			edge3Circlex(obj, 4, 9, 7, 8);
			edge3Circlex(obj, 8, 4, 9, 7);
			edge3Circlex(obj, 0, 1, 2, 3);
			break;
		case 2:
			edge3Swapx(obj, 4, 5);
			edge3Swapx(obj, 5, 4);
			edge3Swapx(obj, 11, 8);
			edge3Swapx(obj, 8, 11);
			edge3Swapx(obj, 7, 6);
			edge3Swapx(obj, 6, 7);
			edge3Swapx(obj, 9, 10);
			edge3Swapx(obj, 10, 9);
			edge3Swapx(obj, 1, 1);
			edge3Swapx(obj, 0, 0);
			edge3Swapx(obj, 3, 3);
			edge3Swapx(obj, 2, 2);
			break;
	}
}

function edge3Rotate(obj: Edge3, r: number): void {
	while (r >= 2) {
		r -= 2;
		edge3Rot(obj, 1);
		edge3Rot(obj, 2);
	}
	if (r !== 0) edge3Rot(obj, 0);
}

function edge3SetIdx(obj: Edge3, idx: number): void {
	let vall = 0x76543210;
	let valh = 0xba98;
	let parity = 0;
	for (let i = 0; i < 11; ++i) {
		const p_0 = factX[11 - i];
		let v = ~~(idx / p_0);
		idx = idx % p_0;
		parity ^= v;
		v <<= 2;
		if (v >= 32) {
			v = v - 32;
			obj.edge[i] = valh >> v & 15;
			const m = (1 << v) - 1;
			valh = (valh & m) + ((valh >> 4) & ~m);
		} else {
			obj.edge[i] = vall >> v & 15;
			const m = (1 << v) - 1;
			vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28);
			valh = valh >> 4;
		}
	}
	if ((parity & 1) === 0) {
		obj.edge[11] = vall;
	} else {
		obj.edge[11] = obj.edge[10];
		obj.edge[10] = vall;
	}
	for (let i = 0; i < 12; ++i) {
		obj.edgeo[i] = i;
	}
	obj.isStd = true;
}

function edge3Copy(obj: Edge3, e: Edge3): void {
	for (let i = 0; i < 12; ++i) {
		obj.edge[i] = e.edge[i];
		obj.edgeo[i] = e.edgeo[i];
	}
	obj.isStd = e.isStd;
}

function edge3SetFromEdgeCube(obj: Edge3, c: EdgeCube): number {
	if (obj.temp == null) obj.temp = createArray(12);
	for (let i = 0; i < 12; ++i) {
		obj.temp[i] = i;
		obj.edge[i] = c.ep[FullEdgeMap[i] + 12] % 12;
	}
	let parity = 1;
	for (let i = 0; i < 12; ++i) {
		while (obj.edge[i] !== i) {
			const t = obj.edge[i];
			obj.edge[i] = obj.edge[t];
			obj.edge[t] = t;
			const s = obj.temp[i];
			obj.temp[i] = obj.temp[t];
			obj.temp[t] = s;
			parity ^= 1;
		}
	}
	for (let i = 0; i < 12; ++i) {
		obj.edge[i] = obj.temp[c.ep[FullEdgeMap[i]] % 12];
	}
	return parity;
}

function edge3Std(obj: Edge3): void {
	if (obj.temp == null) obj.temp = createArray(12);
	for (let i = 0; i < 12; ++i) {
		obj.temp[obj.edgeo[i]] = i;
	}
	for (let i = 0; i < 12; ++i) {
		obj.edge[i] = obj.temp[obj.edge[i]];
		obj.edgeo[i] = i;
	}
	obj.isStd = true;
}

let Edge3SymMove: number[][] = [];

function getMvSym(ep: number[], mv: number, assumeIdx?: number): number {
	let mrIdx = mv << 3;
	let idx = 0;
	let mask = 0;
	if (assumeIdx !== undefined && move3std[mv] % 3 === 1) {
		mrIdx |= assumeIdx & 0x7;
		idx = assumeIdx >> 3;
	} else {
		let movo = mvroto[mrIdx];
		let mov = mvrot[mrIdx];
		for (let i = 0; i < 4; i++) {
			const val = movo[ep[mov[i]]];
			idx = idx * (12 - i) + val - bitCount(mask & ((1 << val) - 1));
			mask |= 1 << val;
		}
		idx = Edge3Raw2Sym[idx];
		mrIdx |= idx & 7;
		idx >>= 3;
	}
	const movo = mvroto[mrIdx];
	const mov = mvrot[mrIdx];
	mask = Edge3Sym2Mask[idx];
	for (let i = 4; i < 10; i++) {
		const val = movo[ep[mov[i]]];
		idx = idx * (12 - i) + val - bitCount(mask & ((1 << val) - 1));
		mask |= 1 << val;
	}
	return idx << 3 | mrIdx & 0x7;
}

function getprun(edge: number): number {
	const e = new Edge3();
	let depth = 0;
	let depm3 = getPruning2(Edge3Prun, edge);
	if (depm3 === 3) {
		return EDGE3_MAX_PRUN;
	}
	while (edge !== 0) {
		depm3 = (depm3 + 2) % 3;
		const symcord1 = ~~(edge / 20160);
		const cord1 = Edge3Sym2Raw[symcord1];
		const cord2 = edge % 20160;
		edge3SetIdx(e, cord1 * 20160 + cord2);
		for (let m = 0; m < 17; ++m) {
			const idx = getMvSym(e.edge, m) >> 3;
			if (getPruning2(Edge3Prun, idx) === depm3) {
				++depth;
				edge = idx;
				break;
			}
		}
	}
	return depth;
}

function getprun_0(edge: number, prun: number): number {
	const depm3 = getPruning2(Edge3Prun, edge);
	if (depm3 === 3) {
		return EDGE3_MAX_PRUN;
	}
	return ((0x49249249 << depm3 >> prun) & 3) + prun - 1;
}

function initEdge3MvRot(): void {
	const e = new Edge3();
	for (let m = 0; m < 21; ++m) {
		for (let r = 0; r < 8; ++r) {
			edge3SetIdx(e, 0);
			edge3Move(e, m);
			edge3Rotate(e, r);
			for (let i = 0; i < 12; ++i) {
				mvrot[m << 3 | r][i] = e.edge[i];
			}
			edge3Std(e);
			for (let i = 0; i < 12; ++i) {
				mvroto[m << 3 | r][i] = e.temp![i];
			}
		}
	}
}

function initEdge3Sym2Raw(): void {
	const e = new Edge3();
	const occ = createArray(1485);
	for (let i = 0; i < 1485; i++) {
		occ[i] = 0;
	}
	let count = 0;
	for (let i = 0; i < 11880; ++i) {
		if ((occ[i >>> 3] & 1 << (i & 7)) === 0) {
			edge3SetIdx(e, i * factX[8]);
			Edge3Sym2Raw[count] = i;
			Edge3Sym2Mask[count] = edge3Get(e, 4, true);
			for (let j = 0; j < 8; ++j) {
				const idx = edge3Get(e, 4);
				if (idx === i) symstate[count] = symstate[count] | 1 << j;
				occ[idx >> 3] |= 1 << (idx & 7);
				Edge3Raw2Sym[idx] = count << 3 | syminv_0[j];
				edge3Rot(e, 0);
				if (j % 2 === 1) {
					edge3Rot(e, 1);
					edge3Rot(e, 2);
				}
			}
			count++;
		}
	}
	for (let m = 0; m < 20; m++) {
		Edge3SymMove[m] = [];
	}
	for (let i = 0; i < 1538; i++) {
		edge3SetIdx(e, Edge3Sym2Raw[i] * factX[8]);
		for (let m = 0; m < 20; ++m) {
			if (move3std[m] % 3 !== 1) {
				continue;
			}
			const idx = getMvSym(e.edge, m);
			Edge3SymMove[m][i] = ~~((idx >> 3) / 20160) << 3 | idx & 0x7;
		}
	}
}

function initEdge3Prun(): void {
	const e = new Edge3();
	const f = new Edge3();
	const g = new Edge3();
	Edge3Prun.fill(-1);

	let depth = 0;
	let done = 1;
	setPruning2(Edge3Prun, 0, 0);
	const bfsMoves = [1, 0, 2, 3, 5, 4, 6, 8, 7, 9, 10, 12, 11, 13, 14, 15, 16];
	while (done !== 31006080) {
		const inv = depth > 9;
		const depm3 = depth % 3;
		const dep1m3 = (depth + 1) % 3;
		const dep2m3 = (depth + 2) % 3;
		const find_0 = inv ? 3 : depm3;
		const chk = inv ? depm3 : 3;
		const find_mask = find_0 * 0x55555555;
		if (depth >= EDGE3_MAX_PRUN - 1) {
			break;
		}
		for (let i_ = 0; i_ < 31006080; i_ += 16) {
			let val = Edge3Prun[i_ >> 4];
			const chkmask = val ^ find_mask;
			if (!inv && val === -1 || ((chkmask - 0x55555555) & ~chkmask & 0xaaaaaaaa) === 0) {
				continue;
			}
			for (let i = i_, end = i_ + 16; i < end; ++i, val >>= 2) {
				if ((val & 3) !== find_0) {
					continue;
				}
				const symcord1 = ~~(i / 20160);
				const cord1 = Edge3Sym2Raw[symcord1];
				const cord2 = i % 20160;
				edge3SetIdx(e, cord1 * 20160 + cord2);
				for (let mi = 0; mi < 17; ++mi) {
					const m = bfsMoves[mi];
					let idx = getMvSym(e.edge, m, Edge3SymMove[m][symcord1]);
					const symx = idx & 7;
					idx >>= 3;
					const prun = getPruning2(Edge3Prun, idx);
					if (prun !== chk) {
						if (prun === dep2m3 || prun === depm3 && idx < i) {
							mi = skipAxis3[m];
						}
						continue;
					}
					setPruning2(Edge3Prun, inv ? i : idx, dep1m3);
					++done;
					if (inv) {
						break;
					}
					const symcord1x = ~~(idx / 20160);
					let symState = symstate[symcord1x];
					if (symState === 1) {
						continue;
					}
					edge3Copy(f, e);
					edge3Move(f, m);
					edge3Rotate(f, symx);
					for (let j = 1; (symState = symState >> 1) !== 0; ++j) {
						if ((symState & 1) !== 1) {
							continue;
						}
						edge3Copy(g, f);
						edge3Rotate(g, j);
						const idxx = symcord1x * 20160 + edge3Get(g, 10) % 20160;
						if (getPruning2(Edge3Prun, idxx) === chk) {
							setPruning2(Edge3Prun, idxx, dep1m3);
							++done;
						}
					}
				}
			}
		}
		++depth;
	}
}

// ==================== EdgeCube (Full Edge State) ====================

let epMoveMap: number[][];

class EdgeCube {
	ep: number[];

	constructor() {
		this.ep = [];
		for (let i = 0; i < 24; ++i) {
			this.ep[i] = i;
		}
	}
}

function copyEdge(obj: EdgeCube, c: EdgeCube): void {
	for (let i = 0; i < 24; ++i) {
		obj.ep[i] = c.ep[i];
	}
}

function doMoveEdge(obj: EdgeCube, m_0: number): void {
	const key = m_0 % 3;
	m_0 = ~~(m_0 / 3);
	switch (m_0) {
		case 6:
			swap(obj.ep, 9, 22, 11, 20, key);
		// falls through
		case 0:
			swap(obj.ep, 0, 1, 2, 3, key);
			swap(obj.ep, 12, 13, 14, 15, key);
			break;
		case 7:
			swap(obj.ep, 2, 16, 6, 12, key);
		// falls through
		case 1:
			swap(obj.ep, 11, 15, 10, 19, key);
			swap(obj.ep, 23, 3, 22, 7, key);
			break;
		case 8:
			swap(obj.ep, 3, 19, 5, 13, key);
		// falls through
		case 2:
			swap(obj.ep, 0, 11, 6, 8, key);
			swap(obj.ep, 12, 23, 18, 20, key);
			break;
		case 9:
			swap(obj.ep, 8, 23, 10, 21, key);
		// falls through
		case 3:
			swap(obj.ep, 4, 5, 6, 7, key);
			swap(obj.ep, 16, 17, 18, 19, key);
			break;
		case 10:
			swap(obj.ep, 14, 0, 18, 4, key);
		// falls through
		case 4:
			swap(obj.ep, 1, 20, 5, 21, key);
			swap(obj.ep, 13, 8, 17, 9, key);
			break;
		case 11:
			swap(obj.ep, 7, 15, 1, 17, key);
		// falls through
		case 5:
			swap(obj.ep, 2, 9, 4, 10, key);
			swap(obj.ep, 14, 21, 16, 22, key);
			break;
	}
}

function checkPhase2Edge(epInv: number[], moves: number[], length: number): boolean {
	let parity = 0;
	for (let i = 0; i < 12; i++) {
		let e = epInv[i];
		let eo = epInv[i + 12];
		for (let j = 0; j < length; j++) {
			const moveMap = epMoveMap[moves[j]];
			e = moveMap[e];
			eo = moveMap[eo];
		}
		if ((e < 12) !== (eo >= 12)) {
			return false;
		}
		parity ^= e >= 12 ? 1 : 0;
	}
	return parity === 0;
}

// ==================== FullCube ====================

const cornerFacelet = [
	[15, 16, 35], [12, 32, 67], [0, 64, 83], [3, 80, 19],
	[51, 47, 28], [48, 79, 44], [60, 95, 76], [63, 31, 92]
];
const edgeFacelet = [
	[13, 33], [4, 65], [2, 81], [11, 17],
	[61, 94], [52, 78], [50, 46], [59, 30],
	[75, 40], [68, 87], [27, 88], [20, 39],
	[34, 14], [66, 8], [82, 1], [18, 7],
	[93, 62], [77, 56], [45, 49], [29, 55],
	[36, 71], [91, 72], [84, 23], [43, 24]
];

let move2rot: number[];

class FullCube {
	moveBuffer: number[];
	edge: EdgeCube;
	center: CenterCube;
	corner: CornerCube;
	add1: boolean;
	centerAvail: number;
	cornerAvail: number;
	edgeAvail: number;
	length1: number;
	length2: number;
	length3: number;
	moveLength: number;
	sym: number;
	value: number;

	constructor(c?: FullCube) {
		this.moveBuffer = createArray(60);
		this.edge = new EdgeCube();
		this.center = new CenterCube();
		this.corner = new CornerCube();
		this.add1 = false;
		this.centerAvail = 0;
		this.cornerAvail = 0;
		this.edgeAvail = 0;
		this.length1 = 0;
		this.length2 = 0;
		this.length3 = 0;
		this.moveLength = 0;
		this.sym = 0;
		this.value = 0;
		if (c) {
			this.copyFrom(c);
		}
	}

	copyFrom(c: FullCube): void {
		copyEdge(this.edge, c.edge);
		copyCenterCube(this.center, c.center);
		this.corner.copy(c.corner);
		this.value = c.value;
		this.add1 = c.add1;
		this.length1 = c.length1;
		this.length2 = c.length2;
		this.length3 = c.length3;
		this.sym = c.sym;
		for (let i = 0; i < 60; ++i) {
			this.moveBuffer[i] = c.moveBuffer[i];
		}
		this.moveLength = c.moveLength;
		this.edgeAvail = c.edgeAvail;
		this.centerAvail = c.centerAvail;
		this.cornerAvail = c.cornerAvail;
	}

	appendMove(m_0: number): void {
		this.moveBuffer[this.moveLength++] = m_0;
	}

	getCenter(): CenterCube {
		while (this.centerAvail < this.moveLength) {
			doMoveCenterCube(this.center, this.moveBuffer[this.centerAvail++]);
		}
		return this.center;
	}

	getCorner(): CornerCube {
		while (this.cornerAvail < this.moveLength) {
			this.corner.move(this.moveBuffer[this.cornerAvail++] % 18);
		}
		return this.corner;
	}

	getEdge(): EdgeCube {
		while (this.edgeAvail < this.moveLength) {
			doMoveEdge(this.edge, this.moveBuffer[this.edgeAvail++]);
		}
		return this.edge;
	}

	fromFacelet(f: number[]): number {
		let ctMask = 0;
		let edMask = 0;
		let cpMask = 0;
		let coSum = 0;
		for (let i = 0; i < 24; i++) {
			this.center.ct[i] = f[centerFacelet[i]];
			ctMask += 1 << f[centerFacelet[i]] * 4;
		}
		for (let i = 0; i < 24; i++) {
			for (let j = 0; j < 24; j++) {
				if (f[edgeFacelet[i][0]] === (edgeFacelet[j][0] >> 4) && f[edgeFacelet[i][1]] === (edgeFacelet[j][1] >> 4)) {
					this.edge.ep[i] = j;
					edMask |= 1 << j;
				}
			}
		}
		for (let i = 0; i < 8; i++) {
			let ori: number;
			for (ori = 0; ori < 3; ori++) {
				if (f[cornerFacelet[i][ori]] === 0 || f[cornerFacelet[i][ori]] === 3) {
					break;
				}
			}
			const col1 = f[cornerFacelet[i][(ori + 1) % 3]];
			const col2 = f[cornerFacelet[i][(ori + 2) % 3]];
			for (let j = 0; j < 8; j++) {
				if (col1 === (cornerFacelet[j][1] >> 4) && col2 === (cornerFacelet[j][2] >> 4)) {
					this.corner.cp[i] = j;
					this.corner.co[i] = ori % 3;
					cpMask |= 1 << j;
					coSum += ori % 3;
					break;
				}
			}
		}
		return (cpMask !== 0xff ? 1 : 0) + (coSum % 3 !== 0 ? 2 : 0) + (ctMask !== 0x444444 ? 4 : 0) + (edMask !== 0xffffff ? 8 : 0);
	}
}

function toFacelet(obj: FullCube): number[] {
	obj.getCenter();
	obj.getCorner();
	obj.getEdge();
	const f: number[] = [];
	for (let i = 0; i < 24; i++) {
		f[centerFacelet[i]] = obj.center.ct[i];
	}
	for (let i = 0; i < 24; i++) {
		f[edgeFacelet[i][0]] = edgeFacelet[obj.edge.ep[i]][0] >> 4;
		f[edgeFacelet[i][1]] = edgeFacelet[obj.edge.ep[i]][1] >> 4;
	}
	for (let c = 0; c < 8; c++) {
		const j = obj.corner.cp[c];
		const ori = obj.corner.co[c];
		for (let n = 0; n < 3; n++) {
			f[cornerFacelet[c][(n + ori) % 3]] = cornerFacelet[j][n] >> 4;
		}
	}
	return f;
}

function to333Facelet(obj: FullCube): number[] | null {
	const f = toFacelet(obj);
	const chks = [[1, 2], [4, 8], [7, 11], [13, 14], [5, 6, 9, 10]];
	const map4to3 = [0, 1, 3, 4, 5, 7, 12, 13, 15];
	const f3: number[] = [];
	for (let fidx = 0; fidx < 6; fidx++) {
		for (let i = 0; i < chks.length; i++) {
			const cmp = f[fidx << 4 | chks[i][0]];
			for (let j = 1; j < chks[i].length; j++) {
				if (cmp !== f[fidx << 4 | chks[i][j]]) {
					return null;
				}
			}
		}
		for (let i = 0; i < map4to3.length; i++) {
			f3[fidx * 9 + i] = f[fidx << 4 | map4to3[i]];
		}
	}
	return f3;
}

function getMoveString(obj: FullCube): string {
	const fixedMoves = new Array(obj.moveLength - (obj.add1 ? 2 : 0));
	let idx = 0;
	for (let i = 0; i < obj.length1; ++i) {
		fixedMoves[idx++] = obj.moveBuffer[i];
	}
	let sym = obj.sym;
	for (let i = obj.length1 + (obj.add1 ? 2 : 0); i < obj.moveLength; ++i) {
		if (SymMove[sym][obj.moveBuffer[i]] >= 27) {
			fixedMoves[idx++] = SymMove[sym][obj.moveBuffer[i]] - 9;
			const rot = move2rot[SymMove[sym][obj.moveBuffer[i]] - 27];
			sym = SymMult[sym][rot];
		} else {
			fixedMoves[idx++] = SymMove[sym][obj.moveBuffer[i]];
		}
	}
	const finishSym = SymMult[SymInv[sym]][getSolvedSym(obj.getCenter())];
	const ret: (string | number)[] = [];
	sym = finishSym;
	for (let i = idx - 1; i >= 0; --i) {
		let move = fixedMoves[i];
		move = ~~(move / 3) * 3 + (2 - move % 3);
		if (SymMove[sym][move] >= 27) {
			ret.push(SymMove[sym][move] - 9);
			const rot = move2rot[SymMove[sym][move] - 27];
			sym = SymMult[sym][rot];
		} else {
			ret.push(SymMove[sym][move]);
		}
	}
	let axis = -1;
	idx = 0;
	const pows = [0, 0, 0];
	for (let i = 0; i < ret.length; ++i) {
		const move = ret[i] as number;
		if (axis !== ~~(move / 3) % 3) {
			for (let i_1 = 0; i_1 < 3; i_1++) {
				if (pows[i_1] % 4) {
					ret[idx++] = move2str_1[i_1 * 9 + axis * 3 + pows[i_1] - 1] + ' ';
					pows[i_1] = 0;
				}
			}
			axis = ~~(move / 3) % 3;
		}
		pows[~~(move / 9)] += move % 3 + 1;
	}
	for (let i_1 = 0; i_1 < 3; i_1++) {
		if (pows[i_1] % 4) {
			ret[idx++] = move2str_1[i_1 * 9 + axis * 3 + pows[i_1] - 1] + ' ';
			pows[i_1] = 0;
		}
	}
	return (ret.slice(0, idx) as string[]).join('');
}

// ==================== Moves ====================

let move2str_1: string[];
let move2std: number[];
let move3std: number[];
let std2move: number[];
let std3move: number[];
let ckmv: boolean[][];
let ckmv2_0: boolean[][];
let ckmv3: boolean[][];
let skipAxis: number[];
let skipAxis2: number[];
let skipAxis3: number[];

function initMoves(): void {
	move2str_1 = [
		'U  ', 'U2 ', "U' ", 'R  ', 'R2 ', "R' ", 'F  ', 'F2 ', "F' ",
		'D  ', 'D2 ', "D' ", 'L  ', 'L2 ', "L' ", 'B  ', 'B2 ', "B' ",
		'Uw ', 'Uw2', "Uw'", 'Rw ', 'Rw2', "Rw'", 'Fw ', 'Fw2', "Fw'",
		'Dw ', 'Dw2', "Dw'", 'Lw ', 'Lw2', "Lw'", 'Bw ', 'Bw2', "Bw'"
	];
	move2std = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 21, 22, 23, 25, 28, 30, 31, 32, 34, 36];
	move3std = [0, 1, 2, 4, 6, 7, 8, 9, 10, 11, 13, 15, 16, 17, 19, 22, 25, 28, 31, 34, 36];
	std2move = createArray(37);
	std3move = createArray(37);
	ckmv = createArray(37, 36);
	ckmv2_0 = createArray(29, 28);
	ckmv3 = createArray(21, 20);
	skipAxis = createArray(36);
	skipAxis2 = createArray(28);
	skipAxis3 = createArray(20);
	epMoveMap = createArray(36, 24);

	for (let i = 0; i < 29; ++i) {
		std2move[move2std[i]] = i;
	}
	for (let i = 0; i < 21; ++i) {
		std3move[move3std[i]] = i;
	}
	for (let i = 0; i < 36; ++i) {
		for (let j = 0; j < 36; ++j) {
			ckmv[i][j] = ~~(i / 3) === ~~(j / 3) || ~~(i / 3) % 3 === ~~(j / 3) % 3 && i > j;
		}
		ckmv[36][i] = false;
	}
	for (let i = 0; i < 29; ++i) {
		for (let j = 0; j < 28; ++j) {
			ckmv2_0[i][j] = ckmv[move2std[i]][move2std[j]];
		}
	}
	for (let i = 0; i < 21; ++i) {
		for (let j = 0; j < 20; ++j) {
			ckmv3[i][j] = ckmv[move3std[i]][move3std[j]];
		}
	}
	for (let i = 0; i < 36; ++i) {
		skipAxis[i] = 36;
		for (let j = i; j < 36; ++j) {
			if (!ckmv[i][j]) {
				skipAxis[i] = j - 1;
				break;
			}
		}
	}
	for (let i = 0; i < 28; ++i) {
		skipAxis2[i] = 28;
		for (let j = i; j < 28; ++j) {
			if (!ckmv2_0[i][j]) {
				skipAxis2[i] = j - 1;
				break;
			}
		}
	}
	for (let i = 0; i < 20; ++i) {
		skipAxis3[i] = 20;
		for (let j = i; j < 20; ++j) {
			if (!ckmv3[i][j]) {
				skipAxis3[i] = j - 1;
				break;
			}
		}
	}
	for (let i = 0; i < 36; ++i) {
		const edge = new EdgeCube();
		doMoveEdge(edge, i);
		for (let j = 0; j < 24; j++) {
			epMoveMap[i][edge.ep[j]] = j;
		}
	}
}

// ==================== Priority Queue ====================

class PriorityQueue {
	array: FullCube[];
	size: number;

	constructor() {
		this.array = new Array(PHASE2_ATTS);
		this.size = 0;
	}

	add(o: FullCube): void {
		this.offer(o);
	}

	clear(): void {
		this.array = [];
		this.size = 0;
	}

	poll(): FullCube | null {
		if (this.size === 0) {
			return null;
		}
		const value = this.array[0];
		const lastValue = this.array[--this.size];
		this.array.length = this.size;
		if (0 < this.size) {
			this.array[0] = lastValue;
			this.mergeHeaps(0);
		}
		return value;
	}

	private offer(e: FullCube): void {
		let node = this.size;
		this.array[this.size++] = e;
		while (node > 0) {
			const parent = (node - 1) >> 1;
			if (this.compare(this.array[parent], e) <= 0) {
				this.array[node] = e;
				return;
			}
			this.array[node] = this.array[parent];
			node = parent;
		}
		this.array[node] = e;
	}

	private mergeHeaps(node: number): void {
		const heapSize = this.size;
		const value = this.array[node];
		while (node * 2 + 1 < heapSize) {
			const leftChild = 2 * node + 1;
			const rightChild = leftChild + 1;
			let smallestChild = leftChild;
			if (rightChild < heapSize && this.compare(this.array[rightChild], this.array[leftChild]) < 0) {
				smallestChild = rightChild;
			}
			if (this.compare(value, this.array[smallestChild]) < 0) {
				break;
			}
			this.array[node] = this.array[smallestChild];
			node = smallestChild;
		}
		this.array[node] = value;
	}

	private compare(c1: FullCube, c2: FullCube): number {
		return c2.value - c1.value;
	}
}

// ==================== Search ====================

class Search4 {
	p1sols: PriorityQueue;
	move1: number[];
	move2: number[];
	move3: number[];
	c: FullCube | null;
	c1: FullCube;
	c2: FullCube;
	ct2: Center2;
	ct3: Center3;
	e12: Edge3;
	tempep: number[][];
	arr2: FullCube[];
	add1: boolean;
	arr2idx: number;
	length1: number;
	length2: number;
	length3: number;
	p1SolsCnt: number;
	solution: string;
	epInv: number[];

	constructor() {
		this.p1sols = new PriorityQueue();
		this.move1 = createArray(15);
		this.move2 = createArray(20);
		this.move3 = createArray(20);
		this.c1 = new FullCube();
		this.c2 = new FullCube();
		this.ct2 = new Center2();
		this.ct3 = new Center3();
		this.e12 = new Edge3();
		this.tempep = createArray(20);
		this.arr2 = createArray(PHASE2_SOLS);
		for (let i = 0; i < 20; ++i) {
			this.tempep[i] = [];
		}
		this.add1 = false;
		this.arr2idx = 0;
		this.c = null;
		this.length1 = 0;
		this.length2 = 0;
		this.length3 = 0;
		this.p1SolsCnt = 0;
		this.solution = '';
		this.epInv = [];
	}

	doSearch(): number[] {
		this.solution = '';
		const ud = center1GetSym(new Center1().fromCube(this.c!.getCenter(), 0));
		const fb = center1GetSym(new Center1().fromCube(this.c!.getCenter(), 1));
		const rl = center1GetSym(new Center1().fromCube(this.c!.getCenter(), 2));
		const udprun = Center1SymPrun[ud >> 6];
		const fbprun = Center1SymPrun[fb >> 6];
		const rlprun = Center1SymPrun[rl >> 6];
		this.p1SolsCnt = 0;
		this.arr2idx = 0;
		this.p1sols.clear();

		for (this.length1 = Math.min(udprun, fbprun, rlprun); this.length1 < MAX_SEARCH_DEPTH; ++this.length1) {
			if (rlprun <= this.length1 && this.phase1Search(rl >>> 6, rl & 63, this.length1, -1, 0)
				|| udprun <= this.length1 && this.phase1Search(ud >>> 6, ud & 63, this.length1, -1, 0)
				|| fbprun <= this.length1 && this.phase1Search(fb >>> 6, fb & 63, this.length1, -1, 0)) {
				break;
			}
		}

		const p1SolsArr = this.p1sols.array.slice();
		p1SolsArr.sort((a, b) => a.value - b.value);

		let MAX_LENGTH2 = 9;
		let length12: number;
		do {
			length12 = MAX_SEARCH_DEPTH;
			OUT: for (length12 = p1SolsArr[0].value; length12 < MAX_SEARCH_DEPTH; ++length12) {
				for (let i = 0; i < p1SolsArr.length; ++i) {
					const cc = p1SolsArr[i];
					if (cc.value > length12) {
						break;
					}
					if (length12 - cc.length1 > MAX_LENGTH2) {
						continue;
					}
					this.c1.copyFrom(cc);
					const ep = this.c1.getEdge().ep;
					center2Set(this.ct2, this.c1.getCenter(), parity_0(ep));
					const s2ct = center2GetCt(this.ct2);
					const s2rl = center2GetRl(this.ct2);
					this.length1 = cc.length1;
					this.length2 = length12 - cc.length1;
					this.epInv = [];
					for (let e = 0; e < 24; e++) {
						this.epInv[ep[e]] = e;
					}
					if (this.phase2Search(s2ct, s2rl, this.length2, 28, 0)) {
						break OUT;
					}
				}
			}
			++MAX_LENGTH2;
		} while (length12 === MAX_SEARCH_DEPTH);

		this.arr2.sort((a, b) => {
			if (!a || !b) return 0;
			return a.value - b.value;
		});

		let index = 0;
		let MAX_LENGTH3 = 13;
		let length123: number;
		do {
			length123 = MAX_SEARCH_DEPTH;
			OUT2: for (length123 = this.arr2[0].value; length123 < MAX_SEARCH_DEPTH; ++length123) {
				for (let i = 0; i < Math.min(this.arr2idx, PHASE2_SOLS); ++i) {
					if (this.arr2[i].value > length123) {
						break;
					}
					this.arr2[i].length3 = length123 - this.arr2[i].length1 - this.arr2[i].length2;
					if (this.arr2[i].length3 > MAX_LENGTH3) {
						continue;
					}
					const eparity = edge3SetFromEdgeCube(this.e12, this.arr2[i].getEdge());
					center3Set(this.ct3, this.arr2[i].getCenter(), eparity ^ parity_0(this.arr2[i].getCorner().cp));
					const ct = center3GetCt(this.ct3);
					edge3Get(this.e12, 10);
					for (let j = 0; j < 12; j++) {
						this.tempep[0][j] = this.e12.edge[j];
					}
					const prun = getprun(edge3GetSym(this.e12));
					if (prun <= this.arr2[i].length3
						&& this.phase3Search(this.tempep[0], ct, prun, this.arr2[i].length3, 20, 0)) {
						index = i;
						break OUT2;
					}
				}
			}
			++MAX_LENGTH3;
		} while (length123 === MAX_SEARCH_DEPTH);

		const solcube = new FullCube(this.arr2[index]);
		this.length1 = solcube.length1;
		this.length2 = solcube.length2;
		this.length3 = solcube.length3;
		for (let i = 0; i < this.length3; ++i) {
			solcube.appendMove(move3std[this.move3[i]]);
		}
		const f3 = to333Facelet(solcube);
		if (!f3) {
			// Reduction error — should not happen with valid states
			return [this.length1, this.length2, this.length3, 0, 0, 0, 0];
		}
		const f3str: string[] = [];
		for (let i = 0; i < 54; i++) {
			f3str[i] = 'URFDLB'[f3[i]];
		}
		const sol3 = solvFacelet333(f3str.join('')).split(' ');
		let length333 = 0;
		for (let m = 0; m < sol3.length; m++) {
			if (/^[URFDLB][2']?$/.exec(sol3[m])) {
				length333++;
				solcube.appendMove('URFDLB'.indexOf(sol3[m][0]) * 3 + "2'".indexOf(sol3[m][1]) + 1);
			}
		}
		this.solution = getMoveString(solcube);
		return [this.length1, this.length2, this.length3, length333, 0, 0, 0];
	}

	private init2(sym: number): boolean {
		this.c1.copyFrom(this.c!);
		for (let i = 0; i < this.length1; ++i) {
			this.c1.appendMove(this.move1[i]);
		}
		switch (finish_0[sym]) {
			case 0:
				this.c1.appendMove(24);
				this.c1.appendMove(35);
				this.move1[this.length1] = 24;
				this.move1[this.length1 + 1] = 35;
				this.add1 = true;
				sym = 19;
				break;
			case 12869:
				this.c1.appendMove(18);
				this.c1.appendMove(29);
				this.move1[this.length1] = 18;
				this.move1[this.length1 + 1] = 29;
				this.add1 = true;
				sym = 34;
				break;
			case 735470:
				this.add1 = false;
				sym = 0;
				break;
		}
		center2Set(this.ct2, this.c1.getCenter(), parity_0(this.c1.getEdge().ep));
		const s2ct = center2GetCt(this.ct2);
		const s2rl = center2GetRl(this.ct2);
		const ctp = ctprun[s2ct * 70 + s2rl];
		this.c1.value = ctp + this.length1;
		this.c1.length1 = this.length1;
		this.c1.add1 = this.add1;
		this.c1.sym = sym;
		++this.p1SolsCnt;
		let next: FullCube;
		if (this.p1sols.size < PHASE2_ATTS) {
			next = new FullCube(this.c1);
		} else {
			next = this.p1sols.poll()!;
			if (next.value > this.c1.value) next.copyFrom(this.c1);
		}
		this.p1sols.add(next);
		return this.p1SolsCnt === PHASE1_SOLS;
	}

	private init3(): boolean {
		if (!checkPhase2Edge(this.epInv, this.move2, this.length2)) {
			return false;
		}
		this.c2.copyFrom(this.c1);
		for (let i = 0; i < this.length2; ++i) {
			this.c2.appendMove(this.move2[i]);
		}
		const eparity = edge3SetFromEdgeCube(this.e12, this.c2.getEdge());
		center3Set(this.ct3, this.c2.getCenter(), eparity ^ parity_0(this.c2.getCorner().cp));
		const ct = center3GetCt(this.ct3);
		edge3Get(this.e12, 10);
		const prun = getprun(edge3GetSym(this.e12));
		if (!this.arr2[this.arr2idx]) {
			this.arr2[this.arr2idx] = new FullCube(this.c2);
		} else {
			this.arr2[this.arr2idx].copyFrom(this.c2);
		}
		this.arr2[this.arr2idx].value = this.length1 + this.length2 + Math.max(prun, prun_0[ct]);
		this.arr2[this.arr2idx].length2 = this.length2;
		++this.arr2idx;
		return this.arr2idx === this.arr2.length;
	}

	phase1Search(ct: number, sym: number, maxl: number, lm: number, depth: number): boolean {
		if (ct === 0) {
			return maxl === 0 && this.init2(sym);
		}
		for (let axis = 0; axis < 27; axis += 3) {
			if (axis === lm || axis === lm - 9 || axis === lm - 18) {
				continue;
			}
			for (let power = 0; power < 3; ++power) {
				const m_0 = axis + power;
				const ctx = Center1SymMove[ct][SymMove[sym][m_0]];
				const prun = Center1SymPrun[ctx >>> 6];
				if (prun >= maxl) {
					if (prun > maxl) {
						break;
					}
					continue;
				}
				const symx = SymMult[sym][ctx & 63];
				this.move1[depth] = m_0;
				if (this.phase1Search(ctx >>> 6, symx, maxl - 1, axis, depth + 1)) {
					return true;
				}
			}
		}
		return false;
	}

	phase2Search(ct: number, rl: number, maxl: number, lm: number, depth: number): boolean {
		if (ct === 0 && ctprun[rl] === 0 && maxl < 5) {
			return maxl === 0 && this.init3();
		}
		for (let m_0 = 0; m_0 < 23; ++m_0) {
			if (ckmv2_0[lm][m_0]) {
				m_0 = skipAxis2[m_0];
				continue;
			}
			const ctx = ctmv[ct][m_0];
			const rlx = rlmv[rl][m_0];
			const prun = ctprun[ctx * 70 + rlx];
			if (prun >= maxl) {
				if (prun > maxl) m_0 = skipAxis2[m_0];
				continue;
			}
			this.move2[depth] = move2std[m_0];
			if (this.phase2Search(ctx, rlx, maxl - 1, m_0, depth + 1)) {
				return true;
			}
		}
		return false;
	}

	phase3Search(eplast: number[], ct: number, prun: number, maxl: number, lm: number, depth: number): boolean {
		if (maxl === 0) {
			return true;
		}
		const ep = this.tempep[depth];
		if (lm !== 20) {
			const movo = mvroto[lm << 3];
			const mov = mvrot[lm << 3];
			for (let i = 0; i < 12; i++) {
				ep[i] = movo[eplast[mov[i]]];
			}
		}
		for (let m = 0; m < 17; m++) {
			if (ckmv3[lm][m]) {
				m = skipAxis3[m];
				continue;
			}
			const ctx = ctmove[ct][m];
			const prun1 = prun_0[ctx];
			if (prun1 >= maxl) {
				if (prun1 > maxl && m < 14) m = skipAxis3[m];
				continue;
			}
			const prunx = getprun_0(getMvSym(ep, m) >> 3, prun);
			if (prunx >= maxl) {
				if (prunx > maxl && m < 14) m = skipAxis3[m];
				continue;
			}
			if (this.phase3Search(ep, ctx, prunx, maxl - 1, m, depth + 1)) {
				this.move3[depth] = m;
				return true;
			}
		}
		return false;
	}
}

// ==================== Initialization ====================

let searcher: Search4;
let initialized = false;

function init(): void {
	if (initialized) return;
	initialized = true;

	// Allocate tables
	initMoves();

	// Center1
	Center1SymMove = createArray(15582, 36);
	Center1Sym2Raw = createArray(15582);
	Center1SymPrun = createArray(15582);
	SymMult = createArray(48, 48);
	SymMove = createArray(48, 36);
	SymInv = createArray(48);
	finish_0 = createArray(48);

	// Center2
	rlmv = createArray(70, 28);
	ctmv = createArray(6435, 28);
	rlrot = createArray(70, 16);
	ctrot = createArray(6435, 16);
	ctprun = createArray(450450);
	pmv = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0];

	// Center3
	ctmove = createArray(29400, 20);
	pmove = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1];
	prun_0 = createArray(29400);
	rl2std = [0, 9, 14, 23, 27, 28, 41, 42, 46, 55, 60, 69];
	std2rl = createArray(70);

	// Edge3
	Edge3Prun = new Int32Array(1937880);
	Edge3Sym2Raw = createArray(1538);
	Edge3Sym2Mask = createArray(1538);
	symstate = [];
	for (let i = 0; i < 1538; i++) symstate[i] = 0;
	Edge3Raw2Sym = createArray(11880);
	mvrot = createArray(168, 12);
	mvroto = createArray(168, 12);

	// CornerCube
	initCornerMoves();

	// FullCube
	move2rot = [35, 1, 34, 2, 4, 6, 22, 5, 19];

	// Build tables
	initSymMeta();
	Center1Raw2Sym = createArray(735471);
	initCenter1Sym2Raw();
	initCenter1MoveTable();
	Center1Raw2Sym = null;
	initCenter1Prun();
	initCenter2();
	initCenter3();
	initEdge3MvRot();
	initEdge3Sym2Raw();
	initEdge3Prun();

	searcher = new Search4();
}

// ==================== Scramble Generation ====================

function partialSolvedState(ctMask: number, edMask: number, cnMask: number, neut?: number): string {
	const colmap = [0, 1, 2, 3, 4, 5];
	if (neut) {
		let ori = rn([1, 4, 8, 1, 1, 1, 24][neut]);
		if (ori >= 8) {
			acycle(colmap, [0, 1, 2], ori >> 3);
			acycle(colmap, [3, 4, 5], ori >> 3);
			ori &= 0x7;
		}
		if (ori >= 4) {
			acycle(colmap, [0, 1, 3, 4], 2);
			ori &= 0x3;
		}
		if (ori >= 1) {
			acycle(colmap, [1, 2, 4, 5], ori);
		}
	}
	let solved = true;
	let facelet: string[] = [];
	for (let _ = 0; solved && _ < 100; _++) {
		const cc = new FullCube();
		const ctSwaps: number[] = [];
		const edSwaps: number[] = [];
		const cnSwaps: number[] = [];
		for (let i = 0; i < 24; i++) {
			if (ctMask >> i & 1) {
				ctSwaps.push(i);
			}
			if (edMask >> i & 1) {
				edSwaps.push(i);
			}
			if (cnMask >> i & 1) {
				cnSwaps.push(i);
			}
		}
		const ctPerm = rndPerm(ctSwaps.length);
		for (let i = 0; i < ctSwaps.length; i++) {
			cc.center.ct[ctSwaps[i]] = centerFacelet[ctSwaps[ctPerm[i]]] >> 4;
		}
		const edPerm = rndPerm(edSwaps.length);
		for (let i = 0; i < edSwaps.length; i++) {
			cc.edge.ep[edSwaps[i]] = edSwaps[edPerm[i]];
		}
		const cnPerm = rndPerm(cnSwaps.length);
		let coSum = 24;
		for (let i = 0; i < cnSwaps.length; i++) {
			const co = rn(3);
			cc.corner.co[cnSwaps[i]] = co;
			cc.corner.cp[cnSwaps[i]] = cnSwaps[cnPerm[i]];
			coSum -= co;
		}
		if (coSum % 3 !== 0) {
			cc.corner.co[cnSwaps[0]] = (cc.corner.co[cnSwaps[0]] + coSum) % 3;
		}
		const faceArr = toFacelet(cc);
		facelet = [];
		for (let i = 0; i < 96; i++) {
			facelet[i] = 'URFDLB'.charAt(colmap[faceArr[i]]);
			if (facelet[i] !== facelet[i >> 4 << 4]) {
				solved = false;
			}
		}
	}
	return facelet.join('');
}

function genFacelet(faceStr: string): string {
	init();
	const facelet: number[] = [];
	for (let i = 0; i < 96; i++) {
		facelet[i] = 'URFDLB'.indexOf(faceStr[i]);
	}
	searcher.c = new FullCube();
	const chk = searcher.c.fromFacelet(facelet);
	if (chk !== 0) {
		// State check error — proceed anyway as best effort
	}
	searcher.doSearch();
	return searcher.solution.replace(/\s+/g, ' ');
}

function getRandomScramble(): string {
	return genFacelet(partialSolvedState(0xffffff, 0xffffff, 0xff));
}

function getPartialScramble(ctMask: number, edMask: number, cnMask: number, neut?: number): string {
	return genFacelet(partialSolvedState(ctMask, edMask, cnMask, neut));
}

function getYauUD3CScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	const unsolv = rn(4);
	return getPartialScramble(0xffff00, 0xff0ff0 | (0x1001 << unsolv), 0xff, neut);
}

function getHoyaRLDAScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	const unsolv = rn(2) * 4;
	return getPartialScramble(0x0000f0 | (0xf00 << unsolv), 0xffffff, 0xff, neut);
}

function getHoyaRLCAScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	const unsolv = rn(2) * 4;
	return getPartialScramble(0x0000f0 | (0xf00 << unsolv), 0xff0ff0, 0xff, neut);
}

function getEdgeScramble(): string {
	return getPartialScramble(0x000000, 0xffffff, 0xff);
}

function getEdgeOnlyScramble(): string {
	return getPartialScramble(0x000000, 0xffffff, 0x00);
}

function getCenterOnlyScramble(): string {
	return getPartialScramble(0xffffff, 0x000000, 0x00);
}

function getLastLayerScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	return getPartialScramble(0x000000, 0x0f00f0, 0xf0, neut);
}

function getCenterUDSolvedScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	return getPartialScramble(0xffff00, 0xffffff, 0xff, neut);
}

function getCenterRLSolvedScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	return getPartialScramble(0x00ffff, 0xffffff, 0xff, neut);
}

function getLast8DedgeScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	return getPartialScramble(0x000000, 0xff0ff0, 0xff, neut);
}

function getELLScramble(_type: string, _length?: number, _cases?: number, neut?: number): string {
	return getPartialScramble(0x000000, 0x0f00f0, 0x00, neut);
}

// ==================== Registration ====================

registerGenerator('444wca', () => getRandomScramble());
registerGenerator('4edge', () => getEdgeScramble());
registerGenerator('444edo', () => getEdgeOnlyScramble());
registerGenerator('444cto', () => getCenterOnlyScramble());
registerGenerator('444ll', (type, length, state) => getLastLayerScramble(type, length, state));
registerGenerator('444ell', (type, length, state) => getELLScramble(type, length, state));
registerGenerator('444ctud', (type, length, state) => getCenterUDSolvedScramble(type, length, state));
registerGenerator('444ctrl', (type, length, state) => getCenterRLSolvedScramble(type, length, state));
registerGenerator('444l8e', (type, length, state) => getLast8DedgeScramble(type, length, state));
registerGenerator('444ud3c', (type, length, state) => getYauUD3CScramble(type, length, state));
registerGenerator('444rlda', (type, length, state) => getHoyaRLDAScramble(type, length, state));
registerGenerator('444rlca', (type, length, state) => getHoyaRLCAScramble(type, length, state));

// ==================== Public API ====================

export { getRandomScramble, getPartialScramble, init as init444 };
