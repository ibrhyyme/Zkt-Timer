/**
 * Clock scramble generator using random-state solver.
 * Ported from cstimer (GPLv3) — Gaussian elimination over Z/12Z.
 *
 * Instead of random moves, this generates a random clock state and solves it
 * to produce a WCA-standard optimal scramble.
 */

// Precompute binomial coefficients C(n, k)
const MAX_N = 19;
const Cnk: number[][] = [];
for (let i = 0; i <= MAX_N; i++) {
	Cnk[i] = [];
	for (let j = 0; j <= MAX_N; j++) {
		if (j === 0 || j === i) {
			Cnk[i][j] = 1;
		} else if (j > i) {
			Cnk[i][j] = 0;
		} else {
			Cnk[i][j] = Cnk[i - 1][j - 1] + Cnk[i - 1][j];
		}
	}
}

function rn(n: number): number {
	return Math.floor(Math.random() * n);
}

// Each row describes how a move affects the 14 clock positions (9 front + 5 back-related).
// Rows 0-8: front side moves (UR, DR, DL, UL, U, R, D, L, ALL)
// Rows 9-17: back side moves (same pin names after y2)
export const moveArr: number[][] = [
	[0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], // UR
	[0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0], // DR
	[0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0], // DL
	[1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0], // UL
	[1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0], // U
	[0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0], // R
	[0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], // D
	[1, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0], // L
	[1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0], // ALL
	[11, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0], // UR (back)
	[0, 0, 0, 0, 0, 0, 11, 0, 0, 0, 0, 1, 1, 1], // DR (back)
	[0, 0, 0, 0, 0, 0, 0, 0, 11, 0, 1, 1, 0, 1], // DL (back)
	[0, 0, 11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0], // UL (back)
	[11, 0, 11, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0], // U (back)
	[11, 0, 0, 0, 0, 0, 11, 0, 0, 1, 0, 1, 1, 1], // R (back)
	[0, 0, 0, 0, 0, 0, 11, 0, 11, 0, 1, 1, 1, 1], // D (back)
	[0, 0, 11, 0, 0, 0, 0, 0, 11, 1, 1, 1, 0, 1], // L (back)
	[11, 0, 11, 0, 0, 0, 11, 0, 11, 1, 1, 1, 1, 1], // ALL (back)
];

// Multiplicative inverses in Z/12Z: only 1, 5, 7, 11 are invertible
const invert = [-1, 1, -1, -1, -1, 5, -1, 7, -1, -1, -1, 11];

const TURNS = ['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'];

// Linearly dependent column sets (bitmasks) to skip during search
const LD_LIST = [7695, 42588, 47187, 85158, 86697, 156568, 181700, 209201, 231778];

function select(n: number, k: number, idx: number): number {
	let r = k;
	let val = 0;
	for (let i = n - 1; i >= 0; i--) {
		if (idx >= Cnk[i][r]) {
			idx -= Cnk[i][r--];
			val |= 1 << i;
		}
	}
	return val;
}

function randomState(): number[] {
	const ret: number[] = [];
	for (let i = 0; i < 14; i++) {
		ret[i] = rn(12);
	}
	return ret;
}

function swap(arr: number[][], row1: number, row2: number): void {
	const tmp = arr[row1];
	arr[row1] = arr[row2];
	arr[row2] = tmp;
}

function addTo(arr: number[][], row1: number, row2: number, startIdx: number, mul: number): void {
	const length = arr[0].length;
	for (let i = startIdx; i < length; i++) {
		arr[row2][i] = (arr[row2][i] + arr[row1][i] * mul) % 12;
	}
}

function gaussianElimination(arr: number[][]): number {
	const m = 14;
	const n = arr[0].length;

	for (let i = 0; i < n - 1; i++) {
		if (invert[arr[i][i]] === -1) {
			let ivtIdx = -1;

			for (let j = i + 1; j < m; j++) {
				if (invert[arr[j][i]] !== -1) {
					ivtIdx = j;
					break;
				}
			}

			if (ivtIdx === -1) {
				let found = false;
				for (let j1 = i; j1 < m - 1 && !found; j1++) {
					for (let j2 = j1 + 1; j2 < m && !found; j2++) {
						if (invert[(arr[j1][i] + arr[j2][i]) % 12] !== -1) {
							addTo(arr, j2, j1, i, 1);
							ivtIdx = j1;
							found = true;
						}
					}
				}
			}

			if (ivtIdx === -1) {
				for (let j = i + 1; j < m; j++) {
					if (arr[j][i] !== 0) {
						return -1;
					}
				}
				return i + 1;
			}
			swap(arr, i, ivtIdx);
		}

		const inv = invert[arr[i][i]];
		for (let j = i; j < n; j++) {
			arr[i][j] = (arr[i][j] * inv) % 12;
		}
		for (let j = i + 1; j < m; j++) {
			addTo(arr, i, j, i, 12 - arr[j][i]);
		}
	}
	return 0;
}

function backSubstitution(arr: number[][]): void {
	const n = arr[0].length;
	for (let i = n - 2; i > 0; i--) {
		for (let j = i - 1; j >= 0; j--) {
			if (arr[j][i] !== 0) {
				addTo(arr, i, j, i, 12 - arr[j][i]);
			}
		}
	}
}

function solveIn(k: number, numbers: number[], solution: number[]): number {
	const n = 18;
	let minNz = k + 1;

	for (let idx = 0; idx < Cnk[n][k]; idx++) {
		const val = select(n, k, idx);

		let isLD = false;
		for (let r = 0; r < LD_LIST.length; r++) {
			if ((val & LD_LIST[r]) === LD_LIST[r]) {
				isLD = true;
				break;
			}
		}
		if (isLD) continue;

		const map: number[] = [];
		let cnt = 0;
		for (let j = 0; j < n; j++) {
			if (((val >> j) & 1) === 1) {
				map[cnt++] = j;
			}
		}

		const arr: number[][] = [];
		for (let i = 0; i < 14; i++) {
			arr[i] = [];
			for (let j = 0; j < k; j++) {
				arr[i][j] = moveArr[map[j]][i];
			}
			arr[i][k] = numbers[i];
		}

		const ret = gaussianElimination(arr);
		if (ret !== 0) continue;

		let isSolved = true;
		for (let i = k; i < 14; i++) {
			if (arr[i][k] !== 0) {
				isSolved = false;
				break;
			}
		}
		if (!isSolved) continue;

		backSubstitution(arr);

		let cntNz = 0;
		for (let i = 0; i < k; i++) {
			if (arr[i][k] !== 0) cntNz++;
		}

		if (cntNz < minNz) {
			for (let i = 0; i < 18; i++) {
				solution[i] = 0;
			}
			for (let i = 0; i < k; i++) {
				solution[map[i]] = arr[i][k];
			}
			minNz = cntNz;
		}
	}

	return minNz === k + 1 ? -1 : minNz;
}

/**
 * Generate a WCA-standard clock scramble using random-state solver.
 * Produces optimal or near-optimal scrambles with uniform state distribution.
 */
export function generateClockScramble(): string {
	const rndarr = randomState();
	const solution = new Array(18).fill(0);
	solveIn(14, rndarr, solution);

	let scramble = '';

	// Front side (moves 0-8)
	for (let x = 0; x < 9; x++) {
		let turn = solution[x];
		if (turn === 0) continue;
		const clockwise = turn <= 6;
		if (turn > 6) turn = 12 - turn;
		scramble += TURNS[x] + turn + (clockwise ? '+' : '-') + ' ';
	}

	scramble += 'y2 ';

	// Back side (moves 9-17)
	for (let x = 0; x < 9; x++) {
		let turn = solution[x + 9];
		if (turn === 0) continue;
		const clockwise = turn <= 6;
		if (turn > 6) turn = 12 - turn;
		scramble += TURNS[x] + turn + (clockwise ? '+' : '-') + ' ';
	}

	// Final pin positions
	let isFirst = true;
	for (let x = 0; x < 4; x++) {
		if (rn(2) === 1) {
			scramble += (isFirst ? '' : ' ') + TURNS[x];
			isFirst = false;
		}
	}

	return scramble.trim();
}
