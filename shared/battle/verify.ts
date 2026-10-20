/**
 * Online Battle solve verification (design ranking-battle.md 4.7, checks 1-8).
 *
 * Pure functions. The server runs them on every battle:solve_done; the client runs the
 * same code to warn before sending a result that would be rejected. Check 9 (the
 * player's own solve history) needs a database query and lives on the server.
 *
 * Limits, stated plainly: the whole move log and every cube timestamp come from the
 * client. These checks catch an inconsistent fake, not a consistent one. The goal is
 * "cheating is visible and costly", not "impossible" (accepted by the owner).
 *
 * Honest solves are not perfect records. A dropped final BLE packet ends the solve from
 * the cube's facelets report (`facelets-grace`, `facelets-poll`, `move-order-fix`), so
 * the log can be a move or two short, some moves arrive without a cube timestamp, and the
 * engine adds `timeCorrectionMs` for the missing tail. Each check leaves room for exactly
 * those cases (see the tests), and only the heavy cases turn a solve into a DNF.
 */

import Cube from 'cubejs';
import { cubeTimestampLinearFit, TimestampedMove } from '../util/solve/cube_timing';
import { normalizeMove } from '../util/solve/notation';
import { faceletsSolved, startStateFromScramble } from '../util/solve/start_state';
import { analyzePhases } from '../util/solve/phase_engine';
import { countHTM } from '../util/solve/move_counter';
import {
	INSPECTION_MISMATCH_MS,
	MISSING_CUBE_TS_FLAG_RATIO,
	MISSING_CUBE_TS_MAX_RATIO,
	UNSTAMPED_END_MAX_MOVES,
	PROGRESS_TOLERANCE_MS,
	REPLAY_GAP_MAX_MOVES,
	SCRAMBLE_PAUSE_FLAG_MS,
	SUSPICIOUS_FAST_GAP_MS,
	SUSPICIOUS_FAST_GAP_RATIO,
	SUSPICIOUS_MIN_TIME_MS,
	SUSPICIOUS_TPS,
	TIME_CORRECTION_MAX_MS,
	TIME_MISMATCH_MS,
	WALLCLOCK_DNF_MS,
	WALLCLOCK_TOLERANCE_MS,
} from './config';
import { BATTLE_PROGRESS_STEPS, BattleProgressStep } from './events';
import { addPenalties, inspectionPenalty, isOverCutoff, worsePenalty } from './rules';
import {
	BattleDnfReason,
	BattleFlag,
	BattleMove,
	BattlePenalty,
	BattleSolveSource,
	RECOVERY_SOURCES,
} from './types';

const FACE_TURNS: string[] = (() => {
	const out: string[] = [];
	for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
		out.push(face, face + "'", face + '2');
	}
	return out;
})();

/** Applies moves to a cubejs cube, skipping what cubejs rejects (the phase engine's rule). */
function applyMoves(cube: any, moves: string[]): void {
	for (const raw of moves) {
		const move = normalizeMove(raw);
		if (!move) continue;
		try {
			cube.move(move);
		} catch {
			// Invalid move: skipped, same as PhaseAnalyzer.feed.
		}
	}
}

/** Cube state after replaying `moves` from `startState`, or null when the state is unreadable. */
export function replayState(startState: string, moves: string[]): string | null {
	try {
		const cube = Cube.fromString(startState);
		applyMoves(cube, moves);
		return cube.asString();
	} catch {
		return null;
	}
}

/**
 * Fewest face turns (0..maxDepth) that bring `state` to a solved cube, or null when it
 * takes more. Depth 2 is at most 18 + 18 * 18 states.
 */
export function movesToSolved(state: string, maxDepth: number = REPLAY_GAP_MAX_MOVES): number | null {
	if (faceletsSolved(state)) return 0;
	let frontier: string[] = [state];
	for (let depth = 1; depth <= maxDepth; depth++) {
		const next: string[] = [];
		for (const s of frontier) {
			for (const move of FACE_TURNS) {
				let after: string;
				try {
					const cube = Cube.fromString(s);
					cube.move(move);
					after = cube.asString();
				} catch {
					continue;
				}
				if (faceletsSolved(after)) return depth;
				next.push(after);
			}
		}
		frontier = next;
	}
	return null;
}

// ── Check 1: the scrambled cube matches the scramble ─────────────────────────

/** The cube's reported facelets at scramble end equal the scramble applied to a solved cube. */
export function scrambleFaceletsMatch(scramble: string, facelets: string | null | undefined): boolean {
	if (!facelets || facelets.length !== 54) return false;
	const expected = startStateFromScramble(scramble);
	return !!expected && expected === facelets;
}

// ── Check 2: replaying the log solves the cube ───────────────────────────────

export interface ReplayCheck {
	/** Replay ends solved, or ends within REPLAY_GAP_MAX_MOVES on a recovery path. */
	ok: boolean;
	/** Moves missing to solved: 0 when the log solves the cube, null when more than allowed. */
	gap: number | null;
}

export function isRecoverySource(source: BattleSolveSource | string | null | undefined): boolean {
	return RECOVERY_SOURCES.includes(source as BattleSolveSource);
}

export function checkReplay(scramble: string, moves: BattleMove[], source: BattleSolveSource): ReplayCheck {
	const start = startStateFromScramble(scramble);
	if (!start) return { ok: false, gap: null };
	const end = replayState(
		start,
		moves.map((m) => m.t)
	);
	if (!end) return { ok: false, gap: null };
	if (faceletsSolved(end)) return { ok: true, gap: 0 };
	if (!isRecoverySource(source)) return { ok: false, gap: null };
	const gap = movesToSolved(end, REPLAY_GAP_MAX_MOVES);
	return { ok: gap != null, gap };
}

// ── Check 3: cube clock present and in order ─────────────────────────────────

export interface CubeClockCheck {
	ok: boolean;
	missing: number;
	missingRatio: number;
	/** The first or the last move has no stamp (allowed up to UNSTAMPED_END_MAX_MOVES, flagged). */
	unstampedEnd: boolean;
}

const stamped = (m: BattleMove | undefined) => !!m && m.c != null && Number.isFinite(m.c);

/**
 * At most UNSTAMPED_END_MAX_MOVES unstamped moves at either end, at most 20% of the moves
 * missing a stamp, and the stamps that exist never go backwards.
 */
export function checkCubeClock(moves: BattleMove[]): CubeClockCheck {
	if (!moves.length) return { ok: false, missing: 0, missingRatio: 0, unstampedEnd: false };
	let missing = 0;
	let last: number | null = null;
	let ordered = true;
	for (const m of moves) {
		if (!stamped(m)) {
			missing++;
			continue;
		}
		if (last != null && (m.c as number) < last) ordered = false;
		last = m.c as number;
	}
	const missingRatio = missing / moves.length;
	let head = 0;
	while (head < moves.length && !stamped(moves[head])) head++;
	let tail = 0;
	while (tail < moves.length && !stamped(moves[moves.length - 1 - tail])) tail++;
	const endsUsable = head <= UNSTAMPED_END_MAX_MOVES && tail <= UNSTAMPED_END_MAX_MOVES && head < moves.length;
	return {
		ok: ordered && endsUsable && missingRatio <= MISSING_CUBE_TS_MAX_RATIO,
		missing,
		missingRatio,
		unstampedEnd: head > 0 || tail > 0,
	};
}

// ── Check 4: the server recomputes the time ──────────────────────────────────

/** Battle wire format to the timing module's input. `completedAt` is only its fallback. */
export function battleMovesToTimestamped(moves: BattleMove[]): TimestampedMove[] {
	return moves.map((m) => ({
		turn: m.t,
		cubeTimestamp: m.c ?? null,
		localTimestamp: m.l ?? null,
		completedAt: m.l ?? m.c ?? 0,
	}));
}

export interface TimeCheck {
	/** Time from the linear fit over the move log. */
	fittedMs: number;
	/** The engine's tail correction the server accepts: recovery paths only, at most 1000 ms. */
	correctionMs: number;
	serverTimeMs: number;
	/** The time that stands: the client's, unless it differs from the server's by more than 50 ms. */
	timeMs: number;
	mismatch: boolean;
}

export function checkTime(
	moves: BattleMove[],
	clientTimeMs: number,
	source: BattleSolveSource,
	timeCorrectionMs: number
): TimeCheck {
	const { finalTimeMs } = cubeTimestampLinearFit(battleMovesToTimestamped(moves));
	const fittedMs = Math.max(0, Math.round(finalTimeMs));
	const correctionMs = isRecoverySource(source)
		? Math.min(TIME_CORRECTION_MAX_MS, Math.max(0, Math.round(timeCorrectionMs || 0)))
		: 0;
	const serverTimeMs = fittedMs + correctionMs;
	const mismatch = !Number.isFinite(clientTimeMs) || Math.abs(clientTimeMs - serverTimeMs) > TIME_MISMATCH_MS;
	return {
		fittedMs,
		correctionMs,
		serverTimeMs,
		timeMs: mismatch ? serverTimeMs : Math.round(clientTimeMs),
		mismatch,
	};
}

// ── Check 5: the server's own clock ──────────────────────────────────────────

/**
 * How far inspection + time runs past the interval the server itself saw, from the
 * arrival of scramble_done to the arrival of solve_done. Network delay only makes that
 * interval longer, so a positive excess means the claim does not fit in real time.
 */
export function wallclockExcessMs(
	inspectionMs: number,
	timeMs: number,
	scrambleDoneServerAt: number,
	solveDoneServerAt: number
): number {
	return inspectionMs + timeMs - (solveDoneServerAt - scrambleDoneServerAt);
}

export type WallclockVerdict = 'ok' | 'flag' | 'dnf';

export function wallclockVerdict(excessMs: number): WallclockVerdict {
	if (excessMs > WALLCLOCK_DNF_MS) return 'dnf';
	if (excessMs > WALLCLOCK_TOLERANCE_MS) return 'flag';
	return 'ok';
}

// ── Check 6: inspection from the cube clock ──────────────────────────────────

export interface InspectionCheck {
	/** Inspection the penalty is decided from. */
	inspectionMs: number;
	/** Computed from the cube clock (false: taken from the client, `inspection_unverified`). */
	verified: boolean;
	flags: BattleFlag[];
}

export function checkInspection(
	lastScrambleCubeTs: [number | null, number | null] | null | undefined,
	firstSolveMoveCubeTs: number | null | undefined,
	clientInspectionMs: number | null | undefined
): InspectionCheck {
	const flags: BattleFlag[] = [];
	const [beforeLast, last] = lastScrambleCubeTs || [null, null];
	const client = clientInspectionMs != null && Number.isFinite(clientInspectionMs) ? Math.max(0, clientInspectionMs) : null;

	if (beforeLast != null && last != null && last - beforeLast > SCRAMBLE_PAUSE_FLAG_MS) {
		flags.push('scramble_pause');
	}

	if (last == null || firstSolveMoveCubeTs == null) {
		flags.push('inspection_unverified');
		return { inspectionMs: client ?? 0, verified: false, flags };
	}

	const fromCube = firstSolveMoveCubeTs - last;
	if (fromCube < 0) {
		// The cube clock went backwards between scramble and solve (a reconnect resets some
		// drivers' counters, or the stamps were edited). Not usable; fall back and flag.
		flags.push('inspection_mismatch');
		return { inspectionMs: client ?? 0, verified: false, flags };
	}
	if (client != null && Math.abs(client - fromCube) > INSPECTION_MISMATCH_MS) {
		flags.push('inspection_mismatch');
	}
	return { inspectionMs: fromCube, verified: true, flags };
}

// ── Check 7: progress events follow the move log ─────────────────────────────

export interface ReportedProgress {
	step: BattleProgressStep | string;
	atMs: number;
}

/**
 * The progress events a client should send for this move log: every CFOP step the log
 * reaches, with `atMs` the moment it was complete, in ms since the first solve move on the
 * corrected clock.
 *
 * The phase engine stamps a skipped step (an OLL skip, a burst) with its own internal
 * time, which can be earlier than the step before it. A step is only complete once every
 * step before it is, so the time is the running maximum in step order: a skipped step
 * completes together with the step that skipped it, as the live overlay reports it.
 */
export function expectedProgress(scramble: string, moves: BattleMove[]): ReportedProgress[] | null {
	const start = startStateFromScramble(scramble);
	if (!start || !moves.length) return null;
	const { correctedMoves } = cubeTimestampLinearFit(battleMovesToTimestamped(moves));
	let transitions;
	try {
		transitions = analyzePhases(
			correctedMoves.map((m) => ({ turn: m.turn, timestamp: m.completedAt })),
			start,
			{ method: 'cfop', identifyCases: false }
		).transitions;
	} catch {
		return null;
	}
	const first = correctedMoves[0].completedAt;
	const byStep = new Map<string, number>(transitions.map((t) => [t.phase, t.timestamp] as [string, number]));
	const out: ReportedProgress[] = [];
	let doneAt = first;
	for (const step of BATTLE_PROGRESS_STEPS) {
		const at = byStep.get(step);
		if (at == null) continue;
		doneAt = Math.max(doneAt, at);
		out.push({ step, atMs: Math.round(doneAt - first) });
	}
	return out;
}

/**
 * Check 7. The phase events the client sent agree with the phases the server rebuilds
 * from the move log (CFOP steps, the progress bar's model):
 *   - only known steps, each once, in step order by time;
 *   - each step the log reached is reported within PROGRESS_TOLERANCE_MS of the moment
 *     the log completes it;
 *   - a step the log never reached is reported only on a recovery path, whose log may
 *     legitimately stop a move or two short of the end.
 * An empty list passes: progress only feeds the opponent's bar.
 */
export function checkProgress(
	scramble: string,
	moves: BattleMove[],
	progress: ReportedProgress[] | null | undefined,
	timeMs: number,
	source: BattleSolveSource = 'tracker'
): boolean {
	if (!progress || progress.length === 0) return true;

	const stepIndex = (step: string) => BATTLE_PROGRESS_STEPS.indexOf(step as BattleProgressStep);
	const sorted = progress.slice().sort((x, y) => x.atMs - y.atMs || stepIndex(x.step) - stepIndex(y.step));
	const seen = new Set<string>();
	let lastIndex = -1;
	for (const p of sorted) {
		const index = stepIndex(p.step);
		if (index < 0 || seen.has(p.step)) return false;
		if (index < lastIndex) return false;
		if (!Number.isFinite(p.atMs) || p.atMs < 0 || p.atMs > timeMs + TIME_CORRECTION_MAX_MS) return false;
		seen.add(p.step);
		lastIndex = index;
	}

	const expected = expectedProgress(scramble, moves);
	if (!expected) return false;
	const expectedAt = new Map<string, number>(expected.map((p) => [p.step as string, p.atMs] as [string, number]));
	for (const p of sorted) {
		const at = expectedAt.get(p.step);
		if (at == null) {
			if (!isRecoverySource(source)) return false;
			continue;
		}
		if (Math.abs(p.atMs - at) > PROGRESS_TOLERANCE_MS) return false;
	}
	return true;
}

// ── Check 8: speed ───────────────────────────────────────────────────────────

/**
 * Under 5 s, over 15 TPS, or more than 20% of move gaps under 30 ms. Two quarter turns
 * of the same face in a row are one half turn as the cube reports it, so their gap is
 * naturally short and does not count.
 */
export function isSuspiciousSpeed(timeMs: number, moves: BattleMove[]): boolean {
	if (timeMs < SUSPICIOUS_MIN_TIME_MS) return true;
	const htm = countHTM(moves.map((m) => normalizeMove(m.t)));
	if (timeMs > 0 && htm / (timeMs / 1000) > SUSPICIOUS_TPS) return true;

	let gaps = 0;
	let fast = 0;
	for (let i = 1; i < moves.length; i++) {
		const prev = moves[i - 1];
		const cur = moves[i];
		if (prev.c == null || cur.c == null) continue;
		if ((prev.t || '').charAt(0) === (cur.t || '').charAt(0)) continue;
		gaps++;
		if (cur.c - prev.c < SUSPICIOUS_FAST_GAP_MS) fast++;
	}
	return gaps > 0 && fast / gaps > SUSPICIOUS_FAST_GAP_RATIO;
}

// ── All checks ───────────────────────────────────────────────────────────────

export interface VerifySolveInput {
	scramble: string;
	/** From battle:solve_done. */
	moves: BattleMove[];
	clientTimeMs: number;
	clientPenalty: BattlePenalty | null;
	source: BattleSolveSource;
	timeCorrectionMs: number;
	/** From battle:scramble_done. */
	lastScrambleCubeTs?: [number | null, number | null] | null;
	/** From battle:solve_start (the engine's own inspection). */
	clientInspectionMs?: number | null;
	/** The server's call on the scramble time (+2 past 20 s), stacked on the inspection call. */
	scramblePenalty?: BattlePenalty | null;
	/** battle:progress events of this round. */
	progress?: ReportedProgress[] | null;
	/** Server clock when scramble_done and solve_done arrived. Without both, check 5 is skipped (client preview). */
	scrambleDoneServerAt?: number | null;
	solveDoneServerAt?: number | null;
}

export interface VerifiedSolve {
	/** Raw time that stands (no penalty added). Kept on a DNF for display. */
	timeMs: number;
	penalty: BattlePenalty | null;
	dnfReason: BattleDnfReason | null;
	inspectionMs: number;
	/** The server's own recomputation (check 4), for the admin view. */
	serverTimeMs: number;
	flags: BattleFlag[];
}

/**
 * Runs checks 2-8 on one solve. Check 1 runs earlier, on scramble_done
 * (`scrambleFaceletsMatch`): a cube that does not match never starts the solve.
 *
 * DNF cases: the client's own DNF, check 2 (log does not solve the cube), check 3 (no
 * usable cube clock), check 5 (more than 3 s over real time), inspection over 17 s, over
 * the 60 s cutoff. Everything else only adds flags.
 */
export function verifySolve(input: VerifySolveInput): VerifiedSolve {
	const flags: BattleFlag[] = [];
	const addFlags = (list: BattleFlag[]) => {
		for (const f of list) if (!flags.includes(f)) flags.push(f);
	};
	let dnfReason: BattleDnfReason | null = null;
	const setDnf = (reason: BattleDnfReason) => {
		if (!dnfReason) dnfReason = reason;
	};

	const moves = Array.isArray(input.moves) ? input.moves : [];

	if (input.clientPenalty === 'DNF') setDnf('client');

	// Check 3
	const clock = checkCubeClock(moves);
	if (!clock.ok) setDnf('no_cube_clock');
	// An unstamped end is what a forged stamp would look like too, so it is always shown to
	// the admin, whatever the overall ratio.
	if (clock.missing > 0 && (clock.unstampedEnd || clock.missingRatio > MISSING_CUBE_TS_FLAG_RATIO)) {
		addFlags(['missing_cube_ts']);
	}

	// Check 2
	const replay = checkReplay(input.scramble, moves, input.source);
	if (!replay.ok) setDnf('replay_not_solved');
	else if (replay.gap && replay.gap > 0) addFlags(['replay_gap']);

	// Check 4
	const time = checkTime(moves, input.clientTimeMs, input.source, input.timeCorrectionMs);
	if (time.mismatch) addFlags(['time_mismatch']);

	// Check 6
	const firstCube = moves.length ? moves[0].c : null;
	const inspection = checkInspection(input.lastScrambleCubeTs, firstCube, input.clientInspectionMs);
	addFlags(inspection.flags);
	const inspectionCall = inspectionPenalty(inspection.inspectionMs);
	if (inspectionCall === 'DNF') setDnf('inspection');

	// Check 5
	if (input.scrambleDoneServerAt != null && input.solveDoneServerAt != null) {
		const excess = wallclockExcessMs(
			inspection.inspectionMs,
			time.timeMs,
			input.scrambleDoneServerAt,
			input.solveDoneServerAt
		);
		const verdict = wallclockVerdict(excess);
		if (verdict === 'dnf') setDnf('wallclock');
		else if (verdict === 'flag') addFlags(['wallclock_short']);
	}

	const inspectionPenaltyCall = worsePenalty(input.clientPenalty === 'PLUS_TWO' ? 'PLUS_TWO' : null, inspectionCall);
	let penalty = addPenalties(input.scramblePenalty === 'PLUS_TWO' ? 'PLUS_TWO' : null, inspectionPenaltyCall);
	if (!dnfReason && isOverCutoff(time.timeMs, penalty)) setDnf('cutoff');
	if (dnfReason) penalty = 'DNF';

	// Check 7
	if (!checkProgress(input.scramble, moves, input.progress, time.timeMs, input.source)) addFlags(['progress_mismatch']);

	// Check 8
	if (moves.length && isSuspiciousSpeed(time.timeMs, moves)) addFlags(['suspicious_speed']);

	return {
		timeMs: time.timeMs,
		penalty,
		dnfReason,
		inspectionMs: inspection.inspectionMs,
		serverTimeMs: time.serverTimeMs,
		flags,
	};
}
