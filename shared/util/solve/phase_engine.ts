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
 * Resumable engine core. `feed()` only walks turns it has not seen yet — the
 * cube, move counter and phase state all persist on the instance — so a caller
 * that re-derives a result after every new turn (the live overlay) does
 * O(1) amortized work per turn instead of re-simulating the whole solve.
 *
 * `analyzePhases()` below is a one-shot wrapper (`new PhaseAnalyzer().feed(all)`)
 * kept for every existing caller — same code path, so output is byte-identical
 * to before this class existed.
 */
export class PhaseAnalyzer {
	private method: MethodDefinition;
	private cube: any;
	private transitions: PhaseTransition[] = [];
	private totalCounter = new MoveCounter();
	private progress: number;
	private crossAxisIndex: number | null = null;

	// Boundary-aware HTM: single totalCounter, snapshot at phase start, delta at phase end.
	// This way axis-mask state doesn't get lost at phase boundary; cross end R + F2L_1 start R
	// = R2 (1 HTM) is correctly captured. Guaranteed: SUM(transitions[i].moveCount.htm) === totalMoves.htm.
	private phaseStartSnapshot: MoveCounts;
	private phaseMoves: string[] = [];
	private phaseMoveTimestamps: number[] = [];
	private phaseStartMs = 0;
	private firstMoveMs = Infinity;

	// State snapshots for case identification: store states throughout phase.
	// "before-phase" state = previous phase's end = this phase's start.
	private phaseEndStates: Partial<Record<SolvePhase, string>> = {};
	private phaseEndAxis: Partial<Record<SolvePhase, number>> = {};

	private processedCount = 0;
	private firstTurnMs = 0;
	private lastTurnMs = 0;

	constructor(startState?: string, options: AnalyzeOptions = {}) {
		this.method = getMethod(options.method);
		this.cube = startState ? safeFromString(startState) : new Cube();

		const initialState = this.cube.asString();
		const initial = this.progressOf(initialState);
		this.progress = initial.progress;
		this.phaseStartSnapshot = this.totalCounter.snapshot();

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
			Math.min(this.method.steps.length, this.method.maxProgress - initial.progress)
		);
		for (let i = 0; i < numCompleted; i++) {
			this.phaseEndStates[this.method.steps[i]] = initialState;
			this.phaseEndAxis[this.method.steps[i]] = initial.axisIndex;
		}
	}

	/** How many turns from a caller's stream this instance has already applied. */
	get processed(): number {
		return this.processedCount;
	}

	private progressOf(facelet: string) {
		return scanAxes(facelet, this.method.getProgress, this.method.axisCount);
	}

	/**
	 * Feed the full turn stream so far. Only the turns beyond what was already
	 * processed are simulated — safe to call with the same growing array on
	 * every new turn (mirrors CubeTracker.applyNew's slice-what's-new contract).
	 */
	feed(turnsSoFar: SolveTurn[]): void {
		if (turnsSoFar.length <= this.processedCount) return;

		if (this.processedCount === 0) {
			this.phaseStartMs = turnsSoFar[0].timestamp;
			this.firstTurnMs = turnsSoFar[0].timestamp;
		}
		this.lastTurnMs = turnsSoFar[turnsSoFar.length - 1].timestamp;

		for (let i = this.processedCount; i < turnsSoFar.length; i++) {
			const t = turnsSoFar[i];
			const move = t.turn;
			try {
				this.cube.move(move);
			} catch {
				// Invalid move: skip.
				continue;
			}

			const isEffective = isEffectiveMove(move);
			if (isEffective) {
				if (!isFinite(this.firstMoveMs)) this.firstMoveMs = t.timestamp;
				this.totalCounter.push(move);
			}
			this.phaseMoves.push(move);
			this.phaseMoveTimestamps.push(t.timestamp);

			const stateNow = this.cube.asString();
			const cur = this.progressOf(stateNow);
			const curProg = cur.progress;

			if (curProg < this.progress) {
				// One or more phases completed (burst handled with while loop)
				if (this.crossAxisIndex === null) {
					this.crossAxisIndex = cur.axisIndex;
				}

				// First descent: progress -> progress-1 phase completed
				const completedPhase = this.method.progressToPhase(this.progress - 1);
				if (completedPhase) {
					const curSnapshot = this.totalCounter.snapshot();
					this.transitions.push({
						phase: completedPhase,
						turnIndex: i,
						timestamp: t.timestamp,
						recognitionStart: this.phaseStartMs,
						firstMoveTimestamp: isFinite(this.firstMoveMs) ? this.firstMoveMs : t.timestamp,
						moveCount: deltaCounts(curSnapshot, this.phaseStartSnapshot),
						moves: this.phaseMoves.slice(),
						moveTimestamps: this.phaseMoveTimestamps.slice(),
						skipped: false,
					});
					this.phaseStartSnapshot = curSnapshot;
					this.phaseEndStates[completedPhase] = stateNow;
					this.phaseEndAxis[completedPhase] = cur.axisIndex;
				}
				this.progress -= 1;

				// Burst: if progress still > curProg, fill intermediate phases with skipped:true
				while (this.progress > curProg) {
					const skipPhase = this.method.progressToPhase(this.progress - 1);
					if (skipPhase) {
						this.transitions.push({
							phase: skipPhase,
							turnIndex: i,
							timestamp: t.timestamp,
							recognitionStart: t.timestamp,
							firstMoveTimestamp: t.timestamp,
							moveCount: { htm: 0, obtm: 0, etm: 0, stm: 0 },
							moves: [],
							skipped: true,
						});
						this.phaseEndStates[skipPhase] = stateNow;
						this.phaseEndAxis[skipPhase] = cur.axisIndex;
					}
					this.progress -= 1;
				}

				// Reset for next phase. phaseStartSnapshot already current (set above).
				// PRESERVE totalCounter state — no new MoveCounter, axis-mask flows across phases.
				this.phaseMoves = [];
				this.phaseMoveTimestamps = [];
				this.phaseStartMs = t.timestamp;
				this.firstMoveMs = Infinity;
			}
		}

		this.processedCount = turnsSoFar.length;
	}

	/**
	 * Derives a result from the current state. Safe to call after every feed():
	 * works off a cloned transitions array so the merge pass below never mutates
	 * state feed() still builds on, and re-running the merge from scratch each
	 * time is what lets a 1-move phase whose "next real phase" hadn't happened
	 * yet get merged retroactively once it does.
	 */
	getResult(options: AnalyzeOptions = {}): PhaseEngineResult {
		const { identifyOLL = true, identifyPLL = true, identifyCases = true } = options;

		const transitions = this.transitions.map((t) => ({ ...t, moves: t.moves.slice() }));

		// 1-move phase merge pass: phases with HTM=1 are merged into next "real" phase
		mergeOneMovePhases(transitions);

		const cases = identifyCases
			? runCaseIdentification(this.method, this.phaseEndStates, transitions, {
					identifyOLL,
					identifyPLL,
				})
			: [];

		const totalTimeMs = this.processedCount > 0 ? this.lastTurnMs - this.firstTurnMs : 0;

		const result: PhaseEngineResult = {
			transitions: orderTransitions(transitions, this.method),
			totalMoves: this.totalCounter.snapshot(),
			totalTimeMs,
			cases,
			ollIdentified: cases.find((c) => c.set === 'oll'),
			pllIdentified: cases.find((c) => c.set === 'pll'),
			prettyRecon: '',
			method: this.method.id,
			finalProgress: this.progress,
			crossFace: this.crossAxisIndex !== null ? CROSS_AXIS_LABELS[this.crossAxisIndex % 6] : null,
		};

		result.prettyRecon = buildPrettyRecon(result);

		return result;
	}
}

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
	const analyzer = new PhaseAnalyzer(startState, options);
	analyzer.feed(turns);
	return analyzer.getResult(options);
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

		// Transform current phase: change to zero-move skipped (make invisible). `merged`
		// records that this was a real, completed phase folded into the next one for
		// display — unlike a burst-skipped phase, its moves are still accounted for
		// (added into next.moveCount above), just attributed to the following phase.
		cur.skipped = true;
		cur.merged = true;
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
