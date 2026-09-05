// The move-order recovery is a heuristic that ends a solve, so a false positive costs the
// user a real attempt. These tests pin both halves of cstimer's decision: the swap search
// itself, and the guards that stop it firing on a cube that is genuinely unsolved.
//
// No cube is needed for any of this — the sequences are built by construction, which is
// what makes this the one part of the smart-cube stack that can be verified exhaustively.

import {
	checkMoves,
	moveToIndex,
	movesToIndices,
	shouldRecoverFromMoveOrder,
	NO_SWAP_FOUND,
} from '../move_order_fix';
import { CubieCube } from '../../../../shared/scramble/lib/mathlib';

/** Applies move indices to a solved cube and returns the resulting facelet string. */
function faceletsAfter(indices: number[]): string {
	let cur = new CubieCube();
	const tmp = new CubieCube();
	for (const m of indices) {
		CubieCube.CubeMult(cur, CubieCube.moveCube[m], tmp);
		cur = new CubieCube().init(tmp.ca, tmp.ea);
	}
	return cur.toFaceCube();
}

/** A sequence and its own inverse: by construction it leaves the cube solved. */
function withInverse(moves: string[]): string[] {
	const inverse = moves
		.slice()
		.reverse()
		.map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'"));
	return [...moves, ...inverse];
}

/** Swaps the pair at `i`, which is exactly what a cube does when it misreads two turns. */
function swapAt(moves: string[], i: number): string[] {
	const out = moves.slice();
	[out[i], out[i + 1]] = [out[i + 1], out[i]];
	return out;
}

function indices(moves: string[]): number[] {
	const parsed = movesToIndices(moves);
	if (!parsed) throw new Error('unparseable move list: ' + moves.join(' '));
	return parsed;
}

describe('move index conversion', () => {
	it('maps faces and powers the way cstimer tables expect', () => {
		// face * 3 + power, faces URFDLB, powers " 2'".
		expect(moveToIndex('U')).toBe(0);
		expect(moveToIndex('U2')).toBe(1);
		expect(moveToIndex("U'")).toBe(2);
		expect(moveToIndex('R')).toBe(3);
		expect(moveToIndex('F')).toBe(6);
		expect(moveToIndex('D')).toBe(9);
		expect(moveToIndex('L')).toBe(12);
		expect(moveToIndex("B'")).toBe(17);
	});

	it('rejects anything that is not a plain face turn', () => {
		// Wide moves and rotations have no entry in the move table; analysing a sequence
		// containing one would silently produce a wrong answer.
		expect(moveToIndex('Rw')).toBe(-1);
		expect(moveToIndex('x')).toBe(-1);
		expect(moveToIndex('')).toBe(-1);
		expect(movesToIndices(['R', 'x'])).toBe(null);
	});
});

describe('checkMoves — swap search', () => {
	it('finds a single swapped pair', () => {
		// R U F F' U' R' solves the cube. Swapping the U and F the cube reported turns it
		// into a sequence that does not — but one swap away from one that does.
		const clean = withInverse(['R', 'U', 'F']);
		expect(checkMoves(indices(swapAt(clean, 1)))).toBe(1);
	});

	it('finds two swapped pairs', () => {
		const clean = withInverse(['R', 'U', 'F', 'L']);
		const twice = swapAt(swapAt(clean, 0), 4);
		expect(checkMoves(indices(twice))).toBe(2);
	});

	it('reports nothing for a sequence that no swap can fix', () => {
		// An ordinary scramble: the user is mid-solve, not the victim of a misread.
		expect(checkMoves(indices(['R', 'U', 'F', 'L', 'D', 'B']))).toBe(NO_SWAP_FOUND);
	});

	it('still finds a swap in an already-solving sequence, which is why the guards exist', () => {
		// Swapping a move with its own inverse (the F F' in the middle here) leaves the
		// sequence solving the cube, so the search legitimately reports a swap even though
		// nothing was misread. cstimer behaves identically. On its own this would end solves
		// that were never in trouble — the progress and solution-length guards in
		// shouldRecoverFromMoveOrder are what make the search safe to act on.
		expect(checkMoves(indices(withInverse(['R', 'U', 'F'])))).not.toBe(NO_SWAP_FOUND);
	});

	it('applies cstimer parity pre-filter to odd-length sequences', () => {
		expect(checkMoves(indices(['R']))).toBe(NO_SWAP_FOUND);
		expect(checkMoves(indices(['R', 'U', 'F']))).toBe(NO_SWAP_FOUND);
	});

	it('skips same-axis pairs, where a swap changes nothing', () => {
		// R and R' are on one axis: swapping them is a no-op, so the walk advances past the
		// pair instead of recursing on it. With nothing else to try, the search comes back
		// empty rather than claiming a swap that would explain nothing.
		expect(checkMoves(indices(['R', "R'"]))).toBe(NO_SWAP_FOUND);
		expect(checkMoves(indices(['U', 'D', "D'", "U'"]))).toBe(NO_SWAP_FOUND);
	});

	it('stays within its search budget on a long sequence', () => {
		// cstimer caps the walk at 9999 nodes. The contract is that it returns rather than
		// running away; a phone must not lock up mid-solve.
		const long: string[] = [];
		for (let i = 0; i < 40; i++) long.push(['R', 'U', 'F', 'L', 'D', 'B'][i % 6]);
		const start = Date.now();
		expect(checkMoves(indices(long))).toBe(NO_SWAP_FOUND);
		expect(Date.now() - start).toBeLessThan(5000);
	});

	it('handles an empty sequence', () => {
		expect(checkMoves([])).toBe(NO_SWAP_FOUND);
	});
});

describe('shouldRecoverFromMoveOrder — full cstimer decision', () => {
	it('recovers a solve the cube reported out of order', () => {
		// The swap has to leave the cube visibly far from solved for the guards to allow a
		// recovery: this one needs 20 moves to fix, well past the 10-move floor.
		const clean = withInverse(['R', 'U', 'F', 'L', 'D', 'B', 'R', 'U']);
		const swapped = swapAt(clean, 4);
		const seen = faceletsAfter(indices(swapped));
		expect(shouldRecoverFromMoveOrder(swapped, seen)).toBe(true);
	});

	it('refuses when the misread leaves the cube close to solved', () => {
		// Same construction, a different swap point: this one is only 8 moves from solved,
		// so cstimer's solution-length floor rejects it. Acting on a cube this close would
		// end solves on coincidence rather than evidence.
		const clean = withInverse(['R', 'U', 'F', 'L', 'D', 'B', 'R', 'U']);
		const swapped = swapAt(clean, 3);
		const seen = faceletsAfter(indices(swapped));
		expect(checkMoves(indices(swapped))).toBe(1); // the search does find it
		expect(shouldRecoverFromMoveOrder(swapped, seen)).toBe(false); // the guards refuse it
	});

	it('leaves an ordinary unsolved cube alone', () => {
		const scramble = ['R', 'U', 'F', 'L', 'D', 'B'];
		const seen = faceletsAfter(indices(scramble));
		expect(shouldRecoverFromMoveOrder(scramble, seen)).toBe(false);
	});

	it('refuses when the cube is already past F2L', () => {
		// cstimer's guard: a nearly-solved cube is close enough that a swap "explaining" it
		// is more likely coincidence than a real misread.
		const clean = withInverse(['R', 'U']);
		const swapped = swapAt(clean, 1);
		// U R R' U' with the pair swapped leaves a cube that is still trivially close to
		// solved, so the progress guard rejects it whatever the search found.
		expect(shouldRecoverFromMoveOrder(swapped, faceletsAfter(indices(swapped)))).toBe(false);
	});

	it('refuses an empty move list', () => {
		expect(shouldRecoverFromMoveOrder([], faceletsAfter([]))).toBe(false);
	});

	it('refuses a sequence containing a move it cannot parse', () => {
		expect(shouldRecoverFromMoveOrder(['R', 'x', "R'"], faceletsAfter([3]))).toBe(false);
	});
});
