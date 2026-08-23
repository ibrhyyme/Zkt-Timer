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
void cascadeQuartersForDisplay; // legacy import — migrated to getPrettyMoves

const F2L_SUB_STEPS = ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4'];

/**
 * @param method  Method id, or 'auto' to infer it from the solve itself.
 *                'auto' is the default for new clients: the user's setting can be
 *                stale (left on Roux while solving CFOP), whereas the states the
 *                cube passed through cannot lie.
 */
export function getSolveSteps(turns: SmartTurn[], scramble?: string, method: string = 'cfop') {
	try {
		return getSolveStepsInner(turns, scramble, method);
	} catch (e: any) {
		console.warn('[getSolveSteps] engine failed:', e?.message);
		return emptySteps('cfop');
	}
}

/** Result shape carries a key per step so createSolveMethodSteps can iterate it. */
function emptySteps(method: SolveMethod | string) {
	const out: any = { __method: method };
	for (const s of getMethod(method).steps) out[s] = null;
	if (method === 'cfop' || method === 'cfop2') out.f2l = null;
	return out;
}

function getSolveStepsInner(turns: SmartTurn[], scramble?: string, requested: string = 'cfop') {
	const engineTurns: SolveTurn[] = (turns || [])
		.filter((t) => t && typeof t.turn === 'string')
		.map((t) => ({
			turn: t.turn,
			timestamp: typeof (t as any).completedAt === 'number'
				? (t as any).completedAt
				: typeof (t as any).time === 'number'
					? (t as any).time
					: 0,
		}));

	if (engineTurns.length === 0) {
		return emptySteps('cfop');
	}

	// Start state calculation:
	// IDEAL: apply scramble to solved cube -> actual starting state. For partial-solve subsets
	// (333cfop>oll, >pll etc.) this is the CORRECT approach; engine already pre-populates
	// solved phases and case identification works.
	//
	// FALLBACK (legacy): if scramble not provided (old admin scripts), calculate by reversing
	// turns — works for full solves, identification breaks for partial subsets.
	let startState = scramble ? computeStartStateFromScramble(scramble) : undefined;
	if (!startState) {
		startState = computeStartStateFromSolvedEnd(engineTurns);
	}

	// Resolve 'auto' against the solve itself; an explicit choice is respected.
	const method: SolveMethod = requested === 'auto'
		? detectSolveMethod(engineTurns, startState).method
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
			turnsString: getPrettyMoves(timed),
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
			turnsString: getPrettyMoves(f2lTimed),
			turnCount: f2lHtm,
			time: f2lTotalSec,
		};

		// Sub-steps are written to DB with parent='f2l'.
		F2L_SUB_STEPS.forEach((id, idx) => {
			steps[id] = buildStep(transitionByPhase[id], idx, 'f2l', id);
		});
	}

	// Remaining last-layer steps, in the method's own order (cfop2 adds eo and cp).
	for (const id of def.steps) {
		if (id === 'cross' || F2L_SUB_STEPS.includes(id)) continue;
		steps[id] = buildStep(transitionByPhase[id], stepIndex++, null, id);
	}

	return steps;
}

/**
 * Apply scramble string to a solved cube to compute the actual starting state.
 * This gives the CORRECT result even for partial-solve subsets (cube already partially solved).
 */
function computeStartStateFromScramble(scramble: string): string | undefined {
	try {
		const Cube = require('cubejs');
		const cube = new Cube();
		const moves = (scramble || '').trim().split(/\s+/).filter(Boolean);
		for (const m of moves) {
			try {
				cube.move(m);
			} catch {
				// Invalid move: skip
			}
		}
		return cube.asString();
	} catch {
		return undefined;
	}
}

/**
 * LEGACY fallback: compute start state by reversing turns. Only works correctly
 * for full-solve solves. Used when scramble is unavailable.
 */
function computeStartStateFromSolvedEnd(turns: SolveTurn[]): string | undefined {
	try {
		// Lazy import — shared engine already imports Cube; use require here too.
		const Cube = require('cubejs');
		const cube = new Cube();
		for (let i = turns.length - 1; i >= 0; i--) {
			const m = turns[i].turn;
			let inv: string;
			if (m.endsWith("'")) inv = m.slice(0, -1);
			else if (m.endsWith('2')) inv = m;
			else inv = m + "'";
			try {
				cube.move(inv);
			} catch {
				// Skip
			}
		}
		return cube.asString();
	} catch {
		return undefined;
	}
}
