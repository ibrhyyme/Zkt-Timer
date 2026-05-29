/**
 * Recognition time calculation — distinction between "thinking time" vs "execution time" for each phase.
 *
 * cstimer convention:
 *   - tsStart: start of phase (end time of previous phase)
 *   - tsFirst: first effective move of this phase (not rotation)
 *   - tsEnd: end of phase
 *
 *   recognitionTime = tsFirst - tsStart  (user recognized phase, started execution)
 *   executionTime   = tsEnd - tsFirst    (executed moves)
 *
 * If phase is rotation-only (example: y rotation then stop, phase starts),
 * tsFirst still equals effective move, recognition is mostly given rotation duration
 * internally (cstimer style).
 */

export interface PhaseTiming {
	startMs: number;
	firstMoveMs: number;
	endMs: number;
}

export interface PhaseTimingResult {
	totalMs: number;
	recognitionMs: number;
	executionMs: number;
}

export function computePhaseTiming(t: PhaseTiming): PhaseTimingResult {
	const totalMs = Math.max(0, t.endMs - t.startMs);
	const firstMoveMs = isFinite(t.firstMoveMs) ? t.firstMoveMs : t.startMs;
	const recognitionMs = Math.max(0, firstMoveMs - t.startMs);
	const executionMs = Math.max(0, t.endMs - firstMoveMs);
	return { totalMs, recognitionMs, executionMs };
}
