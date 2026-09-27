/**
 * Where a reconstruction starts. One implementation for the live overlay, the
 * post-solve analysis and the server's stored steps, so the three cannot disagree.
 *
 * The phase engine replays the solve's moves from a start state and detects each
 * phase as the cube passes through it. Two ways to get that start state:
 *
 *   - from the scramble (or the tracker's state when the scramble finished): the
 *     real state, and the only one that keeps partial-solve subsets (333cfop>oll
 *     and friends) identifying their cases correctly;
 *   - from the solution itself, cstimer's way (recons.js calcRecons 84-91): apply
 *     the inverse of the solution to a solved cube. Replaying the solution from
 *     there always ends solved, by construction.
 *
 * The first one breaks when the recorded move list is incomplete or out of order:
 * a BLE packet lost mid-solve, a final move that never arrived, a turn the cube
 * reported in the wrong order. The cube still says it is solved (that is what
 * stopped the timer), but the moves we hold cannot get there, so the replay never
 * reaches the last phase and the whole breakdown was dropped. cstimer never hits
 * this because it never uses an outside start state.
 *
 * So: keep the real start whenever the moves actually solve the cube from it, and
 * fall back to cstimer's derived start only when they do not AND the solve is known
 * to have ended solved. A DNF never qualifies: an aborted solve's moves do not end
 * solved, and deriving a start for them would invent a complete solve (cstimer skips
 * DNFs entirely, recons.js:80).
 */

import Cube from 'cubejs';
import { invertNormalizedMove, normalizeMove } from './notation';

interface TurnLike {
	turn: string;
}

/** Every face a single colour, in any orientation: the engine's own "solved". */
export function faceletsSolved(facelets: string): boolean {
	if (!facelets || facelets.length !== 54) return false;
	for (let face = 0; face < 6; face++) {
		const offset = face * 9;
		const colour = facelets[offset];
		for (let i = 1; i < 9; i++) {
			if (facelets[offset + i] !== colour) return false;
		}
	}
	return true;
}

/** Applies each move, skipping what cubejs rejects (the phase engine's rule too). */
function applyMoves(cube: any, moves: string[]): void {
	for (const move of moves) {
		if (!move) continue;
		try {
			cube.move(move);
		} catch {
			// Invalid move: skip, exactly as PhaseAnalyzer.feed does.
		}
	}
}

/** The scramble applied to a solved cube. */
export function startStateFromScramble(scramble?: string | null): string | undefined {
	try {
		const cube = new Cube();
		const moves = (scramble || '').trim().split(/\s+/).filter(Boolean).map(normalizeMove);
		applyMoves(cube, moves);
		return cube.asString();
	} catch {
		return undefined;
	}
}

/**
 * cstimer's start state: the inverse of the solution applied to a solved cube, so
 * that replaying the solution from it ends solved.
 */
export function startStateFromSolvedEnd(turns: TurnLike[]): string | undefined {
	try {
		const cube = new Cube();
		const inverse: string[] = [];
		for (let i = turns.length - 1; i >= 0; i--) {
			const move = normalizeMove(turns[i]?.turn || '');
			if (move) inverse.push(invertNormalizedMove(move));
		}
		applyMoves(cube, inverse);
		return cube.asString();
	} catch {
		return undefined;
	}
}

/** Does replaying these turns from this state end on a solved cube? */
export function replayEndsSolved(startState: string, turns: TurnLike[]): boolean {
	try {
		const cube = Cube.fromString(startState);
		applyMoves(
			cube,
			turns.map((t) => normalizeMove(t?.turn || ''))
		);
		return faceletsSolved(cube.asString());
	} catch {
		return false;
	}
}

export interface ResolvedStartState {
	state: string | undefined;
	/** True when the cstimer-derived start was used instead of the preferred one. */
	derived: boolean;
}

/**
 * @param preferred   The real start: scramble or tracker state. May be missing.
 * @param endedSolved The solve is known to have finished on a solved cube (a
 *                    completed, non-DNF solve). Without it the preferred start is
 *                    always kept.
 */
export function resolveAnalysisStartState({
	turns,
	preferred,
	endedSolved,
}: {
	turns: TurnLike[];
	preferred?: string | null;
	endedSolved: boolean;
}): ResolvedStartState {
	const keep: ResolvedStartState = { state: preferred || undefined, derived: false };
	if (!endedSolved || !turns || turns.length === 0) return keep;
	if (preferred && replayEndsSolved(preferred, turns)) return keep;

	const derived = startStateFromSolvedEnd(turns);
	return derived ? { state: derived, derived: true } : keep;
}
