/**
 * Smart cube reconstruction engine — main entry point.
 *
 * cstimer recons.js calcRecons() port + Zkt-Timer adaptation:
 *   - Phase detection with progress-based monotonic level descent
 *   - Orientation scanning (method-defined: 6 for cross-based, 24 for block-based)
 *   - Burst handling: if consecutive phases are skipped in one turn, filled with skipped:true
 *   - 1-move phase merge: merges very short noisy phases into next phase
 *   - Case identification at phase boundaries
 *   - Recognition vs execution time split (tsStart vs tsFirst)
 *
 * The engine is method-agnostic: everything method-specific (progress ladder,
 * orientation count, step names, case lookups) lives in shared/util/solve/methods/.
 *
 * Engine SAF: turn sequence + start state -> transitions array. Wrappers convert this output
 * to frontend (LiveAnalysisResult) or backend (DB steps) shape.
 */

import Cube from 'cubejs';
import { scanAxes, CROSS_AXIS_LABELS } from './cube_progress';
import { MoveCounter } from './move_counter';
import {
	SolveTurn,
	PhaseTransition,
	PhaseEngineResult,
	AnalyzeOptions,
	SolvePhase,
	MoveCounts,
	IdentifiedCase,
} from './types';
import { buildPrettyRecon } from './pretty_recon';
import { getMethod, MethodDefinition } from './methods';

const ROTATION_MOVES = new Set(['x', 'y', 'z', "x'", "y'", "z'", 'x2', 'y2', 'z2']);

function isEffectiveMove(move: string): boolean {
	const trimmed = (move || '').trim();
	if (!trimmed) return false;
	return !ROTATION_MOVES.has(trimmed);
}

/** CFOP phase order, kept exported for callers that predate the method registry. */
const PHASE_ORDER: SolvePhase[] = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

/**
 * Produces phase analysis from given turn sequence + start state.
 *
 * @param turns        SolveTurn[] (turn + ms timestamp)
 * @param startState   54-char facelet (cube state when scramble ends)
 * @param options      method id, case identification toggles
 */
export function analyzePhases(
	turns: SolveTurn[],
	startState?: string,
	options: AnalyzeOptions = {}
): PhaseEngineResult {
	const { identifyOLL = true, identifyPLL = true, identifyCases = true } = options;
	const method = getMethod(options.method);

	const cube = startState ? safeFromString(startState) : new Cube();

	const transitions: PhaseTransition[] = [];
	const totalCounter = new MoveCounter();

	const progressOf = (facelet: string) =>
		scanAxes(facelet, method.getProgress, method.axisCount);

	// initial progress
	const initialState = cube.asString();
	const initial = progressOf(initialState);
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

	// State snapshots for case identification: store states throughout phase.
	// "before-phase" state = previous phase's end = this phase's start.
	const phaseEndStates: Partial<Record<SolvePhase, string>> = {};
	const phaseEndAxis: Partial<Record<SolvePhase, number>> = {};

	// For partial-solve subsets (333cfop>oll, >pll, >ll etc.): scramble cube already
	// brings some phases to solved state. Engine doesn't produce transitions for those phases
	// (no curProg < progress descent). The identification chain would stay empty in that case,
	// so case keys would never be found and stats would break.
	//
	// Solution: infer from initial state "how many phases already solved", pre-populate
	// those phases' phaseEndStates with initialState.
	//
	// numCompleted = maxProgress - initial.progress (clamped to the method's step count).
	const numCompleted = Math.max(
		0,
		Math.min(method.steps.length, method.maxProgress - initial.progress)
	);
	for (let i = 0; i < numCompleted; i++) {
		phaseEndStates[method.steps[i]] = initialState;
		phaseEndAxis[method.steps[i]] = initial.axisIndex;
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
		const cur = progressOf(stateNow);
		const curProg = cur.progress;

		if (curProg < progress) {
			// One or more phases completed (burst handled with while loop)
			if (crossAxisIndex === null) {
				crossAxisIndex = cur.axisIndex;
			}

			// First descent: progress -> progress-1 phase completed
			const completedPhase = method.progressToPhase(progress - 1);
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
				const skipPhase = method.progressToPhase(progress - 1);
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

	const cases = identifyCases
		? runCaseIdentification(method, phaseEndStates, transitions, { identifyOLL, identifyPLL })
		: [];

	const totalTimeMs = turns.length > 0 ? turns[turns.length - 1].timestamp - turns[0].timestamp : 0;
	const finalProgressInfo = transitions.length > 0 ? progress : initial.progress;

	const result: PhaseEngineResult = {
		transitions: orderTransitions(transitions, method),
		totalMoves: totalCounter.snapshot(),
		totalTimeMs,
		cases,
		ollIdentified: cases.find((c) => c.set === 'oll'),
		pllIdentified: cases.find((c) => c.set === 'pll'),
		prettyRecon: '',
		method: method.id,
		finalProgress: finalProgressInfo,
		crossFace: crossAxisIndex !== null ? CROSS_AXIS_LABELS[crossAxisIndex % 6] : null,
	};

	result.prettyRecon = buildPrettyRecon(result);

	return result;
}

/**
 * Runs each of the method's case lookups against the state its phase started from.
 * A phase that never happened, or a "before" state that was never reached, yields
 * no case rather than a wrong one.
 */
function runCaseIdentification(
	method: MethodDefinition,
	phaseEndStates: Partial<Record<SolvePhase, string>>,
	transitions: PhaseTransition[],
	toggles: { identifyOLL: boolean; identifyPLL: boolean }
): IdentifiedCase[] {
	const out: IdentifiedCase[] = [];
	// A phase counts as performed only if the solver actually executed it. Phases
	// pre-populated because the scramble already had them solved, and phases marked
	// skipped, carry no case — reading one from a solved cube would invent a result.
	const performed = new Set(
		transitions.filter((t) => !t.skipped && t.moves.length > 0).map((t) => t.phase)
	);

	for (const spec of method.caseSpecs) {
		if (spec.set === 'oll' && !toggles.identifyOLL) continue;
		if (spec.set === 'pll' && !toggles.identifyPLL) continue;
		if (!performed.has(spec.phase)) continue;
		if (!phaseEndStates[spec.phase]) continue;

		let beforeState: string | undefined;
		for (const from of spec.fromPhases) {
			if (phaseEndStates[from]) {
				beforeState = phaseEndStates[from];
				break;
			}
		}
		if (!beforeState) continue;

		const match = spec.identify(beforeState);
		if (match) {
			out.push({ ...match, set: spec.set, phase: spec.phase });
		}
	}
	return out;
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
 * Orders transitions in the method's step sequence. Engine already adds them in order,
 * this is just safety assurance.
 */
function orderTransitions(
	transitions: PhaseTransition[],
	method: MethodDefinition
): PhaseTransition[] {
	const order: Record<string, number> = {};
	method.steps.forEach((s, i) => {
		order[s] = i;
	});
	return transitions.slice().sort((a, b) => (order[a.phase] ?? 0) - (order[b.phase] ?? 0));
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

export function findTransition(
	result: PhaseEngineResult,
	phase: SolvePhase
): PhaseTransition | undefined {
	return result.transitions.find((t) => t.phase === phase);
}

export { PHASE_ORDER };
