/**
 * 2x2x2 Scramble Generator with Subset Support
 * Ported from cstimer (https://github.com/cs0x7f/cstimer) - GPLv3
 *
 * Supports: Random State, Optimal, 3-gen, No Bar, EG, CLL, EG1, EG2,
 * TCLL+, TCLL-, TCLL, LS (Last Slot)
 */

// ==================== Math Utilities ====================

function rn(n: number): number {
	return ~~(Math.random() * n);
}

function rndPerm(n: number): number[] {
	const arr: number[] = [];
	for (let i = 0; i < n; i++) arr[i] = i;
	for (let i = 0; i < n - 1; i++) {
		const k = rn(n - i);
		if (k !== 0) {
			const tmp = arr[i];
			arr[i] = arr[i + k];
			arr[i + k] = tmp;
		}
	}
	return arr;
}

function acycle(arr: number[], perm: number[], pow?: number, ori?: number[] | null): void {
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
}

function getNPerm(arr: number[], n: number): number {
	let idx = 0;
	const vall_init = 0x76543210;
	const valh_init = 0xfedcba98;
	let vall = vall_init;
	let valh = valh_init;
	for (let i = 0; i < n - 1; i++) {
		const v = arr[i] << 2;
		idx *= n - i;
		if (v >= 32) {
			idx += (valh >>> (v - 32)) & 0xf;
			valh -= 0x11111110 << (v - 32);
		} else {
			idx += (vall >>> v) & 0xf;
			valh -= 0x11111111;
			vall -= 0x11111110 << v;
		}
	}
	return idx;
}

function setNPerm(arr: number[], idx: number, n: number): number[] {
	let vall = 0x76543210;
	let valh = 0xfedcba98;
	let prt = 0;
	for (let i = 0; i < n - 1; i++) {
		let p = 1;
		for (let j = 2; j <= n - 1 - i; j++) p *= j;
		const v = ~~(idx / p);
		idx = idx % p;
		prt ^= v;
		const vv = v << 2;
		if (vv >= 32) {
			const sv = vv - 32;
			arr[i] = (valh >>> sv) & 0xf;
			const m = (1 << sv) - 1;
			valh = (valh & m) + ((valh >>> 4) & ~m);
		} else {
			arr[i] = (vall >>> vv) & 0xf;
			const m = (1 << vv) - 1;
			vall = (vall & m) + ((vall >>> 4) & ~m) + ((valh << 28) >>> 0);
			valh = valh >>> 4;
		}
	}
	arr[n - 1] = vall & 0xf;
	return arr;
}

function getNOri(arr: number[], n: number, base: number): number {
	const absBase = Math.abs(base);
	let idx = base < 0 ? 0 : ((arr[0] % absBase) + absBase) % absBase;
	for (let i = n - 1; i > 0; i--) {
		idx = idx * absBase + ((arr[i] % absBase) + absBase) % absBase;
	}
	return idx;
}

function setNOri(arr: number[], idx: number, n: number, base: number): number[] {
	const absBase = Math.abs(base);
	let parity = absBase * n;
	for (let i = 1; i < n; i++) {
		arr[i] = idx % absBase;
		parity -= arr[i];
		idx = ~~(idx / absBase);
	}
	arr[0] = (base < 0 ? parity : idx) % absBase;
	return arr;
}

function getPruning(table: number[], index: number): number {
	return (table[index >>> 3] >>> ((index & 7) << 2)) & 15;
}

function valuedArray(len: number, val: number): number[] {
	const ret: number[] = [];
	for (let i = 0; i < len; i++) ret[i] = val;
	return ret;
}

function fillFacelet(
	facelets: number[][],
	f: number[],
	perm: number[],
	ori: number[],
	divcol: number
): void {
	for (let i = 0; i < facelets.length; i++) {
		const cubie = facelets[i];
		const p = perm[i] !== undefined ? perm[i] : i;
		const o = ori[i] || 0;
		for (let j = 0; j < cubie.length; j++) {
			f[cubie[(j + o) % cubie.length]] = ~~(facelets[p][j] / divcol);
		}
	}
}

// ==================== Coord Class ====================

class Coord {
	private length: number;
	private evenbase: number;

	constructor(_type: string, length: number, evenbase: number) {
		this.length = length;
		this.evenbase = evenbase;
	}

	get(arr: number[]): number {
		return getNOri(arr, this.length, this.evenbase);
	}

	set(arr: number[], idx: number): number[] {
		return setNOri(arr, idx, this.length, this.evenbase);
	}
}

// ==================== Move & Pruning Tables ====================
// Following cstimer's approach: move tables only store CW (single) moves.
// The search and pruning code chain CW moves to get 180 and CCW.

function createPrunTable(
	size: number,
	moveTable: number[][],
	nMoves: number,
	nPower: number
): number[] {
	const prun: number[] = [];
	const len = (size + 7) >>> 3;
	for (let i = 0; i < len; i++) prun[i] = -1;

	// Set solved state (index 0) to depth 0
	prun[0] ^= 15;

	for (let l = 0; l <= 256; l++) {
		let done = 0;
		const inv = l >= 256; // Never use inverse for small puzzles
		const fill = (l + 1) ^ 15;
		const find = inv ? 0xf : l;
		const check = inv ? l : 0xf;

		for (let p = 0; p < size; p++) {
			if ((getPruning(prun, p) & 0xf) !== find) continue;

			let found = false;
			for (let m = 0; m < nMoves && !found; m++) {
				let q = p;
				for (let c = 0; c < nPower; c++) {
					// Chain CW table: CW, CW(CW)=180, CW(CW(CW))=CCW
					q = moveTable[m][q];
					if (getPruning(prun, q) !== check) continue;
					done++;
					if (inv) {
						const shift = (p & 7) << 2;
						prun[p >>> 3] ^= fill << shift;
						found = true; // Break out like cstimer's "continue out"
						break;
					} else {
						const shift = (q & 7) << 2;
						prun[q >>> 3] ^= fill << shift;
					}
				}
			}
		}
		if (done === 0) break;
	}
	return prun;
}

// ==================== IDA* Solver ====================

interface SolverState {
	permMoveTable: number[][];
	oriMoveTable: number[][];
	permPrun: number[];
	oriPrun: number[];
	inited: boolean;
}

const N_MOVES = 3; // U, R, F
const N_POWER = 3; // CW, 180, CCW
const PERM_SIZE = 5040; // 7!
const ORI_SIZE = 729; // 3^6

const solverState: SolverState = {
	permMoveTable: [],
	oriMoveTable: [],
	permPrun: [],
	oriPrun: [],
	inited: false,
};

// 2x2 move definitions
const movePieces: number[][] = [
	[0, 2, 3, 1], // U
	[0, 1, 5, 4], // R
	[0, 4, 6, 2], // F
];

const moveOris: (number[] | null)[] = [
	null,                // U: no orientation change
	[0, 1, 0, 1, 3],    // R
	[1, 0, 1, 0, 3],    // F
];

const oriCoord = new Coord('o', 7, -3);

function doPermMove(arr: number[], m: number): void {
	acycle(arr, movePieces[m]);
}

function doOriMove(arr: number[], m: number): void {
	acycle(arr, movePieces[m], 1, moveOris[m]);
}

function initSolver(): void {
	if (solverState.inited) return;

	// Build permutation move table (CW only, one table per axis)
	solverState.permMoveTable = [];
	for (let m = 0; m < N_MOVES; m++) {
		solverState.permMoveTable[m] = [];
		for (let i = 0; i < PERM_SIZE; i++) {
			const arr = setNPerm(new Array(7), i, 7);
			doPermMove(arr, m);
			solverState.permMoveTable[m][i] = getNPerm(arr, 7);
		}
	}

	// Build orientation move table (CW only, one table per axis)
	solverState.oriMoveTable = [];
	for (let m = 0; m < N_MOVES; m++) {
		solverState.oriMoveTable[m] = [];
		for (let i = 0; i < ORI_SIZE; i++) {
			const arr = oriCoord.set(new Array(7), i);
			doOriMove(arr, m);
			solverState.oriMoveTable[m][i] = oriCoord.get(arr);
		}
	}

	// Build pruning tables
	solverState.permPrun = createPrunTable(PERM_SIZE, solverState.permMoveTable, N_MOVES, N_POWER);
	solverState.oriPrun = createPrunTable(ORI_SIZE, solverState.oriMoveTable, N_MOVES, N_POWER);

	solverState.inited = true;
}

function getPrunValue(permIdx: number, oriIdx: number): number {
	return Math.max(
		getPruning(solverState.permPrun, permIdx),
		getPruning(solverState.oriPrun, oriIdx)
	);
}

function idaSearch(
	permIdx: number,
	oriIdx: number,
	maxl: number,
	depth: number,
	lastMove: number,
	sol: [number, number][]
): boolean {
	const prun = getPrunValue(permIdx, oriIdx);
	if (prun > maxl) return false;
	if (maxl === 0) {
		return permIdx === 0 && oriIdx === 0;
	}

	for (let m = 0; m < N_MOVES; m++) {
		if (m === lastMove) continue;
		let pIdx = permIdx;
		let oIdx = oriIdx;
		for (let p = 0; p < N_POWER; p++) {
			// Chain CW table: each iteration applies one more CW
			pIdx = solverState.permMoveTable[m][pIdx];
			oIdx = solverState.oriMoveTable[m][oIdx];
			sol[depth] = [m, p];
			if (idaSearch(pIdx, oIdx, maxl - 1, depth + 1, m, sol)) {
				return true;
			}
		}
	}
	return false;
}

function solve(permIdx: number, oriIdx: number, maxDepth: number, minDepth: number = 0): [number, number][] {
	initSolver();
	for (let depth = minDepth; depth <= maxDepth; depth++) {
		const sol: [number, number][] = [];
		if (idaSearch(permIdx, oriIdx, depth, 0, -1, sol)) {
			return sol;
		}
	}
	return [];
}

function solToStr(sol: [number, number][]): string {
	const moveMap = 'URF';
	const powerMap = [' ', '2 ', "' "];
	return sol.map(([m, p]) => moveMap[m] + powerMap[p]).join('').trim();
}

// ==================== 2x2 Specific Data ====================

const cFacelet: number[][] = [
	[3, 4, 9],
	[1, 20, 5],
	[2, 8, 17],
	[0, 16, 21],
	[13, 11, 6],
	[15, 7, 22],
	[12, 19, 10],
];

const egperms: number[][] = [
	[4, 5, 6],  // solved
	[4, 6, 5],  // diagonal swap
	[6, 5, 4],  // adjacent swap variants
	[5, 4, 6],
	[5, 6, 4],
	[6, 4, 5],
];

const egmap = [0, 17, 5, 14, 8, 1, 2, 4];

// EG Last Layer case maps: [perm_hex, ori_hex, probability, name]
const egll_map: [number, number, number, string][] = [
	[0x3210, 0x1221, 2, 'H-1'], [0x3120, 0x1221, 2, 'H-2'],
	[0x2310, 0x1221, 4, 'H-3'], [0x3012, 0x1221, 4, 'H-4'],
	[0x0312, 0x0210, 4, 'L-1'], [0x2310, 0x0210, 4, 'L-2'],
	[0x0213, 0x0210, 4, 'L-3'], [0x3210, 0x0210, 4, 'L-4'],
	[0x2013, 0x0210, 4, 'L-5'], [0x3012, 0x0210, 4, 'L-6'],
	[0x3210, 0x1212, 4, 'Pi-1'], [0x0213, 0x1212, 4, 'Pi-2'],
	[0x2310, 0x1212, 4, 'Pi-3'], [0x2013, 0x1212, 4, 'Pi-4'],
	[0x3012, 0x1212, 4, 'Pi-5'], [0x0312, 0x1212, 4, 'Pi-6'],
	[0x3210, 0x2220, 4, 'S-1'], [0x0213, 0x2220, 4, 'S-2'],
	[0x0312, 0x2220, 4, 'S-3'], [0x3012, 0x2220, 4, 'S-4'],
	[0x2013, 0x2220, 4, 'S-5'], [0x2310, 0x2220, 4, 'S-6'],
	[0x2310, 0x1020, 4, 'T-1'], [0x2013, 0x1020, 4, 'T-2'],
	[0x0213, 0x1020, 4, 'T-3'], [0x3210, 0x1020, 4, 'T-4'],
	[0x3012, 0x1020, 4, 'T-5'], [0x0312, 0x1020, 4, 'T-6'],
	[0x0213, 0x2010, 4, 'U-1'], [0x3210, 0x2010, 4, 'U-2'],
	[0x0312, 0x2010, 4, 'U-3'], [0x3012, 0x2010, 4, 'U-4'],
	[0x2310, 0x2010, 4, 'U-5'], [0x2013, 0x2010, 4, 'U-6'],
	[0x3210, 0x1011, 4, 'aS-1'], [0x0213, 0x1011, 4, 'aS-2'],
	[0x0312, 0x1011, 4, 'aS-3'], [0x3012, 0x1011, 4, 'aS-4'],
	[0x2310, 0x1011, 4, 'aS-5'], [0x2013, 0x1011, 4, 'aS-6'],
];

const tcllp_map: [number, number, number, string][] = [
	[0x0123, 0x0221, 4, 'Hammer-1'], [0x3021, 0x0221, 4, 'Hammer-2'],
	[0x0132, 0x0221, 4, 'Hammer-3'], [0x0231, 0x0221, 4, 'Hammer-4'],
	[0x0321, 0x0221, 4, 'Hammer-5'], [0x2301, 0x0221, 4, 'Hammer-6'],
	[0x0123, 0x1022, 4, 'Spaceship-1'], [0x2301, 0x1022, 4, 'Spaceship-2'],
	[0x1320, 0x1022, 4, 'Spaceship-3'], [0x3021, 0x1022, 4, 'Spaceship-4'],
	[0x3012, 0x1022, 4, 'Spaceship-5'], [0x0231, 0x1022, 4, 'Spaceship-6'],
	[0x2031, 0x0002, 4, 'Stollery-1'], [0x3120, 0x0002, 4, 'Stollery-2'],
	[0x3201, 0x0002, 4, 'Stollery-3'], [0x2103, 0x0002, 4, 'Stollery-4'],
	[0x0231, 0x0002, 4, 'Stollery-5'], [0x2130, 0x0002, 4, 'Stollery-6'],
	[0x0123, 0x2222, 1, 'Pinwheel-1'], [0x1032, 0x2222, 1, 'Pinwheel-2'],
	[0x3201, 0x2222, 4, 'Pinwheel-3'],
	[0x2031, 0x0110, 2, '2Face-1'], [0x3102, 0x0110, 4, '2Face-2'],
	[0x0213, 0x0110, 2, '2Face-3'], [0x3021, 0x0110, 4, '2Face-4'],
	[0x1302, 0x0122, 4, 'Turtle-1'], [0x1032, 0x0122, 4, 'Turtle-2'],
	[0x3201, 0x0122, 4, 'Turtle-3'], [0x1230, 0x0122, 4, 'Turtle-4'],
	[0x2310, 0x0122, 4, 'Turtle-5'], [0x0321, 0x0122, 4, 'Turtle-6'],
	[0x3210, 0x1112, 4, 'PP-1'], [0x3120, 0x1112, 4, 'PP-2'],
	[0x3201, 0x1112, 4, 'PP-3'], [0x2103, 0x1112, 4, 'PP-4'],
	[0x2310, 0x1112, 4, 'PP-5'], [0x2130, 0x1112, 4, 'PP-6'],
	[0x2031, 0x0011, 4, 'Gun-1'], [0x1032, 0x0011, 4, 'Gun-2'],
	[0x0132, 0x0011, 4, 'Gun-3'], [0x3021, 0x0011, 4, 'Gun-4'],
	[0x2310, 0x0011, 4, 'Gun-5'], [0x2130, 0x0011, 4, 'Gun-6'],
];

const tclln_map: [number, number, number, string][] = [
	[0x1302, 0x1201, 4, 'Hammer-1'], [0x3021, 0x1201, 4, 'Hammer-2'],
	[0x2310, 0x1201, 4, 'Hammer-3'], [0x3201, 0x1201, 4, 'Hammer-4'],
	[0x1203, 0x1201, 4, 'Hammer-5'], [0x3120, 0x1201, 4, 'Hammer-6'],
	[0x0123, 0x1012, 4, 'Spaceship-1'], [0x1032, 0x1012, 4, 'Spaceship-2'],
	[0x0312, 0x1012, 4, 'Spaceship-3'], [0x3201, 0x1012, 4, 'Spaceship-4'],
	[0x1023, 0x1012, 4, 'Spaceship-5'], [0x2130, 0x1012, 4, 'Spaceship-6'],
	[0x0123, 0x0001, 4, 'Stollery-1'], [0x3120, 0x0001, 4, 'Stollery-2'],
	[0x0132, 0x0001, 4, 'Stollery-3'], [0x2103, 0x0001, 4, 'Stollery-4'],
	[0x3102, 0x0001, 4, 'Stollery-5'], [0x1203, 0x0001, 4, 'Stollery-6'],
	[0x0123, 0x1111, 1, 'Pinwheel-1'], [0x1032, 0x1111, 1, 'Pinwheel-2'],
	[0x1320, 0x1111, 4, 'Pinwheel-3'],
	[0x2031, 0x2002, 2, '2Face-1'], [0x0132, 0x2002, 4, '2Face-2'],
	[0x1032, 0x2002, 2, '2Face-3'], [0x3021, 0x2002, 4, '2Face-4'],
	[0x2031, 0x1102, 4, 'Turtle-1'], [0x3120, 0x1102, 4, 'Turtle-2'],
	[0x1023, 0x1102, 4, 'Turtle-3'], [0x3021, 0x1102, 4, 'Turtle-4'],
	[0x0132, 0x1102, 4, 'Turtle-5'], [0x1203, 0x1102, 4, 'Turtle-6'],
	[0x1302, 0x2122, 4, 'PP-1'], [0x0213, 0x2122, 4, 'PP-2'],
	[0x2013, 0x2122, 4, 'PP-3'], [0x0312, 0x2122, 4, 'PP-4'],
	[0x2310, 0x2122, 4, 'PP-5'], [0x0321, 0x2122, 4, 'PP-6'],
	[0x0123, 0x0022, 4, 'Gun-1'], [0x1032, 0x0022, 4, 'Gun-2'],
	[0x0132, 0x0022, 4, 'Gun-3'], [0x2310, 0x0022, 4, 'Gun-4'],
	[0x0312, 0x0022, 4, 'Gun-5'], [0x2130, 0x0022, 4, 'Gun-6'],
];

const tcll_map: [number, number, number, string][] = [
	[0x0123, 0x0221, 4, 'TCLL1-Hammer'], [0x0123, 0x1022, 4, 'TCLL1-Spaceship'],
	[0x2031, 0x0002, 4, 'TCLL1-Stollery'], [0x0123, 0x2222, 1, 'TCLL1-Pinwheel'],
	[0x2031, 0x0110, 2, 'TCLL1-2Face'], [0x1302, 0x0122, 4, 'TCLL1-Turtle'],
	[0x3210, 0x1112, 4, 'TCLL1-PP'], [0x2031, 0x0011, 4, 'TCLL1-Gun'],
	[0x1302, 0x1201, 4, 'TCLL2-Hammer'], [0x0123, 0x1012, 4, 'TCLL2-Spaceship'],
	[0x0123, 0x0001, 4, 'TCLL2-Stollery'], [0x0123, 0x1111, 1, 'TCLL2-Pinwheel'],
	[0x2031, 0x2002, 2, 'TCLL2-2Face'], [0x2031, 0x1102, 4, 'TCLL2-Turtle'],
	[0x1302, 0x2122, 4, 'TCLL2-PP'], [0x0123, 0x0022, 4, 'TCLL2-Gun'],
];

const lsall_map: [number, string][] = [
	[0x00000, 'LS1-PBL'], [0x00222, 'LS1-Sune'], [0x00111, 'LS1-aSune'],
	[0x00102, 'LS1-Ua'], [0x00021, 'LS1-Ub'], [0x00120, 'LS1-La'],
	[0x00210, 'LS1-Lb'], [0x00201, 'LS1-Ta'], [0x00012, 'LS1-Tb'],
	[0x10221, 'LS2-Hammer'], [0x10212, 'LS2-Spaceship'],
	[0x10200, 'LS2-StolleryA'], [0x10002, 'LS2-StolleryB'],
	[0x10020, 'LS2-StolleryC'], [0x10110, 'LS2-2Face'],
	[0x10122, 'LS2-Turtle'], [0x10011, 'LS2-GunA'], [0x10101, 'LS2-GunB'],
	[0x20112, 'LS3-Hammer'], [0x20211, 'LS3-Spaceship'],
	[0x20100, 'LS3-StolleryA'], [0x20001, 'LS3-StolleryB'],
	[0x20010, 'LS3-StolleryC'], [0x20220, 'LS3-2Face'],
	[0x20121, 'LS3-Turtle'], [0x20022, 'LS3-GunA'], [0x20202, 'LS3-GunB'],
	[0x02022, 'LS4-SuneA'], [0x02220, 'LS4-SuneB'], [0x02202, 'LS4-SuneC'],
	[0x02211, 'LS4-PiA'], [0x02121, 'LS4-PiB'], [0x02010, 'LS4-U'],
	[0x02001, 'LS4-L'], [0x02100, 'LS4-T'], [0x02112, 'LS4-H'],
	[0x12012, 'LS5-HammerA'], [0x12102, 'LS5-HammerB'],
	[0x12120, 'LS5-SpaceshipA'], [0x12201, 'LS5-SpaceshipB'],
	[0x12000, 'LS5-Stollery'], [0x12222, 'LS5-Pinwheel'],
	[0x12021, 'LS5-TurtleA'], [0x12210, 'LS5-TurtleB'],
	[0x12111, 'LS5-PP'],
	[0x22110, 'LS6-Hammer'], [0x22101, 'LS6-Spaceship'],
	[0x22002, 'LS6-2Face'], [0x22011, 'LS6-Turtle'],
	[0x22122, 'LS6-PPA'], [0x22221, 'LS6-PPB'], [0x22212, 'LS6-PPC'],
	[0x22200, 'LS6-GunA'], [0x22020, 'LS6-GunB'],
	[0x01011, 'LS7-aSuneA'], [0x01110, 'LS7-aSuneB'], [0x01101, 'LS7-aSuneC'],
	[0x01212, 'LS7-PiA'], [0x01122, 'LS7-PiB'], [0x01200, 'LS7-U'],
	[0x01002, 'LS7-L'], [0x01020, 'LS7-T'], [0x01221, 'LS7-H'],
	[0x11220, 'LS8-Hammer'], [0x11022, 'LS8-Spaceship'],
	[0x11001, 'LS8-2Face'], [0x11202, 'LS8-Turtle'],
	[0x11121, 'LS8-PPA'], [0x11112, 'LS8-PPB'], [0x11211, 'LS8-PPC'],
	[0x11010, 'LS8-GunA'], [0x11100, 'LS8-GunB'],
	[0x21201, 'LS9-HammerA'], [0x21021, 'LS9-HammerB'],
	[0x21012, 'LS9-SpaceshipA'], [0x21120, 'LS9-SpaceshipB'],
	[0x21000, 'LS9-Stollery'], [0x21111, 'LS9-Pinwheel'],
	[0x21102, 'LS9-TurtleA'], [0x21210, 'LS9-TurtleB'],
	[0x21222, 'LS9-PP'],
];

// Probability arrays (extract weight column from case maps)
const egllprobs = egll_map.map(c => c[2]);
const tcllpprobs = tcllp_map.map(c => c[2]);
const tcllnprobs = tclln_map.map(c => c[2]);
const tcllprobs = tcll_map.map(c => c[2]);

// ==================== Weighted Random Case Selection ====================

function fixCase(probs: number[]): number {
	let cum = 0;
	let curIdx = 0;
	for (let i = 0; i < probs.length; i++) {
		if (probs[i] === 0) continue;
		if (Math.random() < probs[i] / (cum + probs[i])) {
			curIdx = i;
		}
		cum += probs[i];
	}
	return curIdx;
}

// ==================== No Bar Check ====================

function checkNoBar(pidx: number, oidx: number): boolean {
	const perm = setNPerm(new Array(7), pidx, 7);
	const ori = oriCoord.set(new Array(7), oidx);
	const f: number[] = [];
	for (let i = 0; i < 24; i++) f[i] = i >> 2;
	fillFacelet(cFacelet, f, perm, ori, 4);
	for (let i = 0; i < 24; i += 4) {
		if ((1 << f[i] | 1 << f[i + 3]) & (1 << f[i + 1] | 1 << f[i + 2])) {
			return false;
		}
	}
	return true;
}

// ==================== Scramble Generators ====================

function getRandomStateScramble(optimal: boolean): string {
	initSolver();
	const maxl = optimal ? 11 : 9;
	let perm: number, ori: number;
	do {
		perm = rn(PERM_SIZE);
		ori = rn(ORI_SIZE);
	} while ((perm === 0 && ori === 0) || solve(perm, ori, 0, 3).length > 0 === false && perm === 0 && ori === 0);

	// Ensure non-trivial scramble (at least 3 moves)
	let sol: [number, number][];
	do {
		perm = rn(PERM_SIZE);
		ori = rn(ORI_SIZE);
		sol = solve(perm, ori, maxl);
	} while (sol.length < 3);

	return solToStr(sol.reverse());
}

function getNoBarScramble(): string {
	initSolver();
	let perm: number, ori: number;
	let sol: [number, number][];
	do {
		do {
			perm = rn(PERM_SIZE);
			ori = rn(ORI_SIZE);
		} while (!checkNoBar(perm, ori));
		sol = solve(perm, ori, 11);
	} while (sol.length < 3);

	return solToStr(sol.reverse());
}

function getEGScramble(state: number): string {
	initSolver();
	const oriIdx = egmap[state & 0x7];
	const permVariant = [0, 2, 3, 4, 5, 1][state >> 3];
	const arr = setNPerm(
		[0, 0, 0, 0].concat(egperms[permVariant]),
		rn(24),
		4
	);
	const perm = getNPerm(arr, 7);
	const ori = oriCoord.set(new Array(7), oriIdx);
	let rndU = rn(4);
	while (rndU-- > 0) {
		doOriMove(ori, 0);
	}
	const oriResult = oriCoord.get(ori);

	const sol = solve(perm, oriResult, 11);
	return solToStr(sol.reverse());
}

function getLLScramble(type: string): string {
	initSolver();
	let llcase: number[];
	let ncubie = 4;
	const perm = [0, 1, 2, 3];
	const ori = [0, 0, 0, 0, 0, 0, 0];

	if (type === '222tcp') {
		const caseData = tcllp_map[fixCase(tcllpprobs)];
		llcase = [caseData[0], caseData[1]];
		ori[4] = 1;
		perm.push(...egperms[0]);
	} else if (type === '222tcn') {
		const caseData = tclln_map[fixCase(tcllnprobs)];
		llcase = [caseData[0], caseData[1]];
		ori[4] = 2;
		perm.push(...egperms[0]);
	} else if (type === '222tc') {
		const tcllIdx = fixCase(tcllprobs);
		const caseData = tcll_map[tcllIdx];
		llcase = [caseData[0], caseData[1]];
		ori[4] = tcllIdx < 8 ? 1 : 2;
		perm.push(...egperms[0]);
		const perm4 = rndPerm(4);
		llcase[0] = 0;
		for (let i = 0; i < 4; i++) {
			llcase[0] |= perm4[i] << (i * 4);
		}
	} else if (type === '222eg0') {
		const caseData = egll_map[fixCase(egllprobs)];
		llcase = [caseData[0], caseData[1]];
		perm.push(...egperms[0]);
	} else if (type === '222eg1') {
		const caseData = egll_map[fixCase(egllprobs)];
		llcase = [caseData[0], caseData[1]];
		perm.push(...egperms[2 + rn(4)]);
	} else if (type === '222eg2') {
		const caseData = egll_map[fixCase(egllprobs)];
		llcase = [caseData[0], caseData[1]];
		perm.push(...egperms[1]);
	} else if (type === '222lsall') {
		perm.push(...egperms[0]);
		const perm4 = rndPerm(4);
		perm4.push(perm4[3]);
		perm4[3] = 4;
		const lsCase = lsall_map[fixCase(valuedArray(lsall_map.length, 1))];
		llcase = [0, lsCase[0] as number];
		for (let i = 0; i < 5; i++) {
			llcase[0] |= perm4[i] << (i * 4);
		}
		ncubie = 5;
	} else {
		return '';
	}

	// Apply random AUF to first layer
	let rndA = rn(4);
	while (rndA-- > 0) {
		doPermMove(perm, 0);
	}

	// Apply case permutation and orientation to top layer
	const perm0 = perm.slice();
	for (let i = 0; i < ncubie; i++) {
		perm[i] = perm0[(llcase![0] >> (i * 4)) & 0xf];
		ori[i] = (llcase![1] >> (i * 4)) & 0xf;
	}

	// Apply random U move
	let rndU = rn(4);
	while (rndU-- > 0) {
		doOriMove(ori, 0);
		doPermMove(perm, 0);
	}

	const permIdx = getNPerm(perm, 7);
	const oriIdx = oriCoord.get(ori);

	const sol = solve(permIdx, oriIdx, 11);
	return solToStr(sol.reverse());
}

function generate3GenScramble(length: number = 25): string {
	const moves = ['U', 'R', 'F'];
	const suffixes = ['', "'", '2'];
	const result: string[] = [];
	let lastMove = -1;

	for (let i = 0; i < length; i++) {
		let move: number;
		do {
			move = rn(3);
		} while (move === lastMove);
		lastMove = move;
		result.push(moves[move] + suffixes[rn(3)]);
	}

	return result.join(' ');
}

// ==================== Main Export ====================

export function generate222Scramble(subsetId: string): string {
	switch (subsetId) {
		case '222o':
			return getRandomStateScramble(true);
		case '222so':
			return getRandomStateScramble(false);
		case '2223':
			return generate3GenScramble(25);
		case '222nb':
			return getNoBarScramble();
		case '222eg': {
			const state = rn(48); // Random EG case from all 48
			return getEGScramble(state);
		}
		case '222eg0':
		case '222eg1':
		case '222eg2':
		case '222tcp':
		case '222tcn':
		case '222tc':
		case '222lsall':
			return getLLScramble(subsetId);
		default:
			return '';
	}
}
