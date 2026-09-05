import { CubieCube } from '../../../shared/scramble/lib/mathlib';
import { getCFOPProgress } from '../../../shared/util/solve/cube_progress';
import { solve as min2phaseSolve } from '../../../shared/scramble/lib/min2phase';

/**
 * Recovery for moves the cube reported in the wrong order.
 *
 * A smart cube decides for itself which layer moved first when two are turned at once, and
 * at speed it sometimes decides wrongly: the moves are all there, two of them are simply
 * swapped. Nothing in the transport can see this. Serial numbers, the move buffer and the
 * gap-recovery request all deal with packets that went missing, and no packet went missing
 * here — the cube sent exactly what it believes happened. The user is left holding a solved
 * cube while the timer keeps running.
 *
 * This is a 1:1 port of cstimer's `checkMoves` / `checkSwap` (tools/bluetoothutil.js), which
 * searches for one or two adjacent swaps that would make the recorded sequence come out
 * solved. cstimer keeps it behind an off-by-default setting because a wrong guess ends a
 * solve early; the same caution applies here, see `smart_cube_move_order_fix`.
 */

/** Returned when no swap explains the sequence. cstimer uses the same sentinel. */
export const NO_SWAP_FOUND = 99;

/**
 * Search budget, straight from cstimer. Without it a long scramble can walk an enormous
 * tree on a phone while the user waits.
 */
const MAX_NODES_SEARCHED = 9999;

/**
 * Turn a move string into the index cstimer's tables use: face * 3 + power, with faces in
 * URFDLB order and power in " 2'" order. Returns -1 for anything unrecognised (wide moves,
 * rotations, junk), which the caller treats as "cannot analyse this sequence".
 */
export function moveToIndex(move: string): number {
	if (!move) return -1;
	const face = 'URFDLB'.indexOf(move[0]);
	if (face < 0) return -1;
	const suffix = move.length > 1 ? move[1] : ' ';
	const power = " 2'".indexOf(suffix);
	if (power < 0) return -1;
	return face * 3 + power;
}

/** Converts a turn list to move indices, or null when any of them is not a plain face turn. */
export function movesToIndices(moves: string[]): number[] | null {
	const indices: number[] = [];
	for (const move of moves) {
		const index = moveToIndex(move);
		if (index < 0) return null;
		indices.push(index);
	}
	return indices;
}

/**
 * cstimer `checkSwap` — 1:1 port.
 *
 * Walks the sequence trying to swap each adjacent pair, and recurses on the remainder with
 * one swap fewer. `stateFromStart` is mutated as the walk advances (cstimer relies on this),
 * so callers hand it a cube they do not need afterwards.
 */
function checkSwap(
	moves: number[],
	start: number,
	nswap: number,
	stateFromStart: CubieCube,
	stateToEnd: CubieCube[],
	budget: { searched: number }
): boolean {
	if (nswap == 0) {
		return stateFromStart.isEqual(new CubieCube().invFrom(stateToEnd[start]));
	}
	const cctmp = new CubieCube();
	// Declared outside the loop deliberately: cstimer relies on `var` hoisting here, so an
	// iteration that skips the recursion reads whatever the previous one left behind. That
	// value is only ever `undefined` or `false` (a `true` returns immediately), so the
	// behaviour is identical — but scoping it per-iteration would be a different program.
	let ret: boolean | undefined;
	for (let i = start; i < moves.length - 1; i++) {
		if (~~(moves[i] / 3) % 3 == ~~(moves[i + 1] / 3) % 3) {
			// Same axis: the two moves commute, so swapping them changes nothing. Advance.
			CubieCube.CubeMult(stateFromStart, CubieCube.moveCube[moves[i]], cctmp);
			stateFromStart.init(cctmp.ca, cctmp.ea);
			continue;
		}
		const state = new CubieCube().init(stateFromStart.ca, stateFromStart.ea);
		CubieCube.CubeMult(state, CubieCube.moveCube[moves[i + 1]], cctmp);
		CubieCube.CubeMult(cctmp, CubieCube.moveCube[moves[i]], state);
		CubieCube.CubeMult(state, stateToEnd[i + 2], cctmp);
		if (++budget.searched > MAX_NODES_SEARCHED) {
			return false;
		}
		if (cctmp.edgeCycles() < nswap) {
			ret = checkSwap(moves, i + 2, nswap - 1, state, stateToEnd, budget);
		}
		if (ret) {
			return true;
		}
		CubieCube.CubeMult(stateFromStart, CubieCube.moveCube[moves[i]], cctmp);
		stateFromStart.init(cctmp.ca, cctmp.ea);
	}
	return false;
}

/**
 * cstimer `checkMoves` — 1:1 port.
 *
 * Returns the number of adjacent swaps (1 or 2) that would make this sequence solve the
 * cube, or NO_SWAP_FOUND when none does or the search budget runs out.
 */
export function checkMoves(moves: number[]): number {
	// cstimer's parity pre-filter: an odd-length sequence is not a candidate.
	if (moves.length % 2 == 1) {
		return NO_SWAP_FOUND;
	}
	const stateToEnd: CubieCube[] = [];
	stateToEnd[moves.length] = new CubieCube();
	for (let i = moves.length - 1; i >= 0; i--) {
		stateToEnd[i] = new CubieCube();
		CubieCube.CubeMult(CubieCube.moveCube[moves[i]], stateToEnd[i + 1], stateToEnd[i]);
	}
	for (let nswap = 1; nswap < 3; nswap++) {
		const budget = { searched: 0 };
		if (checkSwap(moves, 0, nswap, new CubieCube(), stateToEnd, budget)) {
			return nswap;
		}
		if (budget.searched > MAX_NODES_SEARCHED) {
			return NO_SWAP_FOUND;
		}
	}
	return NO_SWAP_FOUND;
}

/**
 * The full cstimer `giikerErrorDetect` decision, minus the timer that drives it.
 *
 * `moves` is every turn since the cube was last known solved, `facelets` is where the app
 * believes the cube now is. True means: the recorded order is wrong, the cube in the user's
 * hands is actually solved, and the solve should be committed.
 *
 * The two guards after the search are cstimer's and they are what keep this from firing on
 * an ordinary unsolved cube:
 *   - a cube already past F2L is close enough to solved that a swap "explaining" it is more
 *     likely a coincidence than a real transport error;
 *   - a state that a short solution reaches is likewise too close to call.
 */
export function shouldRecoverFromMoveOrder(moves: string[], facelets: string): boolean {
	const indices = movesToIndices(moves);
	if (!indices || indices.length === 0) {
		return false;
	}
	if (checkMoves(indices) === NO_SWAP_FOUND) {
		return false;
	}
	// cstimer: "all unsolved pieces is on same face" — progress <= 2 means F2L or better.
	if (getCFOPProgress(facelets).progress <= 2) {
		return false;
	}
	let solution: string;
	try {
		solution = min2phaseSolve(facelets);
	} catch (e) {
		return false;
	}
	// cstimer measures the generator in characters, three per move ("R2 ").
	if (!solution || solution.length / 3 < 10) {
		return false;
	}
	return true;
}
