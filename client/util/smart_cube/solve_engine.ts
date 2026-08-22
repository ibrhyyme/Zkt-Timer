import {
	SmartTurn,
	IncrementalCompressor,
	matchScrambleWithCommutative,
	invertMove,
} from '../smart_scramble';
import { cubeTimestampLinearFit, TimestampedMove, CorrectedMove } from '../smart_cube_timing';
import { countHTM } from '../../../shared/util/solve/move_counter';
import { DEFAULT_SOLVED_STATE, isValidFacelets } from './facelets';
import { CubeTracker } from './tracker';

/**
 * Framework-agnostic smart cube solve engine.
 *
 * Every surface that times a solve with a smart cube (timer page, friendly rooms) drives
 * this one object instead of keeping its own copy of the rules. Before it existed the
 * rooms page carried a hand-copied snapshot of the timer's logic that had drifted years
 * behind: no facelets cross-check, no safety nets, its own incompatible correction
 * display. Both bugs users hit in rooms (a correction hint that repeats forever, a timer
 * that never stops) came from that drift.
 *
 * The engine only decides. It never touches Redux, sockets or the DOM: it takes the
 * signals a cube produces (turns, facelets, connection state) and emits events the
 * caller acts on. That is what lets the timer commit a solve to its own pipeline while a
 * room broadcasts the same decision over Socket.IO.
 */

export type ScrambleCompleteSource = 'facelets' | 'matcher';
export type SolveCompleteSource = 'tracker' | 'facelets-grace' | 'facelets-poll';
export type MatchStatus = 'perfect' | 'half' | 'wrong' | 'pending';

export type SmartEngineEvent =
	/** Physical cube reached the scramble target. Caller plays its sound, starts inspection. */
	| { type: 'SCRAMBLE_COMPLETE'; at: number; source: ScrambleCompleteSource }
	/** Correction hint for the scramble display. `null` clears it, `['TOO_MANY']` means "just solve it". */
	| { type: 'UNDO_MOVES'; moves: string[] | null }
	/**
	 * Per-move state of the scramble, for colouring the display. Emitted so the UI reads
	 * the same match the engine acted on: when the display ran its own matcher it could
	 * disagree with the engine (a "half done" first move on an already solved cube).
	 */
	| { type: 'SCRAMBLE_PROGRESS'; matchStatus: MatchStatus[] }
	/** First genuine solve move landed. `startedAt` is the move's own timestamp, not wall clock. */
	| { type: 'TIMER_START'; startedAt: number; inspectionMs: number }
	/** Cube is solved. Times are already corrected for BLE lag. */
	| { type: 'SOLVE_COMPLETE'; result: SolveResult }
	/**
	 * A turn arrived that belongs to the scramble, not the solve. The caller should drop
	 * its recorded turns so the tracker can be rebuilt from the scramble.
	 */
	| { type: 'LATE_SCRAMBLE_MOVE'; turn: SmartTurn }
	/** Tracker and physical cube disagree and cannot be reconciled from the move stream. */
	| { type: 'OUT_OF_SYNC'; out: boolean }
	/**
	 * The tracker was re-anchored to the cube's reported state, so anything mirroring it
	 * (a 3D view driven by moves) is now showing a state that never happened.
	 */
	| { type: 'TRACKER_RESYNCED'; facelets: string };

export interface SolveResult {
	/** Solve duration in ms, corrected by per-solve linear regression over cube timestamps. */
	timeMs: number;
	/** When the solve ended. The final move's timestamp, or the facelets stamp on recovery paths. */
	endedAt: number;
	/** Turns that made up the solution (scramble turns excluded). */
	solutionTurns: SmartTurn[];
	/**
	 * Solution turns with timestamps corrected by the linear fit. Callers that persist the
	 * move list or run phase analysis use these rather than recomputing the fit — the timer
	 * page used to run its own second copy and could disagree with this result.
	 */
	correctedMoves: CorrectedMove[];
	/** Raw number of BLE move events in the solution. */
	turnCount: number;
	/**
	 * cstimer-grade HTM count: consecutive parallel-plane moves on the same face count once
	 * (R R = R2 = 1). This is the number shown to users and stored with the solve, so `tps`
	 * is derived from it. The rooms page used to display the raw count instead, which made
	 * the same solve read differently on the two pages.
	 */
	htmCount: number;
	tps: number;
	source: SolveCompleteSource;
	/**
	 * How many ms were added because the move stream ended early (a dropped final packet).
	 * Zero on the clean path. Recorded by telemetry so the correction can be verified in the
	 * field instead of assumed.
	 */
	timeCorrectionMs: number;
	/**
	 * How far behind the physical solve the detection was, in ms. This is the number
	 * that shows up as a timer "jumping backwards" when the solve is committed.
	 */
	detectionLagMs: number;
}

export interface SmartSolveEngineOptions {
	/**
	 * Wait this long for a delayed BLE move before committing a solve from facelets alone.
	 * The move and facelets packets race; facelets sometimes wins, and committing
	 * immediately would drop the final move from the recorded solution.
	 */
	graceMs?: number;
	/** Backstop poll while timing, for cubes whose facelets event does not re-fire. */
	pollMs?: number;
	/** Turns older than the scramble-completion moment by this margin count as scramble moves. */
	lateMoveWindowMs?: number;
	/** Cap on consecutive dropped late-scramble moves, so a skewed cube clock cannot stall the timer. */
	maxLateDrops?: number;
	/**
	 * How long the cube must stay in an unrecognisable state before the warning is raised.
	 * Mid-turn the cube is legitimately neither solved nor on target, so reporting instantly
	 * makes the warning flash on and off while the user is simply turning.
	 */
	outOfSyncDelayMs?: number;
	solvedState?: string;
}

const DEFAULTS = {
	graceMs: 350,
	pollMs: 1000,
	lateMoveWindowMs: 50,
	maxLateDrops: 3,
	outOfSyncDelayMs: 1200,
};

/**
 * Shares the timer page's runtime flag: set `window.__SMART_DEBUG__ = true` in the console
 * to watch what the engine decides. Off by default, so this costs nothing in production.
 */
function dbg(...args: any[]): void {
	if (typeof window === 'undefined' || !(window as any).__SMART_DEBUG__) return;
	console.log('%c[ENGINE]', 'color:#00BCD4;font-weight:bold', ...args);
}

type Phase = 'idle' | 'scrambling' | 'ready' | 'timing';

export class SmartSolveEngine {
	private readonly emit: (event: SmartEngineEvent) => void;
	private readonly opts: Required<SmartSolveEngineOptions>;

	private tracker = new CubeTracker();
	private compressor = new IncrementalCompressor();

	private phase: Phase = 'idle';
	private scramble = '';
	private targetFacelets: string | null = null;

	private turns: SmartTurn[] = [];
	/** Index into `turns` where the current scramble attempt begins. */
	private streamOffset = 0;
	/** Index into `turns` where the solution begins (set when the scramble completes). */
	private solutionOffset = 0;

	private facelets: string | null = null;
	private physicallySolved = false;
	private lastMoveTime = 0;
	/**
	 * When the cube first reported itself solved for the current attempt.
	 *
	 * On the recovery paths the last move we hold predates the real finish — its packet was
	 * the one that got dropped — so its timestamp understates the solve. Measured over a
	 * week of live data, those solves came out 0.7 to 3.5 seconds short. This stamp is the
	 * closest evidence we have of when the solve actually ended.
	 */
	private solvedFaceletsAt: number | null = null;

	private connected = false;
	private scrambleCompletedAt: number | null = null;
	private timerStartedAt: number | null = null;
	private lateDrops = 0;
	private outOfSync = false;
	private lastUndoSignature = '';
	private lastProgressSignature = '';

	private graceTimer: ReturnType<typeof setTimeout> | null = null;
	private outOfSyncTimer: ReturnType<typeof setTimeout> | null = null;
	private pollTimer: ReturnType<typeof setInterval> | null = null;
	private disposed = false;

	constructor(emit: (event: SmartEngineEvent) => void, options: SmartSolveEngineOptions = {}) {
		this.emit = (event) => {
			// Stringified rather than passed as an object: DevTools only previews one level
			// deep, which hid the solve result (timing, detection lag) behind "Object".
			dbg(event.type, JSON.stringify(event, (k, v) =>
				k === 'solutionTurns' || k === 'correctedMoves' ? `[${v.length} turns]` : v
			));
			emit(event);
		};
		this.opts = {
			graceMs: options.graceMs ?? DEFAULTS.graceMs,
			pollMs: options.pollMs ?? DEFAULTS.pollMs,
			lateMoveWindowMs: options.lateMoveWindowMs ?? DEFAULTS.lateMoveWindowMs,
			maxLateDrops: options.maxLateDrops ?? DEFAULTS.maxLateDrops,
			outOfSyncDelayMs: options.outOfSyncDelayMs ?? DEFAULTS.outOfSyncDelayMs,
			solvedState: options.solvedState ?? DEFAULT_SOLVED_STATE,
		};
	}

	// ── Inputs ────────────────────────────────────────────────────────────────

	/**
	 * Install the scramble to be matched. Rebuilding the tracker from the scramble string
	 * (rather than waiting for moves) is what makes a reconnect onto an already-scrambled
	 * cube behave correctly.
	 *
	 * `targetScramble` exists for the timer's correction path: when the user mis-scrambles,
	 * the displayed scramble becomes a short sequence that fixes the difference, but the
	 * state the cube must end up in is still the original scramble's. Matching follows
	 * `scramble`; the facelets target follows `targetScramble` when given.
	 */
	setScramble(scramble: string, targetScramble?: string): void {
		if (this.disposed) return;
		const nextTarget = computeTargetFacelets(targetScramble || scramble);
		if (scramble === this.scramble && nextTarget === this.targetFacelets && this.phase !== 'idle') return;

		this.scramble = scramble || '';
		this.targetFacelets = nextTarget;
		this.phase = this.scramble ? 'scrambling' : 'idle';

		this.streamOffset = this.turns.length;
		this.solutionOffset = this.turns.length;
		this.scrambleCompletedAt = null;
		this.timerStartedAt = null;
		this.lateDrops = 0;
		this.compressor.reset();
		this.clearTimers();
		this.setUndo(null);
		this.publishProgress([]);
		// Belongs to the previous attempt; a stale stamp would land on the next solve.
		this.solvedFaceletsAt = null;

		// Anchor to whatever the cube last reported. Assuming "solved" is only right at the
		// start of a session: on the correction path the cube sits in a mis-scrambled state,
		// and starting from solved there would make every later comparison wrong.
		if (this.facelets && isValidFacelets(this.facelets)) {
			this.tracker.setFromFacelets(this.facelets, this.turns.length);
		} else {
			this.tracker.setSolved(this.turns.length);
		}
		this.setOutOfSync(false);
	}

	setConnected(connected: boolean): void {
		if (this.disposed) return;
		const wasConnected = this.connected;
		this.connected = connected;

		if (!connected) {
			this.clearTimers();
			return;
		}
		if (wasConnected) return;

		// Fresh connection: nothing known about the cube yet. The first facelets packet
		// re-anchors everything, which is why the tracker is not guessed here.
		this.compressor.reset();
		this.streamOffset = this.turns.length;
		this.solutionOffset = this.turns.length;
		this.scrambleCompletedAt = null;
		this.timerStartedAt = null;
		this.phase = this.scramble ? 'scrambling' : 'idle';
	}

	/**
	 * Feed the full turn stream. Callers hold it in Redux or component state and pass the
	 * whole array; the engine works out what is new. A stream that shrank is treated as a
	 * deliberate reset by the caller.
	 */
	pushTurns(turns: SmartTurn[]): void {
		if (this.disposed) return;

		const previous = this.turns;
		this.turns = turns;

		if (turns.length < previous.length) {
			// Caller cleared or trimmed its stream (timer does this when a scramble ends).
			this.tracker.streamCleared();
			this.compressor.reset();
			this.streamOffset = 0;
			this.solutionOffset = Math.min(this.solutionOffset, turns.length);

			// Rebuild the tracker to whichever state the cube should be in right now.
			// Rebuilding from `this.scramble` would be wrong on the correction path: there
			// the displayed scramble is a short fix-up sequence, not the state the cube is
			// in. The target facelets always describe that state.
			const scrambleDone = this.phase === 'timing' || this.scrambleCompletedAt != null;
			if (this.targetFacelets && scrambleDone) {
				this.tracker.setFromFacelets(this.targetFacelets, turns.length);
			} else if (this.facelets && isValidFacelets(this.facelets)) {
				this.tracker.setFromFacelets(this.facelets, turns.length);
			} else {
				this.tracker.setSolved(turns.length);
			}
			return;
		}

		if (turns.length === previous.length) return;

		const fresh = this.tracker.applyNew(turns);
		if (!fresh.length) return;

		const last = fresh[fresh.length - 1];
		this.lastMoveTime = moveTime(last) || this.lastMoveTime;

		if (this.phase === 'timing') {
			this.checkSolveFromTracker();
			return;
		}

		this.evaluateScramble(fresh);
	}

	/**
	 * Feed a facelets payload. This is the cube's own account of its state and the only
	 * signal that survives a dropped move packet.
	 */
	pushFacelets(facelets: string): void {
		if (this.disposed) return;
		if (!isValidFacelets(facelets)) return;

		const wasSolved = this.physicallySolved;
		this.facelets = facelets;
		this.physicallySolved = facelets === this.opts.solvedState;

		if (this.physicallySolved && !wasSolved) {
			// First packet reporting the solved state. Later packets repeat it (the cube
			// re-sends facelets roughly every second), so only the first one marks the finish.
			this.solvedFaceletsAt = Date.now();
		} else if (!this.physicallySolved) {
			this.solvedFaceletsAt = null;
		}

		if (this.phase === 'timing') {
			this.armGraceCommit();
			return;
		}

		if (this.phase === 'scrambling' && this.targetFacelets && facelets === this.targetFacelets) {
			this.completeScramble('facelets');
			return;
		}

		this.reconcileTracker();
	}

	/**
	 * The user (or a hardware reset) declared the cube solved. Re-anchors everything to
	 * the solved state so the next scramble starts from truth.
	 */
	markSolved(): void {
		if (this.disposed) return;
		this.facelets = this.opts.solvedState;
		this.physicallySolved = true;
		this.tracker.setSolved(this.turns.length);
		this.compressor.reset();
		this.streamOffset = this.turns.length;
		this.solutionOffset = this.turns.length;
		this.setOutOfSync(false);
	}

	/** Abandon the current attempt without committing a solve. */
	abort(): void {
		if (this.disposed) return;
		this.clearTimers();
		this.phase = this.scramble ? 'scrambling' : 'idle';
		this.scrambleCompletedAt = null;
		this.timerStartedAt = null;
		this.lateDrops = 0;
		this.compressor.reset();
		this.streamOffset = this.turns.length;
		this.solutionOffset = this.turns.length;
		this.setUndo(null);
	}

	dispose(): void {
		this.disposed = true;
		this.clearTimers();
	}

	// ── Read-only view, for callers that render engine state ──────────────────

	get isTiming(): boolean {
		return this.phase === 'timing';
	}

	get isReady(): boolean {
		return this.phase === 'ready';
	}

	get trackerState(): string {
		return this.tracker.state;
	}

	get target(): string | null {
		return this.targetFacelets;
	}

	/** Compressed user moves for the current scramble attempt, for the scramble display. */
	get scrambleProgress(): string[] {
		return this.compressor.getOutput();
	}

	// ── Scramble phase ────────────────────────────────────────────────────────

	private evaluateScramble(fresh: SmartTurn[]): void {
		if (this.phase === 'ready') {
			this.tryStartTimer(fresh[fresh.length - 1]);
			return;
		}
		if (this.phase !== 'scrambling' || !this.scramble) return;

		// Facelets first: it is independent of the move matcher and immune to double
		// moves arriving as two quarter turns.
		if (this.targetFacelets && this.facelets === this.targetFacelets) {
			this.completeScramble('facelets');
			return;
		}

		const relevant = this.turns.slice(this.streamOffset);
		const userMoves = this.compressor.processNew(relevant);
		const expected = this.scramble.split(' ').filter((m) => m.trim());
		const { matched, matchStatus } = matchScrambleWithCommutative(expected, userMoves);

		dbg('match', {
			userMoves: userMoves.join(' '),
			expected: expected.join(' '),
			matched,
			status: matchStatus.join(','),
			trackerOnTarget: this.tracker.matches(this.targetFacelets),
		});

		this.publishProgress(matchStatus);

		if (matched) {
			// The matcher says the sequence was right, but a lost BLE packet would make it
			// say that about a cube sitting in a different state. The tracker settles it.
			if (this.connected && this.targetFacelets && !this.tracker.matches(this.targetFacelets)) {
				dbg('matched but tracker off target — waiting for facelets');
				return;
			}
			this.completeScramble('matcher');
			return;
		}

		if (matchStatus.includes('wrong')) {
			const firstWrong = matchStatus.indexOf('wrong');
			const wrongMoves = userMoves.slice(firstWrong);
			if (wrongMoves.length > 7) {
				this.setUndo(['TOO_MANY']);
			} else {
				this.setUndo(wrongMoves.slice().reverse().map(invertMove));
			}
			return;
		}

		// 'half' is conveyed by the display's own colouring; nothing to undo yet.
		this.setUndo(null);
	}

	private completeScramble(source: ScrambleCompleteSource): void {
		// The tracker has to sit on the scramble target before timing can start. On the
		// facelets path it may still be at solved — the cube was scrambled while
		// disconnected, so no move ever reached the tracker. Leaving it there is exactly
		// how a cancelling pair like R R' came out as a finished 1.68s solve.
		if (this.targetFacelets && !this.tracker.matches(this.targetFacelets)) {
			this.tracker.setFromFacelets(this.targetFacelets, this.turns.length);
		}

		this.scrambleCompletedAt = Date.now();
		this.phase = 'ready';
		this.lateDrops = 0;
		this.solutionOffset = this.turns.length;
		this.setUndo(null);
		this.publishProgress([]);
		this.setOutOfSync(false);
		this.emit({ type: 'SCRAMBLE_COMPLETE', at: this.scrambleCompletedAt, source });
	}

	// ── Timing phase ──────────────────────────────────────────────────────────

	private tryStartTimer(turn: SmartTurn | undefined): void {
		if (!turn || this.scrambleCompletedAt == null) return;

		// The cube sends FACELETS and MOVE as separate packets and hands moves over in
		// batches, so a facelets packet can complete the scramble while the final scramble
		// move is still queued. That move then looks like the first solve move and starts
		// the timer seconds early. Three independent signals mark such a turn, because
		// each one alone has a blind spot.
		const cubeStillOnTarget = !!this.targetFacelets && this.tracker.matches(this.targetFacelets);
		const at = moveTime(turn);
		const predatesScrambleEnd = !!at && at < this.scrambleCompletedAt + this.opts.lateMoveWindowMs;
		const wasRecovered = turn.recovered === true;

		if (cubeStillOnTarget || predatesScrambleEnd || wasRecovered) {
			if (this.lateDrops < this.opts.maxLateDrops) {
				this.lateDrops++;
				this.emit({ type: 'LATE_SCRAMBLE_MOVE', turn });
				return;
			}
			// Cap reached: a badly skewed cube clock must not stall the timer forever.
		}

		const startedAt = at || Date.now();
		const inspectionMs = Math.max(0, startedAt - this.scrambleCompletedAt);

		this.phase = 'timing';
		this.timerStartedAt = startedAt;
		this.scrambleCompletedAt = null;
		this.startPoll();

		this.emit({ type: 'TIMER_START', startedAt, inspectionMs });

		// The move that started the timer is part of the solution; the tracker already
		// applied it, so only re-check whether it also finished the solve.
		this.checkSolveFromTracker();
	}

	private checkSolveFromTracker(): void {
		if (this.phase !== 'timing') return;
		if (!this.tracker.isSolved(this.opts.solvedState) && !this.physicallySolved) return;
		this.commitSolve('tracker');
	}

	/**
	 * Facelets says the cube is solved while a move packet may still be in flight. Waiting
	 * out the grace window keeps the final move in the recorded solution; if the move
	 * lands first, the tracker path commits and this timer is cancelled.
	 */
	private armGraceCommit(): void {
		if (this.phase !== 'timing' || !this.physicallySolved) return;
		if (this.graceTimer) return;

		this.graceTimer = setTimeout(() => {
			this.graceTimer = null;
			if (this.phase !== 'timing' || !this.physicallySolved) return;
			this.commitSolve('facelets-grace');
		}, this.opts.graceMs);
	}

	private startPoll(): void {
		this.stopPoll();
		this.pollTimer = setInterval(() => {
			if (this.phase !== 'timing') return;
			if (this.physicallySolved) this.commitSolve('facelets-poll');
		}, this.opts.pollMs);
	}

	private commitSolve(source: SolveCompleteSource): void {
		if (this.phase !== 'timing' || this.timerStartedAt == null) return;

		const startedAt = this.timerStartedAt;
		const solutionTurns = this.turns.slice(this.solutionOffset);

		this.clearTimers();
		this.phase = 'idle';
		this.timerStartedAt = null;

		// Prefer the cube's own clock over wall clock. Detection can be up to a poll
		// interval late, and stamping the solve with Date.now() is exactly what makes a
		// finished time appear seconds longer than the solve actually took.
		const lastTurn = solutionTurns[solutionTurns.length - 1];
		const lastMoveAt = moveTime(lastTurn) || this.lastMoveTime || 0;

		// On the recovery paths the final move never reached us, so the last move we hold is
		// from before the solve ended and its timestamp cuts the solve short. The facelets
		// stamp is late by however long the cube took to re-send its state (~1s at worst),
		// but that is far closer than the alternative: field data showed these solves being
		// recorded 0.7 to 3.5 seconds short. Never move the end backwards.
		const recovered = source !== 'tracker';
		const endedAt = recovered
			? Math.max(lastMoveAt, this.solvedFaceletsAt || 0) || Date.now()
			: lastMoveAt || Date.now();

		const { correctedMoves, finalTimeMs } = cubeTimestampLinearFit(
			solutionTurns as unknown as TimestampedMove[],
			startedAt
		);

		const fittedMs = Math.round(finalTimeMs);
		let timeMs = fittedMs;

		// The fit only sees the moves that arrived, so on a recovery it ends at the wrong
		// move. Span from the timer start to the real finish is the better answer there.
		const spanMs = endedAt - startedAt;
		if (recovered && spanMs > timeMs) {
			timeMs = spanMs;
		}
		if (timeMs <= 0) {
			// Linear fit needs two usable timestamp pairs. Older cubes report none, so fall
			// back to the move clock and only then to wall clock.
			timeMs = Math.max(0, spanMs);
		}

		const htmCount = countHTM(correctedMoves.map((m) => m.turn));
		const seconds = timeMs / 1000;
		const result: SolveResult = {
			timeMs,
			endedAt,
			solutionTurns,
			correctedMoves,
			turnCount: solutionTurns.length,
			htmCount,
			tps: seconds > 0 ? Number((htmCount / seconds).toFixed(2)) : 0,
			source,
			timeCorrectionMs: Math.max(0, timeMs - Math.max(0, fittedMs)),
			detectionLagMs: Math.max(0, Date.now() - endedAt),
		};

		this.solutionOffset = this.turns.length;
		this.streamOffset = this.turns.length;
		this.compressor.reset();
		this.tracker.setSolved(this.turns.length);
		this.publishProgress([]);
		// Consumed: the next attempt must stamp its own finish.
		this.solvedFaceletsAt = null;

		this.emit({ type: 'SOLVE_COMPLETE', result });
	}

	// ── Reconciliation ────────────────────────────────────────────────────────

	/**
	 * Outside a solve, the cube's reported state is authoritative. If the tracker drifted
	 * (dropped packet, moves made while disconnected) it is re-anchored here rather than
	 * left to poison the next solve detection.
	 */
	private reconcileTracker(): void {
		if (!this.facelets || this.phase === 'timing') return;
		if (this.tracker.matches(this.facelets)) {
			this.setOutOfSync(false);

			// The tracker agrees with the cube, so nothing is pending — but the scramble
			// matcher can still be holding moves from before (a stray turn right after a
			// solve, a packet replayed on reconnect). Those moves describe a cube state
			// that no longer exists, and they surface as a scramble whose first move is
			// already "half done" on a physically solved cube.
			if (this.phase !== 'ready' && this.physicallySolved && this.compressor.getOutput().length) {
				this.resetMatching();
			}
			return;
		}

		this.tracker.setFromFacelets(this.facelets, this.turns.length);
		this.resetMatching();
		this.emit({ type: 'TRACKER_RESYNCED', facelets: this.facelets });

		if (this.physicallySolved) {
			// Solved cube with a scramble pending: the user simply has not scrambled yet.
			this.phase = this.scramble ? 'scrambling' : 'idle';
			this.scrambleCompletedAt = null;
			this.setOutOfSync(false);
			return;
		}

		if (this.targetFacelets && this.facelets === this.targetFacelets) {
			this.completeScramble('facelets');
			return;
		}

		// Neither solved nor on target: the cube is in a state we cannot vouch for, and
		// no correction sequence derived from the move stream would be trustworthy.
		this.setUndo(null);
		this.setOutOfSync(true);
	}

	// ── Emission helpers ──────────────────────────────────────────────────────

	/**
	 * Forget everything the scramble matcher was holding and tell the UI about it.
	 * Every caller that clears the compressor goes through here — the bug this prevents is
	 * clearing the moves but leaving the display painted from them.
	 */
	private resetMatching(): void {
		this.compressor.reset();
		this.streamOffset = this.turns.length;
		this.setUndo(null);
		this.publishProgress([]);
	}

	/** Same de-duplication as setUndo: an unchanged status must not churn the UI. */
	private publishProgress(matchStatus: MatchStatus[]): void {
		const signature = matchStatus.join(',');
		if (signature === this.lastProgressSignature) return;
		this.lastProgressSignature = signature;
		this.emit({ type: 'SCRAMBLE_PROGRESS', matchStatus });
	}

	private setUndo(moves: string[] | null): void {
		const signature = moves ? moves.join(' ') : '';
		if (signature === this.lastUndoSignature) return;
		this.lastUndoSignature = signature;
		this.emit({ type: 'UNDO_MOVES', moves });
	}

	/**
	 * Raising the warning is delayed, clearing it is immediate.
	 *
	 * Mid-turn a cube is legitimately neither solved nor on target, and reporting that
	 * instantly made the warning flash on and off while the user was simply turning. Only a
	 * state the cube *stays* in is worth telling them about; recovery should show at once.
	 */
	private setOutOfSync(out: boolean): void {
		if (!out) {
			if (this.outOfSyncTimer) {
				clearTimeout(this.outOfSyncTimer);
				this.outOfSyncTimer = null;
			}
			if (!this.outOfSync) return;
			this.outOfSync = false;
			this.emit({ type: 'OUT_OF_SYNC', out: false });
			return;
		}

		if (this.outOfSync || this.outOfSyncTimer) return;
		this.outOfSyncTimer = setTimeout(() => {
			this.outOfSyncTimer = null;
			if (this.disposed) return;
			this.outOfSync = true;
			this.emit({ type: 'OUT_OF_SYNC', out: true });
		}, this.opts.outOfSyncDelayMs);
	}

	private clearTimers(): void {
		if (this.graceTimer) {
			clearTimeout(this.graceTimer);
			this.graceTimer = null;
		}
		if (this.outOfSyncTimer) {
			clearTimeout(this.outOfSyncTimer);
			this.outOfSyncTimer = null;
		}
		this.stopPoll();
	}

	private stopPoll(): void {
		if (this.pollTimer) {
			clearInterval(this.pollTimer);
			this.pollTimer = null;
		}
	}
}

function moveTime(turn: SmartTurn | undefined): number {
	if (!turn) return 0;
	const raw = (turn as any).completedAt ?? turn.time;
	if (!raw) return 0;
	return typeof raw === 'number' ? raw : new Date(raw).getTime();
}

/**
 * The facelets string the cube will report once the scramble is done. Computed from the
 * scramble rather than read from the cube, so it is available before the user touches it.
 */
export function computeTargetFacelets(scramble: string): string | null {
	const moves = (scramble || '').split(' ').filter((m) => m.trim());
	if (!moves.length) return null;
	try {
		// Imported lazily through CubeTracker to keep cubejs in one place.
		const tracker = new CubeTracker();
		return tracker.setFromScramble(scramble, 0) ? tracker.state : null;
	} catch (e) {
		console.warn('[smart-cube] target facelets computation failed:', e);
		return null;
	}
}
