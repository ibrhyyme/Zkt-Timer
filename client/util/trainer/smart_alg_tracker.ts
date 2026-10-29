/**
 * Follows an algorithm move by move on a smart cube (Smart Cube trainer).
 *
 * The cube reports physical face turns. Each one is applied to the tracked cube state and the
 * result is compared, centers ignored and orientation fixed, against the state the algorithm
 * reaches after each of its moves (`patterns`). That comparison is what lets wide moves, slices
 * and cube rotations work: the cube never reports `r`, `M` or `y`, but the pieces end up in the
 * same place as the algorithm says.
 *
 * Generic over the state type so the rules run in node tests (cubejs) and in the app (cubing.js
 * KPattern, see TrainerSmartCube).
 *
 * Verdicts for a move that does not land on an algorithm state:
 *  - partial: a turn still in progress, e.g. the first quarter of a U2 done as U U, or one face
 *    of an M (the cube reports R and L' separately). Shown as "half", not counted as a mistake.
 *  - wrong:   a real mistake. Counted, flashed, and its undo is shown as the correction.
 *  - undo:    takes back a turn that was still in progress. Not counted.
 *
 * The attempt starts on the FIRST physical move, whatever it is. Earlier, a first move that did
 * not match was taken for a "setup" move and silently ignored; since the expected states stay
 * anchored at the starting position, every later move then also failed to match and the attempt
 * never started (2.8-c).
 */
import {getInverseMove} from './algorithm_engine';

export interface CubeStateOps<S> {
	/** Applies one move: a physical face turn from the cube, or an algorithm move. */
	apply(state: S, move: string): S;
	/** Rotates the whole cube so the centers are in their home position. */
	normalize(state: S): S;
	/** Same pieces in the same places, centers ignored. Both sides are normalized. */
	same(a: S, b: S): boolean;
}

export type SmartMoveVerdict = 'match' | 'partial' | 'wrong' | 'undo' | 'masked';

export interface SmartMoveResult {
	verdict: SmartMoveVerdict;
	/** First physical move of the attempt: the timer starts here. */
	started: boolean;
	/** The algorithm's end state was reached. */
	completed: boolean;
	/** Algorithm moves confirmed so far. */
	matchedCount: number;
	/** Physical moves since the last confirmed algorithm move. */
	bad: string[];
	/** The pending moves are a turn in progress, not an error. */
	partial: boolean;
	/** Count as a mistake (fail counter, auto learn) and flash. */
	mistake: boolean;
}

const MAX_LAST_MOVES = 256;

function stripParens(move: string): string {
	return move.replace(/[()]/g, '');
}

/**
 * Quarter turns the cube reports for one algorithm move: a face or wide quarter turn is one
 * report, a slice quarter turn two (its two outer faces), a rotation none. Doubles count twice.
 */
export function quarterTurnCost(move: string): number {
	const m = stripParens(move).trim();
	if (!m) return 0;
	const base = m[0];
	const double = m.includes('2');
	if ('xyz'.includes(base)) return 0;
	if ('MES'.includes(base)) return double ? 4 : 2;
	return double ? 2 : 1;
}

const OPPOSITE: Record<string, string> = {U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F'};

export class SmartAlgTracker<S> {
	private algMoves: string[] = [];
	private patterns: S[] = [];
	private current: S | null = null;
	private startFixed: S | null = null;
	private idx = -1;
	private bad: string[] = [];
	private lastMoves: string[] = [];
	private started = false;
	private done = false;
	private pendingPartial = false;

	constructor(private readonly ops: CubeStateOps<S>) {}

	/** Tracked cube state (null until a baseline is known). */
	getCurrent(): S | null {
		return this.current;
	}

	/** Baseline from the cube's own state report or a reset. Does not move the expectations. */
	setCurrent(state: S): void {
		this.current = state;
	}

	hasAlgorithm(): boolean {
		return this.algMoves.length > 0;
	}

	isReady(): boolean {
		return this.current !== null && this.patterns.length > 0;
	}

	/** Expected state after each algorithm move (orientation fixed). */
	getPatterns(): readonly S[] {
		return this.patterns;
	}

	/** New algorithm: expectations anchored at the current state, progress cleared. */
	load(algMoves: string[], fallbackInitial: S): void {
		this.algMoves = algMoves.map(stripParens).filter((m) => m.length > 0);
		if (this.current === null) this.current = fallbackInitial;
		this.rebuild();
		this.resetProgress();
	}

	/** Re-anchors the expectations at the current state (cube set up by hand before starting). */
	rebuild(): void {
		if (this.current === null) return;
		const initial = this.current;
		const patterns: S[] = [];
		let applied = initial;
		for (const move of this.algMoves) {
			applied = this.ops.apply(applied, move);
			patterns.push(this.ops.normalize(applied));
		}
		this.patterns = patterns;
		this.startFixed = this.ops.normalize(initial);
	}

	/** Back to "waiting for the first move" without moving the expectations. */
	resetProgress(): void {
		this.idx = -1;
		this.bad = [];
		this.lastMoves = [];
		this.started = false;
		this.done = false;
		this.pendingPartial = false;
	}

	/**
	 * One physical move from the cube. Returns null when nothing is loaded yet (the move is then
	 * not applied either, as before) or after the algorithm was completed (the move is applied,
	 * so the next algorithm starts from the right state, but not judged against the old one).
	 */
	push(move: string, masked = false): SmartMoveResult | null {
		if (!this.isReady()) return null;
		this.current = this.ops.apply(this.current as S, move);
		if (this.done) return null;

		this.lastMoves.push(move);
		if (this.lastMoves.length > MAX_LAST_MOVES) {
			this.lastMoves = this.lastMoves.slice(-MAX_LAST_MOVES);
		}

		const started = !this.started;
		this.started = true;
		const last = this.patterns.length - 1;

		// Moves hidden: no per-move judging, only "did the cube reach the end state".
		if (masked) {
			const completed = this.ops.same(this.ops.normalize(this.current as S), this.patterns[last]);
			if (completed) this.done = true;
			return {
				verdict: 'masked',
				started,
				completed,
				matchedCount: Math.max(0, this.idx + 1),
				bad: [],
				partial: false,
				mistake: false,
			};
		}

		const fixed = this.ops.normalize(this.current as S);
		const matchIdx = this.findMatch(fixed);
		if (matchIdx >= 0) {
			this.idx = matchIdx;
			this.bad = [];
			this.pendingPartial = false;
			const completed = matchIdx === last;
			if (completed) this.done = true;
			return {verdict: 'match', started, completed, matchedCount: matchIdx + 1, bad: [], partial: false, mistake: false};
		}

		// Back at the starting position (a wrong first move undone, or the first correct move
		// taken back): the same as landing on an algorithm state mid way, nothing is pending.
		// The wrong move itself was already counted when it was made.
		if (this.startFixed !== null && this.ops.same(fixed, this.startFixed)) {
			this.idx = -1;
			this.bad = [];
			this.pendingPartial = false;
			return {verdict: 'undo', started, completed: false, matchedCount: 0, bad: [], partial: false, mistake: false};
		}

		const partialBefore = this.bad.length > 0 && this.pendingPartial;
		this.bad.push(move);
		const partialNow = this.isPartialProgress();
		const recovery = this.recoverBadAlg();

		// The undo of a turn that was still in progress takes nothing back that was wrong.
		const undoOfPartial = recovery === 'undo-bad' && partialBefore;
		const mistake = !partialNow && !undoOfPartial;
		this.pendingPartial = this.bad.length > 0 && this.isPartialProgress();

		return {
			verdict: partialNow ? 'partial' : undoOfPartial ? 'undo' : 'wrong',
			started,
			completed: false,
			matchedCount: Math.max(0, this.idx + 1),
			bad: [...this.bad],
			partial: this.pendingPartial,
			mistake,
		};
	}

	/**
	 * The cube's own state report during an attempt (a safety net for a lost move event).
	 * Completes only on the algorithm's END state, never on "solved": the attempt is anchored
	 * wherever the cube was, so after the previous case the start is usually the solved cube,
	 * and a first move taken back (F, F') would land on solved and count as done.
	 */
	reportState(state: S): boolean {
		if (!this.started || this.done || this.patterns.length === 0) return false;
		if (!this.ops.same(this.ops.normalize(state), this.patterns[this.patterns.length - 1])) return false;
		this.done = true;
		return true;
	}

	// First algorithm state equal to `fixed`, then past any states equal to it (trailing rotations).
	private findMatch(fixed: S): number {
		const patterns = this.patterns;
		for (let i = 0; i < patterns.length; i++) {
			if (this.ops.same(fixed, patterns[i])) {
				let matchIdx = i;
				while (matchIdx + 1 < patterns.length && this.ops.same(patterns[i], patterns[matchIdx + 1])) {
					matchIdx++;
				}
				return matchIdx;
			}
		}
		return -1;
	}

	// BadAlg recovery (CubeDex port), unchanged from the component it came from.
	private recoverBadAlg(): 'undo-first' | 'undo-bad' | 'full-turn' | null {
		const bad = this.bad;
		const lastMoves = this.lastMoves;
		const lastMove = lastMoves[lastMoves.length - 1];

		// Case 1: the first correct move was undone.
		if (this.idx === 0 && bad.length === 1 && lastMove === getInverseMove(this.algMoves[0] || '')) {
			this.idx = -1;
			bad.pop();
			return 'undo-first';
		}
		// Case 2: the previous wrong move was undone.
		if (bad.length >= 2 && lastMove === getInverseMove(bad[bad.length - 2])) {
			bad.pop();
			bad.pop();
			return 'undo-bad';
		}
		// Case 3: the same face turned four times (a full turn, nothing changed).
		if (
			bad.length > 3 &&
			lastMoves.length > 3 &&
			lastMoves[lastMoves.length - 1] === lastMoves[lastMoves.length - 2] &&
			lastMoves[lastMoves.length - 2] === lastMoves[lastMoves.length - 3] &&
			lastMoves[lastMoves.length - 3] === lastMoves[lastMoves.length - 4]
		) {
			bad.splice(-4, 4);
			return 'full-turn';
		}
		return null;
	}

	/**
	 * True when the moves since the last confirmed state are the start of the next algorithm
	 * move: they stay on one axis and the remaining quarter turns of that move, on the same
	 * axis, reach its state. Checked against cube states, so it holds after rotations and wide
	 * moves too, where the reported face letter differs from the written one.
	 */
	private isPartialProgress(): boolean {
		if (this.bad.length === 0 || this.current === null) return false;
		const anchor = this.idx >= 0 ? this.patterns[this.idx] : this.startFixed;
		if (anchor === null) return false;

		// Next algorithm move that changes the pieces (skips rotations).
		let j = this.idx + 1;
		while (j < this.patterns.length && this.ops.same(this.patterns[j], anchor)) j++;
		if (j >= this.patterns.length) return false;

		const spent = this.bad.reduce((sum, m) => sum + quarterTurnCost(m), 0);
		const remaining = quarterTurnCost(this.algMoves[j]) - spent;
		if (remaining < 1) return false;

		const faces = new Set<string>();
		for (const m of this.bad) {
			const face = stripParens(m)[0]?.toUpperCase();
			if (!face || !OPPOSITE[face]) return false;
			faces.add(face);
			faces.add(OPPOSITE[face]);
		}
		// One axis = two opposite faces. A turn in progress never spans two axes.
		if (faces.size !== 2) return false;

		const moves: string[] = [];
		faces.forEach((f) => moves.push(f, `${f}'`));
		return this.reachable(this.current, this.patterns[j], remaining, moves);
	}

	private reachable(state: S, target: S, depth: number, moves: string[]): boolean {
		for (const move of moves) {
			const next = this.ops.apply(state, move);
			if (this.ops.same(this.ops.normalize(next), target)) return true;
			if (depth > 1 && this.reachable(next, target, depth - 1, moves)) return true;
		}
		return false;
	}
}
