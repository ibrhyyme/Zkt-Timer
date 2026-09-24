// Pure decision layer: detector output plus a snapshot of the timer state in, one action
// out. It never imports events.ts (react-dom, store) so every branch is unit tested.
import { MAX_ONSET_AGE_MS } from './config';
import type { StartBlockReason } from './start_guard';
import type { DetectorPhase, MagnetHint } from './types';

/**
 * off:                feature inactive
 * unsupported:        sensor too slow
 * unknown:            baseline not trusted, move the cube away and re-learn
 * far:                cube away, nothing to do
 * closer:             cube near the phone but not at the hot spot
 * not_armed:          cube placed too soon after a stop; take it away (scramble) first
 * dwelling:           cube placed, waiting out the rest time (orange)
 * ready_inspection:   lifting starts inspection (green)
 * ready_solve:        lifting starts the solve (green)
 * inspection_waiting: inspection running, cube in hand; place it to get ready
 * blocked:            a timer guard (modal, edit, touch hold, test mode...) is in the way
 * solving:            the solve is running
 */
export type MagnetStage =
	| 'off'
	| 'unsupported'
	| 'unknown'
	| 'far'
	| 'closer'
	| 'not_armed'
	| 'dwelling'
	| 'ready_inspection'
	| 'ready_solve'
	| 'inspection_waiting'
	| 'blocked'
	| 'solving';

export interface TimerSide {
	guard: StartBlockReason | null;
	inspectionEnabled: boolean;
	inInspection: boolean;
	dnfTime: boolean;
	/** timeStartedAt is set. */
	solving: boolean;
	/** A touch or Space hold is in progress (spaceTimerStarted); it owns the start. */
	touchPriming: boolean;
}

export interface ReadinessInput extends TimerSide {
	phase: DetectorPhase;
	hint: MagnetHint;
	nearSince: number | null;
	lastT: number | null;
	dwellMs: number;
	/** The current placement may start something from idle (see service armed rule). */
	armed: boolean;
}

export interface Readiness {
	stage: MagnetStage;
	green: boolean;
	orange: boolean;
}

export function dwellMsFor(freezeTimeSeconds: number | null | undefined, minDwellMs: number): number {
	const freezeMs = typeof freezeTimeSeconds === 'number' && freezeTimeSeconds > 0 ? freezeTimeSeconds * 1000 : 0;
	return Math.max(minDwellMs, freezeMs);
}

export function computeReadiness(r: ReadinessInput): Readiness {
	const none = (stage: MagnetStage): Readiness => ({ stage, green: false, orange: false });

	if (r.solving) return none('solving');
	if (r.phase === 'unsupported') return none('unsupported');
	if (r.phase === 'unknown') return none('unknown');
	if (r.phase !== 'near') {
		if (r.hint === 'closer') return none('closer');
		return none(r.inInspection ? 'inspection_waiting' : 'far');
	}

	if (r.guard || r.touchPriming) return none('blocked');
	if (r.inInspection && r.dnfTime) return none('blocked');
	if (!r.inInspection && !r.armed) return none('not_armed');

	const dwellDone = r.nearSince !== null && r.lastT !== null && r.lastT - r.nearSince >= r.dwellMs;
	if (!dwellDone) return { stage: 'dwelling', green: false, orange: true };

	// Same colour language as the touch timer: green means "releasing now does the next
	// thing". With inspection on, the idle hold is green too and releasing starts inspection.
	if (!r.inInspection && r.inspectionEnabled) return { stage: 'ready_inspection', green: true, orange: false };
	return { stage: 'ready_solve', green: true, orange: false };
}

export interface LiftContext extends TimerSide {
	now: number;
	/** Samples older than the last stream (re)start are stale. */
	resumeAt: number;
	armed: boolean;
	dwellMs: number;
	/** inspection_except_bld is on and the subset is a blind one. */
	exceptBld: boolean;
	inspectionStartedAt: number | null;
	inspectionDelayMs: number;
}

export interface LiftInput {
	onset: number;
	nearSince: number;
}

export type MagnetAction =
	| { kind: 'none'; reason: string }
	| { kind: 'startInspection' }
	| { kind: 'startTimer'; onset: number; addTwo?: boolean };

export function decideOnLift(c: LiftContext, lift: LiftInput): MagnetAction {
	if (c.solving) return { kind: 'none', reason: 'solving' };
	if (c.touchPriming) return { kind: 'none', reason: 'touch_priming' };
	if (c.guard) return { kind: 'none', reason: c.guard };

	// Never start from a timestamp the touch path would also refuse (events.ts startTimer),
	// nor from samples that predate the stream restart.
	if (c.now - lift.onset > MAX_ONSET_AGE_MS || lift.onset < c.resumeAt) {
		return { kind: 'none', reason: 'stale' };
	}
	if (lift.onset - lift.nearSince < c.dwellMs) return { kind: 'none', reason: 'not_ready' };

	const start = Math.min(lift.onset, c.now);

	if (c.inInspection) {
		if (c.dnfTime) return { kind: 'none', reason: 'dnf' };
		// The inspection interval flips addTwoToSolve on its own 100 ms tick, and this
		// decision lands a confirmation later than the onset. Judge +2 by the onset.
		const addTwo =
			c.inspectionStartedAt !== null && start - c.inspectionStartedAt >= c.inspectionDelayMs;
		return { kind: 'startTimer', onset: start, addTwo };
	}

	if (!c.armed) return { kind: 'none', reason: 'not_armed' };

	if (c.inspectionEnabled) {
		// startInspection would skip straight to startTimer() without a timestamp on blind
		// subsets; do it here so the start keeps the backdated onset.
		if (c.exceptBld) return { kind: 'startTimer', onset: start };
		return { kind: 'startInspection' };
	}

	return { kind: 'startTimer', onset: start };
}

/**
 * Whether the current placement may start something from idle. The cube has to have
 * been away for `armFarMs` after the last stop or reset, so picking it up to scramble
 * right after a solve (or resting it at the phone for a moment) cannot start the timer.
 */
export function isArmed(nearFarSince: number | null, nearSince: number, disarmedAt: number, armFarMs: number): boolean {
	if (nearFarSince === null) return false;
	if (nearSince < disarmedAt) return false;
	return nearSince - Math.max(nearFarSince, disarmedAt) >= armFarMs;
}
