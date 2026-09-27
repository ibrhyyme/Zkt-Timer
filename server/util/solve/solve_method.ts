/**
 * Backend wrapper — converts shared phase engine output to DB steps shape expected by Solve.resolver.ts.
 * Phase detection itself lives in shared/util/solve/phase_engine.ts; this file is a thin adapter.
 *
 * Engine output (PhaseEngineResult) -> backend steps shape conversion:
 *   - transitions[] -> an object keyed by step name
 *   - Each step: turn_count, turns string, total_time (seconds), tps, parent_name,
 *     recognition_time, case keys, step_index, step_name
 *
 * createSolveMethodSteps (server/models/solve_method_step.ts) takes this shape, writes to DB.
 *
 * Method-agnostic: CFOP keeps its aggregated `f2l` parent row (four sub-steps hang
 * off it), every other method writes one flat row per step.
 */

import { cascadeQuartersForDisplay, SmartTurn } from '../../../client/util/smart_scramble';
import { analyzePhases } from '../../../shared/util/solve/phase_engine';
import { getMethod } from '../../../shared/util/solve/methods';
import { detectSolveMethod } from '../../../shared/util/solve/detect_method';
import { SolveTurn, PhaseTransition, SolveMethod, SolvePhase } from '../../../shared/util/solve/types';
import { countHTM } from '../../../shared/util/solve/move_counter';
import { getPrettyMoves, TimedMove } from '../../../shared/util/solve/pretty_moves';
import {
	resolveAnalysisStartState,
	startStateFromScramble,
	startStateFromSolvedEnd,
} from '../../../shared/util/solve/start_state';
void cascadeQuartersForDisplay; // legacy import — migrated to getPrettyMoves

const F2L_SUB_STEPS = ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4'];

/**
 * @param method  Method id, or 'auto' to infer it from the solve itself.
 *                'auto' is the default for new clients: the user's setting can be
 *                stale (left on Roux while solving CFOP), whereas the states the
 *                cube passed through cannot lie.
 * @param fallbackMethod  With 'auto', the method used when detection is not confident
 *                (a very short solve, a partial subset). CFOP unless given: a reindex
 *                passes the method already stored on the solve, so an unclear case keeps
 *                what it had instead of being flipped to CFOP.
 * @param options.endedSolved  The solve finished on a solved cube (completed, not DNF).
 *                Only then may the start be derived from the moves when a lost packet
 *                keeps them from solving the cube from the scramble. Defaults to false so
 *                a caller that forgets cannot invent a complete breakdown for a DNF.
 *
 * Returns null when the engine fails, so a caller that is replacing existing rows can
 * keep them instead of wiping them for an empty result.
 */
export function getSolveSteps(
	turns: SmartTurn[],
	scramble?: string,
	method: string = 'cfop',
	fallbackMethod?: SolveMethod,
	options: { endedSolved?: boolean } = {}
) {
	try {
		return getSolveStepsInner(turns, scramble, method, fallbackMethod, !!options.endedSolved);
	} catch (e: any) {
		console.warn('[getSolveSteps] engine failed:', e?.message);
		return null;
	}
}

/** Result shape carries a key per step so createSolveMethodSteps can iterate it. */
function emptySteps(method: SolveMethod | string) {
	const out: any = { __method: method };
	for (const s of getMethod(method).steps) out[s] = null;
	if (method === 'cfop' || method === 'cfop2') out.f2l = null;
	return out;
}

function getSolveStepsInner(
	turns: SmartTurn[],
	scramble: string | undefined,
	requested: string,
	fallbackMethod: SolveMethod | undefined,
	endedSolved: boolean
) {
	const engineTurns: SolveTurn[] = (turns || [])
		.filter((t) => t && typeof t.turn === 'string')
		.map((t) => ({
			turn: t.turn,
			// Negative offsets are not a real time: the virtual cube stored its inspection
			// rotations at absolute 0, which serialized as about -1.7e12 ms and turned the
			// first phase into a 1.7-billion-second step. They happened at the start.
			timestamp: Math.max(
				0,
				typeof (t as any).completedAt === 'number'
					? (t as any).completedAt
					: typeof (t as any).time === 'number'
						? (t as any).time
						: 0
			),
		}));

	if (engineTurns.length === 0) {
		return emptySteps('cfop');
	}

	// Start state calculation:
	// The scramble applied to a solved cube is the real start, and the only one that keeps
	// partial-solve subsets (333cfop>oll, >pll etc.) identifying their cases. When a lost or
	// reordered packet leaves moves that cannot solve the cube from there, a completed solve
	// falls back to cstimer's start derived from the moves (shared/util/solve/start_state.ts).
	//
	// No scramble at all (old admin scripts): the derived start, as before.
	const startState = scramble
		? resolveAnalysisStartState({
				turns: engineTurns,
				preferred: startStateFromScramble(scramble),
				endedSolved,
			}).state
		: startStateFromSolvedEnd(engineTurns);

	// Resolve 'auto' against the solve itself; an explicit choice is respected.
	const method: SolveMethod = requested === 'auto'
		? detectSolveMethod(engineTurns, startState, fallbackMethod).method
		: (requested as SolveMethod);

	const result = analyzePhases(engineTurns, startState, { method });
	const def = getMethod(method);

	const transitionByPhase: Partial<Record<SolvePhase, PhaseTransition>> = {};
	for (const t of result.transitions) transitionByPhase[t.phase] = t;

	// Recognized case per phase, so a step row carries the case it was solving.
	const caseByPhase: Record<string, { key: string; set: string }> = {};
	for (const c of result.cases || []) caseByPhase[c.phase] = { key: c.key, set: c.set };

	const steps: any = emptySteps(method);
	steps.__method = method;

	const buildStep = (
		t: PhaseTransition | undefined,
		stepIndex: number,
		parentName: string | null,
		phaseId: string
	) => {
		if (!t) return null;
		const totalSec = Math.max(0, (t.timestamp - t.recognitionStart) / 1000);
		const recognitionSec = Math.max(
			0,
			(isFinite(t.firstMoveTimestamp) ? t.firstMoveTimestamp : t.timestamp) - t.recognitionStart
		) / 1000;
		const moves = t.moves;
		// cstimer-grade HTM: engine calculates moveCount.htm for each transition.
		// Using HTM instead of raw moves.length ensures DB consistency and correct TPS.
		const moveCount = t.moveCount.htm;
		const tps = moveCount && totalSec > 0 ? Math.floor((moveCount / totalSec) * 100) / 100 : 0;
		const turnsAsObjects: any[] = moves.map((m) => ({ turn: m }));
		const timed: TimedMove[] = moves.map((turn, i) => ({
			turn,
			timestamp: t.moveTimestamps?.[i] ?? 0,
		}));
		const found = caseByPhase[phaseId];
		return {
			index: stepIndex,
			parentName,
			skipped: t.skipped || moveCount <= 2,
			turns: turnsAsObjects,
			recognitionTime: recognitionSec,
			tps,
			// mergeSlices=false: a smart cube can't physically turn a middle slice, so
			// a fast R then L' is two real face turns, not an M the user made (see
			// pretty_moves.ts). A collapsed "S" the user never turned then desyncs the
			// 3D replay from the moves that follow it.
			turnsString: getPrettyMoves(timed, false),
			turnCount: moveCount,
			time: totalSec,
			caseKey: found?.key,
			caseSet: found?.set,
			// Legacy columns, still written so existing readers keep working.
			ollCaseKey: found?.set === 'oll' ? found.key : undefined,
			pllCaseKey: found?.set === 'pll' ? found.key : undefined,
		};
	};

	const isCfopFamily = method === 'cfop' || method === 'cfop2';

	if (!isCfopFamily) {
		// Flat: one row per step, in the method's own order.
		def.steps.forEach((id, idx) => {
			steps[id] = buildStep(transitionByPhase[id], idx, null, id);
		});
		return steps;
	}

	// CFOP family keeps the aggregated f2l parent with four children hanging off it,
	// because the stats layer and the solve detail table both rely on that shape.
	let stepIndex = 0;
	steps.cross = buildStep(transitionByPhase.cross, stepIndex++, null, 'cross');

	const f2lTransitions = F2L_SUB_STEPS
		.map((p) => transitionByPhase[p])
		.filter(Boolean) as PhaseTransition[];

	if (f2lTransitions.length > 0) {
		const first = f2lTransitions[0];
		const last = f2lTransitions[f2lTransitions.length - 1];
		const f2lMoves = f2lTransitions.flatMap((t) => t.moves);
		const f2lMovesAsObj = f2lMoves.map((m) => ({ turn: m }));
		// Per-move timestamps by concatenating all F2L sub-phases and passing to getPrettyMoves
		const f2lTimed: TimedMove[] = f2lTransitions.flatMap((t) =>
			t.moves.map((turn, i) => ({ turn, timestamp: t.moveTimestamps?.[i] ?? 0 }))
		);
		const f2lTotalSec = Math.max(0, (last.timestamp - first.recognitionStart) / 1000);
		// cstimer-grade HTM: count all F2L moves at once (captures parallel plane cancels
		// that may occur at phase boundaries).
		const f2lHtm = countHTM(f2lMoves);
		const f2lTps = f2lHtm && f2lTotalSec > 0
			? Math.floor((f2lHtm / f2lTotalSec) * 100) / 100
			: 0;

		steps.f2l = {
			index: stepIndex++,
			parentName: null,
			skipped: f2lHtm <= 2,
			turns: f2lMovesAsObj,
			recognitionTime: 0,
			tps: f2lTps,
			// mergeSlices=false — see comment above, same reasoning applies to F2L.
			turnsString: getPrettyMoves(f2lTimed, false),
			turnCount: f2lHtm,
			time: f2lTotalSec,
		};

		// Sub-steps are written to DB with parent='f2l'. Advancing the same global
		// counter used for cross/f2l/oll/pll (not each sub-step's own 0-3 position)
		// is what makes step_index a real, collision-free ordering across the whole
		// solve — with the local index instead, f2l_1..4 landed on 0-3 while cross/
		// oll/pll separately also used 0-3, so two unrelated steps could share a
		// step_index (e.g. cross=0 and f2l_1=0) and any query sorting by it put
		// F2L's sub-steps in the wrong place relative to OLL/PLL.
		F2L_SUB_STEPS.forEach((id) => {
			steps[id] = buildStep(transitionByPhase[id], stepIndex++, 'f2l', id);
		});
	}

	// Remaining last-layer steps, in the method's own order (cfop2 adds eo and cp).
	for (const id of def.steps) {
		if (id === 'cross' || F2L_SUB_STEPS.includes(id)) continue;
		steps[id] = buildStep(transitionByPhase[id], stepIndex++, null, id);
	}

	return steps;
}
