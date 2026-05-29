/**
 * Backend wrapper — converts shared phase engine output to DB steps shape expected by Solve.resolver.ts.
 * Old 558-line phase detection logic was moved to shared/util/solve/phase_engine.ts;
 * this file is a thin adapter.
 *
 * Engine output (PhaseEngineResult) -> backend steps shape conversion:
 *   - transitions[] -> { cross, f2l, oll, pll, f2l_1..4 } object
 *   - Each step: turn_count, turns string, total_time (seconds), tps, parent_name,
 *     recognition_time, oll_case_key, pll_case_key, step_index, step_name
 *
 * createSolveMethodSteps (server/models/solve_method_step.ts) takes this shape, writes to DB.
 */

import { cascadeQuartersForDisplay, SmartTurn } from '../../../client/util/smart_scramble';
import { analyzePhases } from '../../../shared/util/solve/phase_engine';
import { CFOPPhase, SolveTurn, PhaseTransition } from '../../../shared/util/solve/types';
import { countHTM } from '../../../shared/util/solve/move_counter';
import { getPrettyMoves, TimedMove } from '../../../shared/util/solve/pretty_moves';
void cascadeQuartersForDisplay; // legacy import — migrated to getPrettyMoves

export function getSolveSteps(turns: SmartTurn[], scramble?: string) {
	try {
		return getSolveStepsInner(turns, scramble);
	} catch (e: any) {
		console.warn('[getSolveSteps] engine failed:', e?.message);
		return { cross: null, f2l: null, oll: null, pll: null };
	}
}

function getSolveStepsInner(turns: SmartTurn[], scramble?: string) {
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
		return { cross: null, f2l: null, oll: null, pll: null };
	}

	// Start state calculation:
	// IDEAL: apply scramble to solved cube -> actual starting state. For partial-solve subsets
	// (333cfop>oll, >pll etc.) this is the CORRECT approach; engine already pre-populates
	// solved phases and OLL/PLL identification works.
	//
	// FALLBACK (legacy): if scramble not provided (old admin scripts), calculate by reversing
	// turns — works for full 333 solves, identification breaks for partial subsets.
	let startState = scramble ? computeStartStateFromScramble(scramble) : undefined;
	if (!startState) {
		startState = computeStartStateFromSolvedEnd(engineTurns);
	}

	const result = analyzePhases(engineTurns, startState, {
		method: 'cfop',
		identifyOLL: true,
		identifyPLL: true,
	});

	const transitionByPhase: Partial<Record<CFOPPhase, PhaseTransition>> = {};
	for (const t of result.transitions) transitionByPhase[t.phase] = t;

	const steps: any = {
		cross: null,
		f2l: null,
		oll: null,
		pll: null,
	};

	const buildStep = (
		t: PhaseTransition | undefined,
		stepName: string,
		stepIndex: number,
		parentName: string | null,
		extra?: { ollCaseKey?: string; pllCaseKey?: string }
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
			...(extra || {}),
		};
	};

	const ollExtra = result.ollIdentified ? { ollCaseKey: result.ollIdentified.key } : undefined;
	const pllExtra = result.pllIdentified ? { pllCaseKey: result.pllIdentified.key } : undefined;

	steps.cross = buildStep(transitionByPhase.cross, 'cross', 0, null);

	// f2l parent + 4 sub-steps. Backend stores aggregated f2l "parent" step with 4 sub-steps.
	// Engine gives us 4 separate f2l_1..4 transitions. f2l parent is computed from aggregate
	// timing (f2l_4's timestamp for end, first slot's recognitionStart for start).
	const f2lTransitions = ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4']
		.map((p) => transitionByPhase[p as CFOPPhase])
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
			index: 1,
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
		f2lTransitions.forEach((t, idx) => {
			const stepName = `f2l_${idx + 1}`;
			(steps as any)[stepName] = buildStep(t, stepName, idx, 'f2l');
		});
	}

	steps.oll = buildStep(transitionByPhase.oll, 'oll', 2, null, ollExtra);
	steps.pll = buildStep(transitionByPhase.pll, 'pll', 3, null, pllExtra);

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
 * for full-solve (WCA 333) solves. Used when scramble is unavailable.
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
