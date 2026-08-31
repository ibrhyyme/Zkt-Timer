import Cube from 'cubejs';
import { SmartTurn, invertMove } from '../smart_scramble';
import { DEFAULT_SOLVED_STATE, isValidFacelets } from './facelets';

/**
 * The logical mirror of the physical cube.
 *
 * Solve detection compares this tracker against the solved state, so it has to follow
 * the physical cube at all times. The failure mode this class exists to prevent: if the
 * tracker is rebuilt only from the move stream, it never gets set when a scramble
 * completes without a single BLE move (cube already sitting at the target state after a
 * reconnect). The tracker then stays "solved" and any cancelling pair like R R' registers
 * as a finished solve — the 1.68s phantom solve reported on 2026-08-14.
 *
 * Bookkeeping rule: every rebuild marks the turns recorded so far as already accounted
 * for. Zeroing the counter instead would replay the whole backlog onto a freshly built
 * tracker, which is a real case after a Bluetooth drop where pre-drop turns are still
 * held by the caller.
 */
export class CubeTracker {
	private cube = new Cube();
	private appliedTurns = 0;

	/** Number of turns from the caller's stream already applied to this tracker. */
	get applied(): number {
		return this.appliedTurns;
	}

	/** Current logical state as a facelets string. */
	get state(): string {
		return this.cube.asString();
	}

	isSolved(solvedState = DEFAULT_SOLVED_STATE): boolean {
		return this.cube.asString() === solvedState;
	}

	matches(facelets: string | null | undefined): boolean {
		return !!facelets && this.cube.asString() === facelets;
	}

	/**
	 * Mark the caller's stream as fully accounted for without touching the cube state.
	 * Called after every rebuild so the next applyNew() only sees genuinely new turns.
	 */
	acknowledge(streamLength: number): void {
		this.appliedTurns = Math.max(0, streamLength);
	}

	/** Rebuild from a scramble string. Returns false when the scramble is unusable. */
	setFromScramble(scramble: string, streamLength: number): boolean {
		const moves = (scramble || '').split(' ').filter((m) => m.trim());
		if (!moves.length) return false;
		try {
			const fresh = new Cube();
			for (const move of moves) fresh.move(move);
			this.cube = fresh;
			this.acknowledge(streamLength);
			return true;
		} catch (e) {
			console.warn('[smart-cube] tracker rebuild from scramble failed:', e);
			return false;
		}
	}

	setSolved(streamLength: number): void {
		this.cube = new Cube();
		this.acknowledge(streamLength);
	}

	/**
	 * Re-anchor to the cube's own report of its state. This is the path that recovers
	 * from a dropped move packet, so it refuses malformed payloads rather than adopting
	 * a state that would poison every later comparison.
	 */
	setFromFacelets(facelets: string, streamLength: number): boolean {
		if (!isValidFacelets(facelets)) {
			console.warn('[smart-cube] ignoring malformed FACELETS during tracker sync');
			return false;
		}
		try {
			this.cube = Cube.fromString(facelets);
		} catch (e) {
			console.warn('[smart-cube] FACELETS parse failed during tracker sync:', e);
			return false;
		}
		this.acknowledge(streamLength);
		return true;
	}

	/**
	 * Apply the turns the tracker has not seen yet and return them, so the caller can
	 * feed the same batch to a 3D view without recomputing the slice.
	 */
	applyNew(turns: SmartTurn[]): SmartTurn[] {
		if (turns.length <= this.appliedTurns) return [];
		const fresh = turns.slice(this.appliedTurns);
		for (const turn of fresh) {
			try {
				this.cube.move(turn.turn);
			} catch (e) {
				// A move the tracker cannot represent (rotation notation from an odd
				// firmware) must not abort the batch: the facelets cross-check is what
				// recovers the state, and throwing here would leave appliedTurns stale.
				console.warn('[smart-cube] tracker could not apply move', turn.turn, e);
			}
		}
		this.appliedTurns = turns.length;
		return fresh;
	}

	/**
	 * The caller's stream was cleared (new scramble, manual reset). Drops the applied
	 * counter so the next batch is treated as a fresh stream.
	 */
	streamCleared(): void {
		this.appliedTurns = 0;
	}
}

const OPPOSITE_FACES: Record<string, string> = {
	U: 'D', D: 'U',
	L: 'R', R: 'L',
	F: 'B', B: 'F',
};

function faceOf(move: string): string {
	return move.replace(/('|2)/g, '');
}

/** Opposite-face moves (U/D, L/R, F/B) turn independent layers and never affect each
 *  other — doing the scramble's next move before this one changes nothing physically. */
function areOppositeFaces(a: string, b: string): boolean {
	return OPPOSITE_FACES[faceOf(a)] === faceOf(b);
}

/** A point the cube passes through on its way from untouched to fully scrambled. */
export interface ScramblePrefix {
	/** Facelet state the cube reports here. */
	state: string;
	/** How many whole scramble moves are finished at this point. */
	done: number;
	/**
	 * True when the next move is only half turned: the first quarter of a double move is on
	 * the cube but the second is not.
	 */
	partial: boolean;
}

/**
 * Every facelet state the cube passes through while the scramble is performed.
 *
 * This is what lets a dropped BLE packet stop costing the user their progress: when the
 * cube reports a state we did not expect, its own report is matched against this table
 * and the answer is "the user is k moves in", not "start over".
 *
 * Quarter turns are listed as their own entries, not just whole moves. Roughly two in five
 * scramble moves are doubles and the cube reports each half separately, so a packet lost
 * between the two halves leaves the cube on a state no whole-move table describes. Before
 * these entries existed the lookup failed there and the progress was wiped anyway, which is
 * the half of this bug that survived the first fix.
 *
 * Built by walking backwards from the target rather than forwards from solved, because
 * on the correction path the displayed scramble is a short fix-up sequence and the cube
 * does not start from a solved state. Inverting the sequence off the target finds the
 * real starting point in both cases.
 */
export function prefixStatesFrom(targetFacelets: string, moves: string[]): ScramblePrefix[] {
	if (!moves.length || !isValidFacelets(targetFacelets)) return [];
	try {
		const cube = Cube.fromString(targetFacelets);
		for (let i = moves.length - 1; i >= 0; i--) {
			cube.move(invertMove(moves[i]));
		}
		const states: ScramblePrefix[] = [{ state: cube.asString(), done: 0, partial: false }];
		moves.forEach((move, index) => {
			// Opposite-face reordering: if the scramble's next move commutes with this one,
			// a user free to pick either physical move first may do that next one early —
			// R then L is the identical cube to L then R. Record that "one done early out of
			// order" state too, so the lookup still finds them. Once the move at `index`
			// itself lands, the state matches the normal in-order entry below regardless of
			// which of the pair came first, so nothing else is needed to pick the walk back up.
			const next = moves[index + 1];
			if (next && areOppositeFaces(move, next)) {
				const early = Cube.fromString(cube.asString());
				early.move(next);
				states.push({ state: early.asString(), done: index, partial: false });
			}

			if (move.endsWith('2')) {
				const face = move.slice(0, -1);
				// A half-turned double is on the cube regardless of which direction the user
				// started it from: a 180° turn is its own inverse, so face (clockwise) and
				// face' (counter-clockwise) both leave the cube one quarter into the exact
				// same double move, and the second quarter finishes it identically either
				// way. Record both as valid "half done" states — the lookup only knowing the
				// clockwise one meant a user who instinctively started a double turn
				// counter-clockwise got told they had made a mistake for a move that was
				// entirely correct.
				const cw = Cube.fromString(cube.asString());
				cw.move(face);
				states.push({ state: cw.asString(), done: index, partial: true });

				const ccw = Cube.fromString(cube.asString());
				ccw.move(invertMove(face));
				states.push({ state: ccw.asString(), done: index, partial: true });

				cube.move(move);
				states.push({ state: cube.asString(), done: index + 1, partial: false });
			} else {
				cube.move(move);
				states.push({ state: cube.asString(), done: index + 1, partial: false });
			}
		});
		return states;
	} catch (e) {
		console.warn('[smart-cube] prefix state table build failed:', e);
		return [];
	}
}
