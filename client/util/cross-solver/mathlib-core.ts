// Ported from cstimer mathlib.js - only the subset needed for cross/eoline/roux1 solvers

// Binomial coefficients
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

export function getPruning(table: number[], index: number): number {
	return (table[index >> 3] >> ((index & 7) << 2)) & 15;
}

function setPruning(table: number[], index: number, value: number): void {
	table[index >> 3] ^= (15 ^ value) << ((index & 7) << 2);
}

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
		idx = Math.floor(idx / base);
	}
	arr[0] = (evenbase < 0 ? parity : idx) % base;
	return arr;
}

// Coord class for createMove array-based doMove
class Coord {
	length: number;
	evenbase: number;
	get: (arr: number[]) => number;
	set: (arr: number[], idx: number) => number[];

	constructor(type: string, length: number, evenbase: number) {
		this.length = length;
		this.evenbase = evenbase;
		if (type === 'p') {
			this.get = (arr) => getNPerm(arr, this.length, this.evenbase);
			this.set = (arr, idx) => setNPerm(arr, idx, this.length, this.evenbase);
		} else if (type === 'o') {
			this.get = (arr) => getNOri(arr, this.length, this.evenbase);
			this.set = (arr, idx) => setNOri(arr, idx, this.length, this.evenbase);
		} else {
			throw new Error(`Invalid Coord type: ${type}`);
		}
	}
}

export function circleOri(arr: number[], a: number, b: number, c: number, d: number, ori: number): void {
	const temp = arr[a];
	arr[a] = arr[d] ^ ori;
	arr[d] = arr[c] ^ ori;
	arr[c] = arr[b] ^ ori;
	arr[b] = temp ^ ori;
}

export function circle<T>(arr: T[], ...indices: number[]): void {
	const temp = arr[indices[indices.length - 1]];
	for (let i = indices.length - 1; i > 0; i--) {
		arr[indices[i]] = arr[indices[i - 1]];
	}
	arr[indices[0]] = temp;
}

export function edgeMove(arr: number[], m: number): void {
	if (m === 0) {
		circleOri(arr, 0, 7, 8, 4, 1);
	} else if (m === 1) {
		circleOri(arr, 3, 6, 11, 7, 0);
	} else if (m === 2) {
		circleOri(arr, 0, 1, 2, 3, 0);
	} else if (m === 3) {
		circleOri(arr, 2, 5, 10, 6, 1);
	} else if (m === 4) {
		circleOri(arr, 1, 4, 9, 5, 0);
	} else if (m === 5) {
		circleOri(arr, 11, 10, 9, 8, 0);
	}
}

type DoMoveFunc = (idx: number, move: number) => number;
type DoMoveArray = [typeof edgeMove, string, number, number];

export function createMove(
	moveTable: number[][],
	size: number,
	doMove: DoMoveFunc | DoMoveArray,
	N_MOVES?: number
): void {
	N_MOVES = N_MOVES || 6;
	if (Array.isArray(doMove)) {
		const cord = new Coord(doMove[1], doMove[2], doMove[3]);
		const moveFn = doMove[0];
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

export function createPrun(
	prun: number[],
	initVal: number | number[],
	size: number,
	maxd?: number,
	doMove?: DoMoveFunc | number[][],
	N_MOVES?: number,
	N_POWER?: number,
	N_INV?: number
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
			if ((val & 0xf) !== find) {
				continue;
			}
			let skip = false;
			for (let m = 0; m < N_MOVES; m++) {
				let q = p;
				for (let c = 0; c < N_POWER; c++) {
					q = isMoveTable ? (doMove as number[][])[m][q] : (doMove as DoMoveFunc)(q, m);
					if (q < 0) {
						break;
					}
					if (getPruning(prun, q) !== check) {
						continue;
					}
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
		if (done === 0) {
			break;
		}
	}
}

function valuedArray(len: number, val: number | ((i: number) => number)): number[] {
	const ret: number[] = [];
	const isFun = typeof val === 'function';
	for (let i = 0; i < len; i++) {
		ret[i] = isFun ? (val as (i: number) => number)(i) : (val as number);
	}
	return ret;
}

// IDA* Searcher
export class Searcher {
	private isSolved: (state: number[]) => boolean;
	private getPrunFn: (state: number[]) => number;
	private doMoveFn: (state: number[], axis: number, pow?: number) => number[] | null;
	private N_AXIS: number;
	private N_POWER: number;
	private ckmv: number[];
	private sol: number[][];
	private length: number;
	private idxs: number[][];
	private sidx: number;
	private cost: number;
	private callback: (sol: number[][], sidx: number) => boolean;

	constructor(
		isSolved: ((state: number[]) => boolean) | null,
		getPrunFn: (state: number[]) => number,
		doMoveFn: (state: number[], axis: number, pow?: number) => number[] | null,
		N_AXIS: number,
		N_POWER: number,
		ckmv?: number[]
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

	solve(idx: number[], minl: number, MAXL: number): number[][] | null {
		const sols = this.solveMulti([idx], minl, MAXL);
		return sols == null ? null : sols[0];
	}

	solveMulti(idxs: number[][], minl: number, MAXL: number): [number[][], number] | null {
		this.sidx = 0;
		this.sol = [];
		this.length = minl;
		this.idxs = idxs;
		return this.nextMulti(MAXL);
	}

	private nextMulti(MAXL: number): [number[][], number] | null {
		this.cost = 1e9 + 1;
		this.callback = () => true;
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

	private idaSearch(idx: number[], maxl: number, depth: number, lm: number, sol: number[][]): number {
		if (--this.cost <= 0) {
			return 0;
		}
		const prun = this.getPrunFn(idx);
		if (prun > maxl) {
			return prun > maxl + 1 ? 2 : 1;
		} else if (maxl === 0) {
			return this.isSolved(idx) && this.callback(sol, this.sidx) ? 0 : 1;
		} else if (prun === 0 && maxl === 1 && this.isSolved(idx)) {
			return 1;
		}
		let axis = sol.length > depth ? sol[depth][0] : 0;
		for (; axis < this.N_AXIS; axis++) {
			if (lm >= 0 && (this.ckmv[lm] >> axis) & 1) {
				continue;
			}
			let idx1: number[] | null = idx.slice();
			let pow = sol.length > depth ? sol[depth][1] : 0;
			for (; pow < this.N_POWER; pow++) {
				idx1 = this.doMoveFn(idx1!, axis, pow);
				if (idx1 == null) {
					break;
				}
				sol[depth] = [axis, pow];
				const ret = this.idaSearch(idx1, maxl - 1, depth + 1, axis, sol);
				if (ret === 0) {
					return 0;
				}
				sol.pop();
				if (ret === 2) {
					break;
				}
			}
		}
		return 1;
	}
}

// Solver class - multi-coordinate wrapper around Searcher
export class Solver {
	private N_STATES: number;
	private N_MOVES: number;
	private N_POWER: number;
	private stateParams: any[][];
	private move: number[][][];
	private prunTables: number[][];
	private solv: Searcher | null;
	private inited: boolean;

	constructor(N_MOVES: number, N_POWER: number, stateParams: any[][]) {
		this.N_STATES = stateParams.length;
		this.N_MOVES = N_MOVES;
		this.N_POWER = N_POWER;
		this.stateParams = stateParams;
		this.move = [];
		this.prunTables = [];
		this.solv = null;
		this.inited = false;
	}

	init(): void {
		if (this.inited) return;
		this.move = [];
		this.prunTables = [];
		for (let i = 0; i < this.N_STATES; i++) {
			const stateParam = this.stateParams[i];
			const initVal = stateParam[0];
			const doMove = stateParam[1];
			const size = stateParam[2];
			const maxd = stateParam[3];
			const N_INV = stateParam[4];
			this.move[i] = [];
			this.prunTables[i] = [];
			createMove(this.move[i], size, doMove, this.N_MOVES);
			createPrun(this.prunTables[i], initVal, size, maxd, this.move[i], this.N_MOVES, this.N_POWER, N_INV);
		}
		this.solv = new Searcher(
			null,
			(state: number[]) => {
				let prun = 0;
				for (let i = 0; i < this.N_STATES; i++) {
					prun = Math.max(prun, getPruning(this.prunTables[i], state[i]));
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

	search(state: number[], minl: number, MAXL?: number): number[][] | null {
		MAXL = (MAXL || 99) + 1;
		if (!this.inited) {
			this.init();
		}
		return this.solv!.solve(state, minl, MAXL);
	}
}

// CubieCube - partial port for Roux1 solver
export class CubieCube {
	ca: number[];
	ea: number[];

	constructor() {
		this.ca = [0, 1, 2, 3, 4, 5, 6, 7];
		this.ea = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
	}

	init(ca: number[], ea: number[]): CubieCube {
		this.ca = ca.slice();
		this.ea = ea.slice();
		return this;
	}

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

	static moveCube: CubieCube[] = (() => {
		const mc: CubieCube[] = [];
		for (let i = 0; i < 18; i++) {
			mc[i] = new CubieCube();
		}
		// F=0, R=3, U=6, B=9, L=12, D=15 (base moves, *3 for quarter turns)
		// cstimer uses FRUBLD order: F=0, R=1, U=2, B=3, L=4, D=5
		// moveCube indices: 0,3,6,9,12,15 = base quarter turns
		mc[0].init([3, 0, 1, 2, 4, 5, 6, 7], [6, 0, 2, 4, 8, 10, 12, 14, 16, 18, 20, 22]);
		mc[3].init([20, 1, 2, 8, 15, 5, 6, 19], [16, 2, 4, 6, 22, 10, 12, 14, 8, 18, 20, 0]);
		mc[6].init([9, 21, 2, 3, 16, 12, 6, 7], [0, 19, 4, 6, 8, 17, 12, 14, 3, 11, 20, 22]);
		mc[9].init([0, 1, 2, 3, 5, 6, 7, 4], [0, 2, 4, 6, 10, 12, 14, 8, 16, 18, 20, 22]);
		mc[12].init([0, 10, 22, 3, 4, 17, 13, 7], [0, 2, 20, 6, 8, 10, 18, 14, 16, 4, 12, 22]);
		mc[15].init([0, 1, 11, 23, 4, 5, 18, 14], [0, 2, 4, 23, 8, 10, 12, 21, 16, 18, 7, 15]);
		for (let a = 0; a < 18; a += 3) {
			for (let p = 0; p < 2; p++) {
				CubieCube.CubeMult(mc[a + p], mc[a], mc[a + p + 1]);
			}
		}
		return mc;
	})();
}

// acycle - rotate array elements in a cycle
export function acycle(arr: string[], perm: number[], pow?: number): void {
	pow = pow || 1;
	const plen = perm.length;
	const tmp: string[] = [];
	for (let i = 0; i < plen; i++) {
		tmp[i] = arr[perm[i]];
	}
	for (let i = 0; i < plen; i++) {
		const j = (i + pow) % plen;
		arr[perm[j]] = tmp[i];
	}
}

// gSolver - string-based generic puzzle solver with BFS pruning
type MoveFunc = (state: string, move: string) => string | null;

export class GSolver {
	private solvedStates: string[];
	private doMove: MoveFunc;
	private movesList: [string, number][];
	private prunTable: Record<string, number>;
	private prunTableSize: number;
	private prunDepth: number;
	private prevSize: number;
	private toUpdateArr: string[] | null;
	private cost: number;
	private MAX_PRUN_SIZE: number;
	private sol: number[];
	private subOpt: boolean;
	private state: string;
	private visited: Record<string, number>;
	private maxl: number;
	private solArr: string[] | null;
	private prevSolStr: string | null;

	constructor(solvedStates: string[], doMove: MoveFunc, moves: Record<string, number>) {
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

	searchNext(MAXL?: number): string[] | null {
		MAXL = (MAXL !== undefined ? MAXL + 1 : undefined) || 99;
		this.prevSolStr = this.solArr ? this.solArr.join(',') : null;
		this.solArr = null;
		this.cost = -1;
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
