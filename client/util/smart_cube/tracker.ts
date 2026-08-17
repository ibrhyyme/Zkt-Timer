import Cube from 'cubejs';
import { SmartTurn } from '../smart_scramble';
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
