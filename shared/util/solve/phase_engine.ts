/**
 * Smart cube reconstruction engine — main entry point.
 *
 * cstimer recons.js calcRecons() port + Zkt-Timer adaptation:
 *   - Phase detection with progress-based monotonic level descent
 *   - 6-axis rotation (cstimer CFOP uses n_axis=6)
 *   - Burst handling: if consecutive phases are skipped in one turn, filled with skipped:true
 *   - 1-move phase merge: merges very short noisy phases into next phase
 *   - OLL/PLL case identification at phase boundaries
 *   - Recognition vs execution time split (tsStart vs tsFirst)
 *
 * Engine SAF: turn sequence + start state -> transitions array. Wrappers convert this output
 * to frontend (LiveAnalysisResult) or backend (DB steps) shape.
 */

import Cube from 'cubejs';
import { SOLVED_FACELET } from './facelet_masks';
import {
	getCFOPProgress,
	progressToPhaseName,
	CROSS_AXIS_LABELS,
	getAxisRotationMove,
} from './cube_progress';
import { MoveCounter } from './move_counter';
import {
	SolveTurn,
	PhaseTransition,
	PhaseEngineResult,
	AnalyzeOptions,
	CFOPPhase,
	MoveCounts,
} from './types';
import { buildPrettyRecon } from './pretty_recon';
import { getMatchingOLLState, getMatchingPLLState } from './ll_identification';

const ROTATION_MOVES = new Set(['x', 'y', 'z', "x'", "y'", "z'", 'x2', 'y2', 'z2']);

function isEffectiveMove(move: string): boolean {
	const trimmed = (move || '').trim();
	if (!trimmed) return false;
	return !ROTATION_MOVES.has(trimmed);
}

const PHASE_ORDER: CFOPPhase[] = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

/**
 * Produces CFOP phase analysis from given turn sequence + start state.
 *
 * @param turns        SolveTurn[] (turn + ms timestamp)
 * @param startState   54-char facelet (cube state when scramble ends)
 * @param options      method (CFOP only for now), OLL/PLL identification toggles
 */
export function analyzePhases(
	turns: SolveTurn[],
	startState?: string,
	options: AnalyzeOptions = {}
): PhaseEngineResult {
	const { identifyOLL = true, identifyPLL = true } = options;

	const cube = startState ? safeFromString(startState) : new Cube();

	const transitions: PhaseTransition[] = [];
	const totalCounter = new MoveCounter();

	// initial progress
	const initialState = cube.asString();
	const initial = getCFOPProgress(initialState);
	let progress = initial.progress;
	let crossAxisIndex: number | null = null;

	// Boundary-aware HTM: single totalCounter, snapshot at phase start, delta at phase end.
	// This way axis-mask state doesn't get lost at phase boundary; cross end R + F2L_1 start R
	// = R2 (1 HTM) is correctly captured. Guaranteed: SUM(transitions[i].moveCount.htm) === totalMoves.htm.
	let phaseStartSnapshot: MoveCounts = totalCounter.snapshot();
	let phaseMoves: string[] = [];
	let phaseMoveTimestamps: number[] = [];
	let phaseStartMs = turns.length > 0 ? turns[0].timestamp : 0;
	let firstMoveMs = Infinity;

	// State snapshots for OLL/PLL identification: store states throughout phase
	// "before-phase" state = previous phase's end = this phase's start
	// For OLL identification: f2l_4 end state (= OLL phase start)
	// For PLL: oll end state (= PLL start)
	const phaseEndStates: Partial<Record<CFOPPhase, string>> = {};
	const phaseEndAxis: Partial<Record<CFOPPhase, number>> = {};

	// For partial-solve subsets (333cfop>oll, >pll, >ll etc.): scramble cube already
	// brings some phases to solved state. Engine doesn't produce transitions for those phases
	// (no curProg < progress descent). Identification chain (`beforeOLLState = phaseEndStates.f2l_4 || ...`)
	// stays null in this case → OLL/PLL case key not found, stats broken.
	//
	// Solution: infer from initial state "how many phases already solved", pre-populate
	// those phases' phaseEndStates with initialState. If Cross/F2L/OLL skipped, identification chain
	// stays filled, case key correctly found for user's final phases (e.g. PLL-only).
	//
	// progress 7 = full scramble (no phase solved)
	// progress 6 = cross solved, solve from f2l_1 onwards
	// progress 1 = cross+f2l+oll solved, only pll to solve
	// progress 0 = cube already solved
	//
	// numCompleted = 7 - initial.progress  (clamped to PHASE_ORDER length).
	const numCompleted = Math.max(0, Math.min(PHASE_ORDER.length, 7 - initial.progress));
	for (let i = 0; i < numCompleted; i++) {
		phaseEndStates[PHASE_ORDER[i]] = initialState;
		phaseEndAxis[PHASE_ORDER[i]] = initial.axisIndex;
	}

	for (let i = 0; i < turns.length; i++) {
		const t = turns[i];
		const move = t.turn;
		try {
			cube.move(move);
		} catch {
			// Invalid move: skip.
			continue;
		}

		const isEffective = isEffectiveMove(move);
		if (isEffective) {
			if (!isFinite(firstMoveMs)) firstMoveMs = t.timestamp;
			totalCounter.push(move);
		}
		phaseMoves.push(move);
		phaseMoveTimestamps.push(t.timestamp);

		const stateNow = cube.asString();
		const cur = getCFOPProgress(stateNow);
		const curProg = cur.progress;

		if (curProg < progress) {
			// One or more phases completed (burst handled with while loop)
			if (crossAxisIndex === null) {
				crossAxisIndex = cur.axisIndex;
			}

			// First descent: progress -> progress-1 phase completed
			const completedPhase = progressToPhaseName(progress - 1);
			if (completedPhase) {
				const curSnapshot = totalCounter.snapshot();
				transitions.push({
					phase: completedPhase,
					turnIndex: i,
					timestamp: t.timestamp,
					recognitionStart: phaseStartMs,
					firstMoveTimestamp: isFinite(firstMoveMs) ? firstMoveMs : t.timestamp,
					moveCount: deltaCounts(curSnapshot, phaseStartSnapshot),
					moves: phaseMoves.slice(),
					moveTimestamps: phaseMoveTimestamps.slice(),
					skipped: false,
				});
				phaseStartSnapshot = curSnapshot;
				phaseEndStates[completedPhase] = stateNow;
				phaseEndAxis[completedPhase] = cur.axisIndex;
			}
			progress -= 1;

			// Burst: if progress still > curProg, fill intermediate phases with skipped:true
			while (progress > curProg) {
				const skipPhase = progressToPhaseName(progress - 1);
				if (skipPhase) {
					transitions.push({
						phase: skipPhase,
						turnIndex: i,
						timestamp: t.timestamp,
						recognitionStart: t.timestamp,
						firstMoveTimestamp: t.timestamp,
						moveCount: { htm: 0, obtm: 0, etm: 0, stm: 0 },
						moves: [],
						skipped: true,
					});
					phaseEndStates[skipPhase] = stateNow;
					phaseEndAxis[skipPhase] = cur.axisIndex;
				}
				progress -= 1;
			}

			// Reset for next phase. phaseStartSnapshot already current (set above).
			// PRESERVE totalCounter state — no new MoveCounter, axis-mask flows across phases.
			phaseMoves = [];
			phaseMoveTimestamps = [];
			phaseStartMs = t.timestamp;
			firstMoveMs = Infinity;
		}
	}

	// 1-move phase merge pass: phases with HTM=1 are merged into next "real" phase
	mergeOneMovePhases(transitions);

	// OLL/PLL identification
	let ollIdentified: PhaseEngineResult['ollIdentified'];
	let pllIdentified: PhaseEngineResult['pllIdentified'];
	if (identifyOLL && phaseEndStates.oll) {
		// State at OLL phase end = OLL solved (top face solid). For identification we use
		// state BEFORE OLL phase started (= f2l_4 end).
		const beforeOLLState = phaseEndStates.f2l_4 || phaseEndStates.f2l_3 || phaseEndStates.f2l_2 || phaseEndStates.f2l_1 || phaseEndStates.cross;
		const axisForOLL = phaseEndAxis.oll ?? phaseEndAxis.f2l_4 ?? crossAxisIndex ?? 0;
		if (beforeOLLState) {
			const m = getMatchingOLLState(beforeOLLState, CROSS_AXIS_LABELS[axisForOLL]);
			if (m) ollIdentified = m;
		}
	}
	if (identifyPLL && phaseEndStates.pll) {
		const beforePLLState = phaseEndStates.oll;
		const axisForPLL = phaseEndAxis.pll ?? phaseEndAxis.oll ?? crossAxisIndex ?? 0;
		if (beforePLLState) {
			const m = getMatchingPLLState(beforePLLState, CROSS_AXIS_LABELS[axisForPLL]);
			if (m) pllIdentified = m;
		}
	}

	const totalTimeMs = turns.length > 0 ? turns[turns.length - 1].timestamp - turns[0].timestamp : 0;
	const finalProgressInfo = transitions.length > 0 ? progress : initial.progress;

	const result: PhaseEngineResult = {
		transitions: orderTransitions(transitions),
		totalMoves: totalCounter.snapshot(),
		totalTimeMs,
		ollIdentified,
		pllIdentified,
		prettyRecon: '',
		method: 'cfop',
		finalProgress: finalProgressInfo,
		crossFace: crossAxisIndex !== null ? CROSS_AXIS_LABELS[crossAxisIndex] : null,
	};

	result.prettyRecon = buildPrettyRecon(result);

	return result;
}

function safeFromString(facelet: string): any {
	try {
		return Cube.fromString(facelet);
	} catch {
		// Pathological input — start with solved cube.
		return new Cube();
	}
}

/**
 * Orders transitions in CFOP sequence. Engine already adds them in order,
 * this is just safety assurance.
 */
function orderTransitions(transitions: PhaseTransition[]): PhaseTransition[] {
	const order: Record<CFOPPhase, number> = {
		cross: 0,
		f2l_1: 1,
		f2l_2: 2,
		f2l_3: 3,
		f2l_4: 4,
		oll: 5,
		pll: 6,
	};
	return transitions.slice().sort((a, b) => order[a.phase] - order[b.phase]);
}

/**
 * cstimer recons.js:127-151 port. Merges phases with HTM=1 into next real phase.
 * Typically "noise" moves (accidentally made single move, undone) are cleaned this way.
 *
 * Algorithm: when HTM=1 phase found, find next HTM>0 phase, merge the two.
 */
function mergeOneMovePhases(transitions: PhaseTransition[]) {
	for (let i = 0; i < transitions.length; i++) {
		const cur = transitions[i];
		if (cur.skipped) continue;
		if (cur.moveCount.htm !== 1) continue;

		// Find next real phase
		let j = i + 1;
		while (j < transitions.length && (transitions[j].skipped || transitions[j].moves.length === 0)) {
			j++;
		}
		if (j >= transitions.length) break;

		const next = transitions[j];

		// Add current phase's moves to next phase start (chronological order)
		next.moves = cur.moves.concat(next.moves);

		// HTM sum: cur and next are already boundary-aware deltas. Simple addition,
		// SUM(transitions.htm) === totalCounter.htm invariant is preserved.
		next.moveCount = addCounts(cur.moveCount, next.moveCount);

		// Shift recognition start: this merged phase now starts from current phase's start
		next.recognitionStart = cur.recognitionStart;
		next.firstMoveTimestamp = Math.min(cur.firstMoveTimestamp, next.firstMoveTimestamp);

		// Transform current phase: change to zero-move skipped (make invisible)
		cur.skipped = true;
		cur.moves = [];
		cur.moveCount = { htm: 0, obtm: 0, etm: 0, stm: 0 };
	}
}

function deltaCounts(cur: MoveCounts, prev: MoveCounts): MoveCounts {
	return {
		htm: cur.htm - prev.htm,
		obtm: cur.obtm - prev.obtm,
		etm: cur.etm - prev.etm,
		stm: cur.stm - prev.stm,
	};
}

function addCounts(a: MoveCounts, b: MoveCounts): MoveCounts {
	return {
		htm: a.htm + b.htm,
		obtm: a.obtm + b.obtm,
		etm: a.etm + b.etm,
		stm: a.stm + b.stm,
	};
}

export function findTransition(result: PhaseEngineResult, phase: CFOPPhase): PhaseTransition | undefined {
	return result.transitions.find((t) => t.phase === phase);
}

export { PHASE_ORDER };
