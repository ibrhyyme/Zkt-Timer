/**
 * Square-1 scramble generator — random-state two-phase solver.
 * Ported from cstimer scramble_sq1_new.js (GPLv3)
 *
 * Supports:
 *   sqrs    — WCA random-state Square-1
 *   sqrcsp  — CSP subset (random shape)
 *   sq1pll  — SQ1 PLL training
 */

import { getNPerm, setNPerm, circle, rn } from '../lib/mathlib';
import { registerGenerator } from '../registry';

// ==================== SqCubie ====================

class SqCubie {
	ul = 0x011233; // 0 UB, 1 UBL, 2 UL, 3 UFL
	ur = 0x455677; // 4 UF, 5 UFR, 6 UR, 7 UBR
	dl = 0x998bba; // 9 DBR, 8 DR, b DFR, a DF
	dr = 0xddcffe; // d DFL, c DL, f DBL, e DB
	ml = 0;

	toString(): string {
		return this.ul.toString(16).padStart(6, '0') +
			this.ur.toString(16).padStart(6, '0') +
			'|/'.charAt(this.ml) +
			this.dl.toString(16).padStart(6, '0') +
			this.dr.toString(16).padStart(6, '0');
	}

	pieceAt(idx: number): number {
		let ret: number;
		if (idx < 6) {
			ret = this.ul >> ((5 - idx) << 2);
		} else if (idx < 12) {
			ret = this.ur >> ((11 - idx) << 2);
		} else if (idx < 18) {
			ret = this.dl >> ((17 - idx) << 2);
		} else {
			ret = this.dr >> ((23 - idx) << 2);
		}
		return ret & 0xf;
	}

	setPiece(idx: number, value: number): void {
		if (idx < 6) {
			this.ul &= ~(0xf << ((5 - idx) << 2));
			this.ul |= value << ((5 - idx) << 2);
		} else if (idx < 12) {
			this.ur &= ~(0xf << ((11 - idx) << 2));
			this.ur |= value << ((11 - idx) << 2);
		} else if (idx < 18) {
			this.dl &= ~(0xf << ((17 - idx) << 2));
			this.dl |= value << ((17 - idx) << 2);
		} else {
			this.dr &= ~(0xf << ((23 - idx) << 2));
			this.dr |= value << ((23 - idx) << 2);
		}
	}

	copy(c: SqCubie): void {
		this.ul = c.ul;
		this.ur = c.ur;
		this.dl = c.dl;
		this.dr = c.dr;
		this.ml = c.ml;
	}

	doMove(move: number): void {
		let temp: number;
		move <<= 2;
		if (move > 24) {
			move = 48 - move;
			temp = this.ul;
			this.ul = (this.ul >> move | this.ur << (24 - move)) & 0xffffff;
			this.ur = (this.ur >> move | temp << (24 - move)) & 0xffffff;
		} else if (move > 0) {
			temp = this.ul;
			this.ul = (this.ul << move | this.ur >> (24 - move)) & 0xffffff;
			this.ur = (this.ur << move | temp >> (24 - move)) & 0xffffff;
		} else if (move === 0) {
			temp = this.ur;
			this.ur = this.dl;
			this.dl = temp;
			this.ml = 1 - this.ml;
		} else if (move >= -24) {
			move = -move;
			temp = this.dl;
			this.dl = (this.dl << move | this.dr >> (24 - move)) & 0xffffff;
			this.dr = (this.dr << move | temp >> (24 - move)) & 0xffffff;
		} else if (move < -24) {
			move = 48 + move;
			temp = this.dl;
			this.dl = (this.dl >> move | this.dr << (24 - move)) & 0xffffff;
			this.dr = (this.dr >> move | temp << (24 - move)) & 0xffffff;
		}
	}
}

// ==================== SquareState (phase 2 coordinate) ====================

class SquareState {
	botEdgeFirst = false;
	cornperm = 0;
	edgeperm = 0;
	ml = 0;
	topEdgeFirst = false;
}

// ==================== ShapeState ====================

class ShapeState {
	bottom = 0;
	parity = 0;
	top = 0;
}

// ==================== Utility functions ====================

function bitCount(x: number): number {
	x -= (x >> 1) & 1431655765;
	x = ((x >> 2) & 858993459) + (x & 858993459);
	x = ((x >> 4) + x) & 252645135;
	x += x >> 8;
	x += x >> 16;
	return x & 63;
}

function binarySearch(sortedArray: number[], key: number): number {
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

// ==================== FullCube helpers ====================

function FullCube_getParity(obj: SqCubie): number {
	let cnt = 0;
	const arr: number[] = [obj.pieceAt(0)];
	for (let i = 1; i < 24; ++i) {
		if (obj.pieceAt(i) !== arr[cnt]) {
			arr[++cnt] = obj.pieceAt(i);
		}
	}
	let p = 0;
	for (let a = 0; a < 16; ++a) {
		for (let b = a + 1; b < 16; ++b) {
			if (arr[a] > arr[b]) p ^= 1;
		}
	}
	return p;
}

function FullCube_getShapeIdx(obj: SqCubie): number {
	let urx = obj.ur & 0x111111;
	urx |= urx >> 3;
	urx |= urx >> 6;
	urx = (urx & 15) | ((urx >> 12) & 48);

	let ulx = obj.ul & 0x111111;
	ulx |= ulx >> 3;
	ulx |= ulx >> 6;
	ulx = (ulx & 15) | ((ulx >> 12) & 48);

	let drx = obj.dr & 0x111111;
	drx |= drx >> 3;
	drx |= drx >> 6;
	drx = (drx & 15) | ((drx >> 12) & 48);

	let dlx = obj.dl & 0x111111;
	dlx |= dlx >> 3;
	dlx |= dlx >> 6;
	dlx = (dlx & 15) | ((dlx >> 12) & 48);

	return Shape_getShape2Idx(FullCube_getParity(obj) << 24 | ulx << 18 | urx << 12 | dlx << 6 | drx);
}

function FullCube_getSquare(obj: SqCubie, sq: SquareState): void {
	const prm: number[] = [];
	for (let a = 0; a < 8; ++a) {
		prm[a] = obj.pieceAt(a * 3 + 1) >> 1;
	}
	sq.cornperm = getNPerm(prm, 8);
	sq.topEdgeFirst = obj.pieceAt(0) === obj.pieceAt(1);
	let a = sq.topEdgeFirst ? 2 : 0;
	let b: number;
	for (b = 0; b < 4; a += 3, ++b) {
		prm[b] = obj.pieceAt(a) >> 1;
	}
	sq.botEdgeFirst = obj.pieceAt(12) === obj.pieceAt(13);
	a = sq.botEdgeFirst ? 14 : 12;
	for (; b < 8; a += 3, ++b) {
		prm[b] = obj.pieceAt(a) >> 1;
	}
	sq.edgeperm = getNPerm(prm, 8);
	sq.ml = obj.ml;
}

function FullCube_randomCube(indice?: number): SqCubie {
	if (indice === undefined) {
		indice = rn(3678);
	}
	const f = new SqCubie();
	const shape = Shape_ShapeIdx[indice];
	let corner = 0x01234567 << 1 | 0x11111111;
	let edge = 0x01234567 << 1;
	let n_corner = 8;
	let n_edge = 8;
	for (let i = 0; i < 24; i++) {
		if (((shape >> i) & 1) === 0) { // edge
			const rnd = rn(n_edge) << 2;
			f.setPiece(23 - i, (edge >> rnd) & 0xf);
			const m = (1 << rnd) - 1;
			edge = (edge & m) + ((edge >> 4) & ~m);
			--n_edge;
		} else { // corner
			const rnd = rn(n_corner) << 2;
			f.setPiece(23 - i, (corner >> rnd) & 0xf);
			f.setPiece(22 - i, (corner >> rnd) & 0xf);
			const m = (1 << rnd) - 1;
			corner = (corner & m) + ((corner >> 4) & ~m);
			--n_corner;
			++i;
		}
	}
	f.ml = rn(2);
	return f;
}

// ==================== Search ====================

interface SearchState {
	Search_move: number[];
	Search_d: SqCubie;
	Search_sq: SquareState;
	Search_c: SqCubie | null;
	Search_length1: number;
	Search_maxlen2: number;
	Search_sol_string: string | null;
}

function createSearchState(): SearchState {
	return {
		Search_move: [],
		Search_d: new SqCubie(),
		Search_sq: new SquareState(),
		Search_c: null,
		Search_length1: 0,
		Search_maxlen2: 0,
		Search_sol_string: null,
	};
}

function Search_init2(obj: SearchState): boolean {
	obj.Search_d.copy(obj.Search_c!);
	for (let i = 0; i < obj.Search_length1; ++i) {
		obj.Search_d.doMove(obj.Search_move[i]);
	}
	FullCube_getSquare(obj.Search_d, obj.Search_sq);
	const edge = obj.Search_sq.edgeperm;
	const corner = obj.Search_sq.cornperm;
	const ml = obj.Search_sq.ml;
	const prun = Math.max(
		SquarePrun[obj.Search_sq.edgeperm << 1 | ml],
		SquarePrun[obj.Search_sq.cornperm << 1 | ml]
	);
	for (let i = prun; i < obj.Search_maxlen2; ++i) {
		if (Search_phase2(obj, edge, corner, obj.Search_sq.topEdgeFirst, obj.Search_sq.botEdgeFirst, ml, i, obj.Search_length1, 0)) {
			for (let j = 0; j < i; ++j) {
				obj.Search_d.doMove(obj.Search_move[obj.Search_length1 + j]);
			}
			obj.Search_sol_string = Search_move2string(obj, i + obj.Search_length1);
			return true;
		}
	}
	return false;
}

function Search_move2string(obj: SearchState, len: number): string {
	let s = '';
	let top = 0;
	let bottom = 0;
	for (let i = len - 1; i >= 0; i--) {
		const val = obj.Search_move[i];
		if (val > 0) {
			const v = 12 - val;
			top = (v > 6) ? (v - 12) : v;
		} else if (val < 0) {
			const v = 12 + val;
			bottom = (v > 6) ? (v - 12) : v;
		} else {
			let twst = '/';
			if (i === obj.Search_length1 - 1) {
				twst = '`/`';
			}
			if (top === 0 && bottom === 0) {
				s += twst;
			} else {
				s += ' (' + top + ',' + bottom + ')' + twst;
			}
			top = bottom = 0;
		}
	}
	if (top !== 0 || bottom !== 0) {
		s += ' (' + top + ',' + bottom + ') ';
	}
	return s;
}

function Search_phase1(obj: SearchState, shape: number, prunvalue: number, maxl: number, depth: number, lm: number): boolean {
	let m: number, prunx: number, shapex: number;
	if (prunvalue === 0 && maxl < 4) {
		return maxl === 0 && Search_init2(obj);
	}
	if (lm !== 0) {
		shapex = Shape_TwistMove[shape];
		prunx = ShapePrun[shapex];
		if (prunx < maxl) {
			obj.Search_move[depth] = 0;
			if (Search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 0)) {
				return true;
			}
		}
	}
	shapex = shape;
	if (lm <= 0) {
		m = 0;
		while (true) {
			m += Shape_TopMove[shapex];
			shapex = m >> 4;
			m &= 15;
			if (m >= 12) {
				break;
			}
			prunx = ShapePrun[shapex];
			if (prunx > maxl) {
				break;
			} else if (prunx < maxl) {
				obj.Search_move[depth] = m;
				if (Search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 1)) {
					return true;
				}
			}
		}
	}
	shapex = shape;
	if (lm <= 1) {
		m = 0;
		while (true) {
			m += Shape_BottomMove[shapex];
			shapex = m >> 4;
			m &= 15;
			if (m >= 6) {
				break;
			}
			prunx = ShapePrun[shapex];
			if (prunx > maxl) {
				break;
			} else if (prunx < maxl) {
				obj.Search_move[depth] = -m;
				if (Search_phase1(obj, shapex, prunx, maxl - 1, depth + 1, 2)) {
					return true;
				}
			}
		}
	}
	return false;
}

function Search_phase2(
	obj: SearchState, edge: number, corner: number,
	topEdgeFirst: boolean, botEdgeFirst: boolean,
	ml: number, maxl: number, depth: number, lm: number
): boolean {
	let botEdgeFirstx: boolean, cornerx: number, edgex: number, m: number, prun1: number, prun2: number, topEdgeFirstx: boolean;
	if (maxl === 0 && !topEdgeFirst && botEdgeFirst) {
		return true;
	}
	if (lm !== 0 && topEdgeFirst === botEdgeFirst) {
		edgex = Square_TwistMove[edge];
		cornerx = Square_TwistMove[corner];
		if (SquarePrun[edgex << 1 | (1 - ml)] < maxl && SquarePrun[cornerx << 1 | (1 - ml)] < maxl) {
			obj.Search_move[depth] = 0;
			if (Search_phase2(obj, edgex, cornerx, topEdgeFirst, botEdgeFirst, 1 - ml, maxl - 1, depth + 1, 0)) {
				return true;
			}
		}
	}
	if (lm <= 0) {
		topEdgeFirstx = !topEdgeFirst;
		edgex = topEdgeFirstx ? Square_TopMove[edge] : edge;
		cornerx = topEdgeFirstx ? corner : Square_TopMove[corner];
		m = topEdgeFirstx ? 1 : 2;
		prun1 = SquarePrun[edgex << 1 | ml];
		prun2 = SquarePrun[cornerx << 1 | ml];
		while (m < 12 && prun1 <= maxl && prun2 <= maxl) {
			if (prun1 < maxl && prun2 < maxl) {
				obj.Search_move[depth] = m;
				if (Search_phase2(obj, edgex, cornerx, topEdgeFirstx, botEdgeFirst, ml, maxl - 1, depth + 1, 1)) {
					return true;
				}
			}
			topEdgeFirstx = !topEdgeFirstx;
			if (topEdgeFirstx) {
				edgex = Square_TopMove[edgex];
				prun1 = SquarePrun[edgex << 1 | ml];
				m += 1;
			} else {
				cornerx = Square_TopMove[cornerx];
				prun2 = SquarePrun[cornerx << 1 | ml];
				m += 2;
			}
		}
	}
	if (lm <= 1) {
		botEdgeFirstx = !botEdgeFirst;
		edgex = botEdgeFirstx ? Square_BottomMove[edge] : edge;
		cornerx = botEdgeFirstx ? corner : Square_BottomMove[corner];
		m = botEdgeFirstx ? 1 : 2;
		prun1 = SquarePrun[edgex << 1 | ml];
		prun2 = SquarePrun[cornerx << 1 | ml];
		while (m < (maxl > 6 ? 6 : 12) && prun1 <= maxl && prun2 <= maxl) {
			if (prun1 < maxl && prun2 < maxl) {
				obj.Search_move[depth] = -m;
				if (Search_phase2(obj, edgex, cornerx, topEdgeFirst, botEdgeFirstx, ml, maxl - 1, depth + 1, 2)) {
					return true;
				}
			}
			botEdgeFirstx = !botEdgeFirstx;
			if (botEdgeFirstx) {
				edgex = Square_BottomMove[edgex];
				prun1 = SquarePrun[edgex << 1 | ml];
				m += 1;
			} else {
				cornerx = Square_BottomMove[cornerx];
				prun2 = SquarePrun[cornerx << 1 | ml];
				m += 2;
			}
		}
	}
	return false;
}

function Search_solution(obj: SearchState, c: SqCubie): string {
	obj.Search_c = c;
	const shape = FullCube_getShapeIdx(c);
	for (obj.Search_length1 = ShapePrun[shape]; obj.Search_length1 < 100; ++obj.Search_length1) {
		obj.Search_maxlen2 = Math.min(32 - obj.Search_length1, 17);
		if (Search_phase1(obj, shape, ShapePrun[shape], obj.Search_length1, 0, -1)) {
			break;
		}
	}
	return obj.Search_sol_string || '';
}

// ==================== Shape tables ====================

const Shape_halflayer = [0, 3, 6, 12, 15, 24, 27, 30, 48, 51, 54, 60, 63];
let Shape_ShapeIdx: number[] = [];
let ShapePrun: number[] = [];
let Shape_TopMove: number[] = [];
let Shape_BottomMove: number[] = [];
let Shape_TwistMove: number[] = [];

let shapeInitDone = false;

function Shape_bottomMove(obj: ShapeState): number {
	let move = 0;
	let moveParity = 0;
	do {
		if ((obj.bottom & 2048) === 0) {
			move += 1;
			obj.bottom = obj.bottom << 1;
		} else {
			move += 2;
			obj.bottom = obj.bottom << 2 ^ 12291;
		}
		moveParity = 1 - moveParity;
	} while ((bitCount(obj.bottom & 63) & 1) !== 0);
	if ((bitCount(obj.bottom) & 2) === 0) {
		obj.parity ^= moveParity;
	}
	return move;
}

function Shape_getIdx(obj: ShapeState): number {
	return binarySearch(Shape_ShapeIdx, obj.top << 12 | obj.bottom) << 1 | obj.parity;
}

function Shape_setIdx(obj: ShapeState, idx: number): void {
	obj.parity = idx & 1;
	obj.top = Shape_ShapeIdx[idx >> 1];
	obj.bottom = obj.top & 4095;
	obj.top >>= 12;
}

function Shape_topMove(obj: ShapeState): number {
	let move = 0;
	let moveParity = 0;
	do {
		if ((obj.top & 2048) === 0) {
			move += 1;
			obj.top = obj.top << 1;
		} else {
			move += 2;
			obj.top = obj.top << 2 ^ 12291;
		}
		moveParity = 1 - moveParity;
	} while ((bitCount(obj.top & 63) & 1) !== 0);
	if ((bitCount(obj.top) & 2) === 0) {
		obj.parity ^= moveParity;
	}
	return move;
}

function Shape_getShape2Idx(shp: number): number {
	return binarySearch(Shape_ShapeIdx, shp & 0xffffff) << 1 | shp >> 24;
}

function Shape_init(): void {
	let count = 0;
	for (let i = 0; i < 28561; ++i) {
		const dr = Shape_halflayer[i % 13];
		const dl = Shape_halflayer[~~(i / 13) % 13];
		const ur = Shape_halflayer[~~(~~(i / 13) / 13) % 13];
		const ul = Shape_halflayer[~~(~~(~~(i / 13) / 13) / 13)];
		const value = ul << 18 | ur << 12 | dl << 6 | dr;
		if (bitCount(value) === 16) {
			Shape_ShapeIdx[count++] = value;
		}
	}
	const s = new ShapeState();
	for (let i = 0; i < 7356; ++i) {
		Shape_setIdx(s, i);
		Shape_TopMove[i] = Shape_topMove(s);
		Shape_TopMove[i] |= Shape_getIdx(s) << 4;
		Shape_setIdx(s, i);
		Shape_BottomMove[i] = Shape_bottomMove(s);
		Shape_BottomMove[i] |= Shape_getIdx(s) << 4;
		Shape_setIdx(s, i);
		const temp = s.top & 63;
		const p1 = bitCount(temp);
		const p3 = bitCount(s.bottom & 4032);
		s.parity ^= 1 & ((p1 & p3) >> 1);
		s.top = (s.top & 4032) | ((s.bottom >> 6) & 63);
		s.bottom = (s.bottom & 63) | (temp << 6);
		Shape_TwistMove[i] = Shape_getIdx(s);
	}
	for (let i = 0; i < 7536; ++i) {
		ShapePrun[i] = -1;
	}
	ShapePrun[Shape_getShape2Idx(14378715)] = 0;
	ShapePrun[Shape_getShape2Idx(31157686)] = 0;
	ShapePrun[Shape_getShape2Idx(23967451)] = 0;
	ShapePrun[Shape_getShape2Idx(7191990)] = 0;
	let done = 4;
	let done0 = 0;
	let depth = -1;
	while (done !== done0) {
		done0 = done;
		++depth;
		for (let i = 0; i < 7536; ++i) {
			if (ShapePrun[i] === depth) {
				let m = 0;
				let idx = i;
				do {
					idx = Shape_TopMove[idx];
					m += idx & 15;
					idx >>= 4;
					if (ShapePrun[idx] === -1) {
						++done;
						ShapePrun[idx] = depth + 1;
					}
				} while (m !== 12);
				m = 0;
				idx = i;
				do {
					idx = Shape_BottomMove[idx];
					m += idx & 15;
					idx >>= 4;
					if (ShapePrun[idx] === -1) {
						++done;
						ShapePrun[idx] = depth + 1;
					}
				} while (m !== 12);
				idx = Shape_TwistMove[i];
				if (ShapePrun[idx] === -1) {
					++done;
					ShapePrun[idx] = depth + 1;
				}
			}
		}
	}
}

function initShape(): void {
	if (shapeInitDone) return;
	shapeInitDone = true;
	Shape_ShapeIdx = [];
	ShapePrun = [];
	Shape_TopMove = [];
	Shape_BottomMove = [];
	Shape_TwistMove = [];
	Shape_init();
}

// ==================== Square tables (phase 2) ====================

let SquarePrun: number[] = [];
let Square_TwistMove: number[] = [];
let Square_TopMove: number[] = [];
let Square_BottomMove: number[] = [];

let squareInitDone = false;

function Square_init(): void {
	const pos: number[] = [];
	for (let i = 0; i < 40320; ++i) {
		setNPerm(pos, i, 8);
		circle(pos, 2, 4)(pos, 3, 5);
		Square_TwistMove[i] = getNPerm(pos, 8);
		setNPerm(pos, i, 8);
		circle(pos, 0, 3, 2, 1);
		Square_TopMove[i] = getNPerm(pos, 8);
		setNPerm(pos, i, 8);
		circle(pos, 4, 7, 6, 5);
		Square_BottomMove[i] = getNPerm(pos, 8);
	}
	for (let i = 0; i < 80640; ++i) {
		SquarePrun[i] = -1;
	}
	SquarePrun[0] = 0;
	let depth = 0;
	let done = 1;
	while (done < 80640) {
		const inv = depth >= 11;
		const find = inv ? -1 : depth;
		const check = inv ? depth : -1;
		++depth;
		OUT: for (let i = 0; i < 80640; ++i) {
			if (SquarePrun[i] === find) {
				const idx = i >> 1;
				const ml = i & 1;
				let idxx = Square_TwistMove[idx] << 1 | (1 - ml);
				if (SquarePrun[idxx] === check) {
					++done;
					SquarePrun[inv ? i : idxx] = depth;
					if (inv) continue OUT;
				}
				idxx = idx;
				for (let m = 0; m < 4; ++m) {
					idxx = Square_TopMove[idxx];
					if (SquarePrun[idxx << 1 | ml] === check) {
						++done;
						SquarePrun[inv ? i : idxx << 1 | ml] = depth;
						if (inv) continue OUT;
					}
				}
				for (let m = 0; m < 4; ++m) {
					idxx = Square_BottomMove[idxx];
					if (SquarePrun[idxx << 1 | ml] === check) {
						++done;
						SquarePrun[inv ? i : idxx << 1 | ml] = depth;
						if (inv) continue OUT;
					}
				}
			}
		}
	}
}

function initSquare(): void {
	if (squareInitDone) return;
	squareInitDone = true;
	SquarePrun = [];
	Square_TwistMove = [];
	Square_TopMove = [];
	Square_BottomMove = [];
	Square_init();
}

// ==================== CSP cases ====================

let cspcases: (number | number[])[] = [
	0, 1, 3, 18, 19,
	1004, 1005, 1006, 1007, 1008, 1009, 1011, 1015, 1016, 1018,
	1154, 1155, 1156, 1157, 1158, 1159, 1161, 1166, 1168,
	424, 425, 426, 427, 428, 429, 431, 436,
	95, 218, 341, 482, 528, 632, 1050,
	342, 343, 345, 346, 348, 353,
	223, 487, 533, 535, 1055,
	219, 225, 483, 489, 639, 1051, 1057,
	486, 1054, 1062,
	6, 21, 34, 46, 59, 71, 144, 157, 182, 305,
	7, 22, 35, 47, 60, 72, 145, 158, 183, 306,
	8, 23, 36, 48, 61, 73, 146, 159, 184, 307
];

let cspInitDone = false;

function CSPInit(): void {
	if (cspInitDone) return;
	cspInitDone = true;
	const s = new ShapeState();
	for (let csp = 0; csp < cspcases.length; csp++) {
		const curCases: number[] = [cspcases[csp] as number];
		for (let i = 0; i < curCases.length; i++) {
			let shape = curCases[i];
			do {
				shape = Shape_TopMove[shape << 1] >> 5;
				if (curCases.indexOf(shape) === -1) {
					curCases.push(shape);
				}
			} while (shape !== curCases[i]);
			do {
				shape = Shape_BottomMove[shape << 1] >> 5;
				if (curCases.indexOf(shape) === -1) {
					curCases.push(shape);
				}
			} while (shape !== curCases[i]);
			Shape_setIdx(s, shape << 1);
			const tmp = s.top;
			s.top = s.bottom;
			s.bottom = tmp;
			shape = Shape_getIdx(s) >> 1;
			if (curCases.indexOf(shape) === -1) {
				curCases.push(shape);
			}
		}
		cspcases[csp] = curCases;
	}
}

// ==================== PLL data ====================

const pll_map: [number, number][] = [
	[0x1032, 0x3210], // H
	[0x3102, 0x3210], // Ua
	[0x3021, 0x3210], // Ub
	[0x2301, 0x3210], // Z
	[0x3210, 0x3021], // Aa
	[0x3210, 0x3102], // Ab
	[0x3210, 0x2301], // E
	[0x3012, 0x3201], // F
	[0x2130, 0x3021], // Gb
	[0x1320, 0x3102], // Ga
	[0x3021, 0x3102], // Gc
	[0x3102, 0x3021], // Gd
	[0x3201, 0x3201], // Ja
	[0x3120, 0x3201], // Jb
	[0x1230, 0x3012], // Na
	[0x3012, 0x3012], // Nb
	[0x0213, 0x3201], // Ra
	[0x2310, 0x3201], // Rb
	[0x1230, 0x3201], // T
	[0x3120, 0x3012], // V
	[0x3201, 0x3012], // Y
];

const pllprobs: number[] = [
	1, 4, 4, 2,
	4, 4, 2, 4,
	4, 4, 4, 4,
	4, 4, 1, 1,
	4, 4, 4, 4, 4
];

// ==================== Shared search state ====================

const search = createSearchState();

// ==================== Generator functions ====================

function square1SolverGetRandomScramble(): string {
	initShape();
	initSquare();
	return Search_solution(search, FullCube_randomCube());
}

function getCSPScramble(): string {
	initShape();
	initSquare();
	CSPInit();
	const casePool = cspcases[rn(cspcases.length)];
	const pool = Array.isArray(casePool) ? casePool : [casePool];
	const idx = pool[rn(pool.length)];
	return Search_solution(search, FullCube_randomCube(idx));
}

function getPLLScramble(): string {
	initShape();
	initSquare();
	// Weighted random PLL case
	let total = 0;
	for (let i = 0; i < pllprobs.length; i++) total += pllprobs[i];
	let r = rn(total);
	let pllIdx = 0;
	for (let i = 0; i < pllprobs.length; i++) {
		r -= pllprobs[i];
		if (r < 0) {
			pllIdx = i;
			break;
		}
	}
	const pllcase = pll_map[pllIdx];
	const cc = new SqCubie();
	const rnVal = rn(4) * 0x1111;
	const rn2 = rn(4) * 4;
	let ep = (0x4444 - pllcase[0] + rnVal) & 0x3333;
	let cp = (0x3333 - pllcase[1] + rnVal) & 0x3333;
	ep = (ep | ep << 16) >> rn2;
	cp = (cp | cp << 16) >> rn2;
	for (let i = 0; i < 4; i++) {
		const c = ((cp >> (12 - i * 4)) & 0xf) << 1 | 1;
		cc.setPiece(i * 3 + 1, c);
		cc.setPiece(i * 3 + 2, c);
		cc.setPiece((i * 3 + 3) % 12, ((ep >> (12 - i * 4)) & 0xf) << 1);
	}
	if (rn(2) !== 0) {
		cc.doMove(1);
	}
	cc.ml = rn(2);
	return Search_solution(search, cc);
}

// ==================== Registration ====================

registerGenerator('sqrs', (_typeId: string) => {
	return square1SolverGetRandomScramble();
});

registerGenerator('sqrcsp', (_typeId: string) => {
	return getCSPScramble();
});

registerGenerator('sq1pll', (_typeId: string) => {
	return getPLLScramble();
});

// ==================== Exports ====================

export { SqCubie, square1SolverGetRandomScramble };
