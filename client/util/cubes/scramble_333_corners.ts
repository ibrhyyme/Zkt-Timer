/**
 * 3x3 Corners Only scramble generator.
 * Edge'leri solved tutup corner'lari randomize eder, cubejs (Kociemba) ile cozer.
 * cstimer'daki getCornerScramble() ile ayni mantik.
 */
import Cube from 'cubejs';
import 'cubejs/lib/solve';

let solverInited = false;

function ensureSolver(): void {
	if (solverInited) return;
	Cube.initSolver();
	solverInited = true;
}

function getPermParity(arr: number[]): number {
	let parity = 0;
	for (let i = 0; i < arr.length; i++) {
		for (let j = i + 1; j < arr.length; j++) {
			if (arr[i] > arr[j]) parity++;
		}
	}
	return parity % 2;
}

export function generateCornersScramble(): string {
	ensureSolver();

	// Random corner permutation (even parity — edges solved = even parity)
	const cp = [0, 1, 2, 3, 4, 5, 6, 7];
	for (let i = 7; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[cp[i], cp[j]] = [cp[j], cp[i]];
	}
	if (getPermParity(cp) !== 0) {
		[cp[6], cp[7]] = [cp[7], cp[6]];
	}

	// Random corner orientation (sum % 3 === 0)
	const co: number[] = [];
	let sum = 0;
	for (let i = 0; i < 7; i++) {
		co[i] = Math.floor(Math.random() * 3);
		sum += co[i];
	}
	co[7] = (3 - (sum % 3)) % 3;

	// Solved state check — retry if identity
	const isSolved = cp.every((v, i) => v === i) && co.every((v) => v === 0);
	if (isSolved) {
		return generateCornersScramble();
	}

	const cube = new Cube({
		cp,
		co,
		ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
		eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
		center: [0, 1, 2, 3, 4, 5],
	});

	const solution = cube.solve();
	return solution.replace(/\s+/g, ' ').trim();
}
