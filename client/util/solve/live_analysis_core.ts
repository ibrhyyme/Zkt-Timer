/**
 * Frontend wrapper — adapts the shared phase engine to the LiveAnalysisOverlay /
 * useLiveAnalysis API.
 *
 * Engine output (PhaseEngineResult) -> LiveAnalysisResult shape conversion:
 *   - transitions[] -> generic per-step map (steps, stepTimes, stepSplits)
 *   - CFOP-shaped aliases (times.cross, times.f2l, f2l_pairs, ...) kept so the
 *     existing CFOP overlay keeps working unchanged
 *   - timestamps -> seconds (relative to first turn)
 *   - currentPhase derivation: last completed step + 1 next step
 *   - recognition/execution split per phase
 *   - prettyRecon: cstimer format annotated solve string (for clipboard)
 *
 * Which method runs is decided by the caller; the two settings that describe
 * it are combined by resolveAnalysisMethod().
 */

import { SmartTurn } from '../smart_scramble';
import { analyzePhases } from '../../../shared/util/solve/phase_engine';
import { getMethod } from '../../../shared/util/solve/methods';
import { SolveMethod, SolvePhase, PhaseTransition } from '../../../shared/util/solve/types';

type PhaseTimes = Record<string, number | undefined>;

export interface LiveAnalysisStep {
	id: SolvePhase;
	index: number;
	side?: string | null;
	case?: string;
	key?: string;
	skipped: boolean;
	recognitionMs: number;
	executionMs: number;
	moveCount: { htm: number; obtm: number; etm: number; stm: number };
}

export interface LiveAnalysisResult {
	steps: any;
	/** Method that produced this result. */
	method: SolveMethod;
	/** The method's step ids, in execution order. */
	stepOrder: SolvePhase[];
	/** Absolute seconds (from solve start) at which each step completed. */
	stepTimes: PhaseTimes;
	/** Duration in seconds of each step on its own. */
	stepSplits: PhaseTimes;
	/** Recognized case name per step id, when the method identifies one. */
	stepCases: Record<string, string>;
	/** Id of the step currently being worked on, or null when solved/not started. */
	currentStep: SolvePhase | null;
	currentPhase:
		| 'Cross'
		| 'F2L'
		| 'F2L (1)'
		| 'F2L (2)'
		| 'F2L (3)'
		| 'F2L (4)'
		| 'OLL'
		| 'PLL'
		| 'Solved'
		| 'Scramble/Inspection'
		| string;
	crossSolved: boolean;
	f2lCount: number;
	ollIdentified?: string;
	pllIdentified?: string;
	isSolved: boolean;
	lastStepTime?: number;
	scrambleError?: boolean;
	times: {
		cross?: number;
		f2l?: number;
		f2l_pairs?: (number | undefined)[];
		oll?: number;
		oll_eo?: number;
		pll?: number;
		pll_cp?: number;
		total?: number;
		recognition?: PhaseTimes;
		execution?: PhaseTimes;
	};
	prettyRecon?: string;
}

const EMPTY_RESULT: LiveAnalysisResult = {
	steps: {},
	method: 'cfop',
	stepOrder: [],
	stepTimes: {},
	stepSplits: {},
	stepCases: {},
	currentStep: null,
	currentPhase: 'Scramble/Inspection',
	crossSolved: false,
	f2lCount: 0,
	isSolved: false,
	scrambleError: false,
	times: {},
};

/**
 * Resolves the engine method from the two settings that describe it.
 *
 *   smart_cube_method        — which method the user solves with (cfop|roux|zz).
 *                              Written onto every solve, so it lives in main settings.
 *   smart_cube_analysis_mode — how finely to display it. A view preference only.
 *
 * The two were a single setting before, mixing an identity with a display option.
 * Legacy values are still accepted here so nobody loses their configuration:
 * a stored mode of 'roux'/'zz' is read as that method.
 *
 * Only CFOP has display granularity; its two-look variant needs a different
 * progress ladder, which is why 'cffffoopp' maps to the cfop2 engine method.
 */
export function resolveAnalysisMethod(
	method?: string | null,
	mode?: string | null
): SolveMethod {
	// Legacy single-setting values.
	if (mode === 'roux' || mode === 'zz') return mode;

	if (method === 'roux' || method === 'zz') return method;
	// 'auto' is resolved from the solve itself when it is saved. While a solve is
	// still in progress there is nothing to detect from, so the live overlay shows
	// the CFOP ladder and the stored breakdown is corrected on save.
	if (mode === 'cffffoopp') return 'cfop2';
	return 'cfop';
}

/** Display labels per step id, shared by every method. */
export const STEP_LABELS: Record<string, string> = {
	cross: 'Cross',
	f2l_1: 'F2L (1)',
	f2l_2: 'F2L (2)',
	f2l_3: 'F2L (3)',
	f2l_4: 'F2L (4)',
	oll: 'OLL',
	pll: 'PLL',
	eo: 'EO',
	cp: 'CP',
	fb: 'FB',
	sb: 'SB',
	cmll: 'CMLL',
	lse: 'LSE',
	eoline: 'EOLine',
	block_1: 'Block 1',
	block_2: 'Block 2',
	ll: 'LL',
};

function toEngineTurns(turns: SmartTurn[]) {
	return turns
		.filter((t) => t && typeof t.turn === 'string')
		.map((t) => ({
			turn: t.turn,
			timestamp: typeof (t as any).time === 'number' ? (t as any).time : 0,
		}));
}

function recognitionMs(t: PhaseTransition): number {
	const first = isFinite(t.firstMoveTimestamp) ? t.firstMoveTimestamp : t.timestamp;
	return Math.max(0, first - t.recognitionStart);
}

function executionMs(t: PhaseTransition): number {
	const first = isFinite(t.firstMoveTimestamp) ? t.firstMoveTimestamp : t.timestamp;
	return Math.max(0, t.timestamp - first);
}

/**
 * Development hook: exposes the analyser on `window.__zktAnalyze` so a solve can
 * be replayed from the console without a physical cube attached. Read-only —
 * it computes from the turns it is handed and touches no application state.
 * Mirrors the existing `window.__SMART_DEBUG__` convention.
 */
if (typeof window !== 'undefined') {
	(window as any).__zktAnalyze = (
		turns: SmartTurn[],
		startState?: string,
		method: SolveMethod = 'cfop'
	) => analyzeCurrentState(turns, startState, method);
}

export function analyzeCurrentState(
	turns: SmartTurn[],
	startState?: string,
	method: SolveMethod = 'cfop'
): LiveAnalysisResult {
	if (!turns || turns.length === 0) {
		return { ...EMPTY_RESULT, method, stepOrder: getMethod(method).steps };
	}

	const engineTurns = toEngineTurns(turns);
	const result = analyzePhases(engineTurns, startState, { method });
	const def = getMethod(method);

	const startMs = engineTurns[0]?.timestamp ?? 0;
	const lastMs = engineTurns[engineTurns.length - 1]?.timestamp ?? startMs;

	const transitionByPhase: Partial<Record<SolvePhase, PhaseTransition>> = {};
	for (const t of result.transitions) {
		transitionByPhase[t.phase] = t;
	}

	const seconds = (ms: number | undefined) =>
		ms !== undefined && isFinite(ms) ? Math.max(0, (ms - startMs) / 1000) : undefined;

	// ---- Generic per-step data (drives non-CFOP overlays) ----
	const steps: any = {};
	const stepTimes: PhaseTimes = {};
	const stepSplits: PhaseTimes = {};
	const stepCases: Record<string, string> = {};
	const recognition: PhaseTimes = {};
	const execution: PhaseTimes = {};

	const caseByPhase: Record<string, string> = {};
	for (const c of result.cases || []) caseByPhase[c.phase] = c.case;

	let prevEndSec: number | undefined;
	let lastCompleted: SolvePhase | null = null;

	for (const id of def.steps) {
		const t = transitionByPhase[id];
		if (!t) continue;

		const endSec = seconds(t.timestamp);
		stepTimes[id] = endSec;
		stepSplits[id] =
			endSec !== undefined ? Math.max(0, endSec - (prevEndSec ?? 0)) : undefined;
		prevEndSec = endSec ?? prevEndSec;
		lastCompleted = id;

		recognition[id] = recognitionMs(t) / 1000;
		execution[id] = executionMs(t) / 1000;

		if (caseByPhase[id]) stepCases[id] = caseByPhase[id];

		steps[id] = {
			index: t.turnIndex,
			side: result.crossFace,
			case: caseByPhase[id],
			key: (result.cases || []).find((c) => c.phase === id)?.key,
			skipped: t.skipped,
			recognitionMs: recognitionMs(t),
			executionMs: executionMs(t),
			moveCount: t.moveCount,
		};
	}

	const isSolved = lastCompleted === def.steps[def.steps.length - 1];
	const nextIdx = lastCompleted ? def.steps.indexOf(lastCompleted) + 1 : 0;
	const currentStep = isSolved ? null : def.steps[nextIdx] ?? def.steps[0];

	// ---- CFOP-shaped aliases ----
	// The CFOP overlay predates the generic map and reads these directly. They are
	// only meaningful for the CFOP ladders; other methods leave them undefined.
	const crossT = transitionByPhase.cross;
	const f2l1T = transitionByPhase.f2l_1;
	const f2l2T = transitionByPhase.f2l_2;
	const f2l3T = transitionByPhase.f2l_3;
	const f2l4T = transitionByPhase.f2l_4;
	const ollT = transitionByPhase.oll;
	const pllT = transitionByPhase.pll;
	const eoT = transitionByPhase.eo;
	const cpT = transitionByPhase.cp;

	if (f2l4T) steps.f2l = steps.f2l_4;

	const f2lPairs: (number | undefined)[] = [
		seconds(f2l1T?.timestamp),
		seconds(f2l2T?.timestamp),
		seconds(f2l3T?.timestamp),
		seconds(f2l4T?.timestamp),
	];
	const f2lCount = [f2l1T, f2l2T, f2l3T, f2l4T].filter(Boolean).length;
	const totalSec = (lastMs - startMs) / 1000;

	let currentPhase: LiveAnalysisResult['currentPhase'];
	if (method === 'cfop' || method === 'cfop2') {
		if (pllT) currentPhase = 'Solved';
		else if (ollT) currentPhase = 'PLL';
		else if (f2l4T) currentPhase = 'OLL';
		else if (f2l3T) currentPhase = 'F2L (4)';
		else if (f2l2T) currentPhase = 'F2L (3)';
		else if (f2l1T) currentPhase = 'F2L (2)';
		else if (crossT) currentPhase = 'F2L (1)';
		else currentPhase = turns.length > 0 ? 'Cross' : 'Scramble/Inspection';
	} else {
		currentPhase = isSolved
			? 'Solved'
			: currentStep
				? STEP_LABELS[currentStep] || currentStep
				: 'Scramble/Inspection';
	}

	return {
		steps,
		method,
		stepOrder: def.steps,
		stepTimes,
		stepSplits,
		stepCases,
		currentStep,
		currentPhase,
		crossSolved: !!crossT,
		f2lCount,
		ollIdentified: result.ollIdentified?.case,
		pllIdentified: result.pllIdentified?.case,
		isSolved: method === 'cfop' || method === 'cfop2' ? !!pllT : isSolved,
		scrambleError: false,
		times: {
			cross: seconds(crossT?.timestamp),
			f2l: seconds(f2l4T?.timestamp),
			f2l_pairs: f2lPairs,
			oll: seconds(ollT?.timestamp),
			// Two-look ladder: these were declared but never populated before, which
			// left the "full detail" overlay rendering empty EO/CP rows.
			oll_eo: seconds(eoT?.timestamp),
			pll: seconds(pllT?.timestamp),
			pll_cp: seconds(cpT?.timestamp),
			total: totalSec > 0 ? totalSec : undefined,
			recognition,
			execution,
		},
		prettyRecon: result.prettyRecon,
	};
}
