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
 *
 * Which method runs is decided by the caller; the two settings that describe
 * it are combined by resolveAnalysisMethod().
 */

import { SmartTurn } from '../smart_scramble';
import { analyzePhases } from '../../../shared/util/solve/phase_engine';
import { getMethod } from '../../../shared/util/solve/methods';
import { SolveMethod, SolvePhase, PhaseTransition, PhaseEngineResult as EngineResult } from '../../../shared/util/solve/types';
import { caseNameFromKey } from '../../../shared/util/solve/ll_identification';

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

/**
 * The ladder the overlay actually draws. On a phone the two-look ladder (cffffoopp)
 * wraps to eleven lines, so it is drawn as cffffop there. The post-solve analysis has
 * to run with this same mode: computed as cfop2 but drawn as a cfop ladder, a 1-look
 * OLL or PLL showed up as SKIP rows with no case name.
 */
export function effectiveAnalysisMode(mode: string | null | undefined, mobile: boolean): string {
	const resolved = mode || 'cffffop';
	return mobile && resolved === 'cffffoopp' ? 'cffffop' : resolved;
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

export function toEngineTurns(turns: SmartTurn[]) {
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
	return buildLiveAnalysisResult(result, method, turns);
}

/**
 * PhaseEngineResult -> LiveAnalysisResult shape conversion, split out from
 * analyzeCurrentState so an incremental caller (useLiveAnalysis) can hand in a
 * result it derived without re-running analyzePhases from scratch.
 */
export function buildLiveAnalysisResult(
	result: EngineResult,
	method: SolveMethod,
	turns: SmartTurn[]
): LiveAnalysisResult {
	const engineTurns = toEngineTurns(turns);
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

	for (const id of def.steps) {
		const t = transitionByPhase[id];
		if (!t) continue;

		const endSec = seconds(t.timestamp);
		stepTimes[id] = endSec;
		stepSplits[id] =
			endSec !== undefined ? Math.max(0, endSec - (prevEndSec ?? 0)) : undefined;
		prevEndSec = endSec ?? prevEndSec;

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

	const { currentStep, currentPhase, isSolved } = ladderPosition(
		method,
		(id) => !!transitionByPhase[id],
		turns.length > 0
	);

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
		isSolved,
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
	};
}

/**
 * Where a ladder stands, given which of the method's steps are done: the step being worked
 * on, the phase label the overlay keys its rows on, and whether the solve is finished.
 * One rule for the live result and for a finished solve's stored rows.
 */
function ladderPosition(
	method: SolveMethod,
	done: (id: SolvePhase) => boolean,
	started: boolean
): Pick<LiveAnalysisResult, 'currentStep' | 'currentPhase' | 'isSolved'> {
	const def = getMethod(method);
	let lastCompleted: SolvePhase | null = null;
	for (const id of def.steps) {
		if (done(id)) lastCompleted = id;
	}
	const allDone = lastCompleted === def.steps[def.steps.length - 1];
	const nextIdx = lastCompleted ? def.steps.indexOf(lastCompleted) + 1 : 0;
	const currentStep = allDone ? null : def.steps[nextIdx] ?? def.steps[0];

	if (method === 'cfop' || method === 'cfop2') {
		let currentPhase: LiveAnalysisResult['currentPhase'];
		if (done('pll')) currentPhase = 'Solved';
		else if (done('oll')) currentPhase = 'PLL';
		else if (done('f2l_4')) currentPhase = 'OLL';
		else if (done('f2l_3')) currentPhase = 'F2L (4)';
		else if (done('f2l_2')) currentPhase = 'F2L (3)';
		else if (done('f2l_1')) currentPhase = 'F2L (2)';
		else if (done('cross')) currentPhase = 'F2L (1)';
		else currentPhase = started ? 'Cross' : 'Scramble/Inspection';
		return { currentStep, currentPhase, isSolved: done('pll') };
	}

	return {
		currentStep,
		currentPhase: allDone
			? 'Solved'
			: currentStep
				? STEP_LABELS[currentStep] || currentStep
				: 'Scramble/Inspection',
		isSolved: allDone,
	};
}

/** A stored step row, as far as the ladder reads it. */
export interface StoredStepRow {
	step_name: string;
	total_time?: number | null;
	recognition_time?: number | null;
	turn_count?: number | null;
	skipped?: boolean | null;
	case_key?: string | null;
	case_set?: string | null;
	oll_case_key?: string | null;
	pll_case_key?: string | null;
	method_name?: string | null;
}

/**
 * The finished ladder from a solve's stored breakdown: the rows the solve card, the phase
 * analysis module and the session table read. A finished solve used to be drawn from a
 * second analysis of its own, so the ladder could show a CFOP breakdown of a solve every
 * other place showed as Roux ('auto' is resolved when the rows are made, not live).
 *
 * A row holds its step's own duration and each step starts where the previous one ended,
 * so a step's end is the running sum: the same seconds the engine's timestamps give.
 * Null when there is nothing to draw.
 */
export function liveResultFromStepRows(rows: StoredStepRow[] | null | undefined): LiveAnalysisResult | null {
	if (!rows || !rows.length) return null;

	const method = (rows.find((r) => r.method_name)?.method_name || 'cfop') as SolveMethod;
	const def = getMethod(method);
	const byStep: Record<string, StoredStepRow> = {};
	for (const row of rows) byStep[row.step_name] = row;

	const steps: any = {};
	const stepTimes: PhaseTimes = {};
	const stepSplits: PhaseTimes = {};
	const stepCases: Record<string, string> = {};
	const recognition: PhaseTimes = {};
	const execution: PhaseTimes = {};
	let ollIdentified: string | undefined;
	let pllIdentified: string | undefined;
	let elapsed = 0;

	for (const id of def.steps) {
		const row = byStep[id];
		if (!row) continue;

		const split = Math.max(0, row.total_time || 0);
		const rec = Math.min(split, Math.max(0, row.recognition_time || 0));
		elapsed += split;
		stepTimes[id] = elapsed;
		stepSplits[id] = split;
		recognition[id] = rec;
		execution[id] = split - rec;

		// Older rows name the case only in the legacy OLL/PLL columns.
		const set = row.case_set || (row.oll_case_key ? 'oll' : row.pll_case_key ? 'pll' : null);
		const key = row.case_key || row.oll_case_key || row.pll_case_key || undefined;
		const name = caseNameFromKey(set, key);
		if (name) stepCases[id] = name;
		if (name && set === 'oll') ollIdentified = name;
		if (name && set === 'pll') pllIdentified = name;

		steps[id] = {
			case: name,
			key,
			skipped: !!row.skipped,
			recognitionMs: rec * 1000,
			executionMs: (split - rec) * 1000,
			// Rows keep the HTM count only, which is the one the ladder draws.
			moveCount: { htm: row.turn_count || 0 },
		};
	}

	if (!Object.keys(steps).length) return null;
	if (steps.f2l_4) steps.f2l = steps.f2l_4;

	const { currentStep, currentPhase, isSolved } = ladderPosition(method, (id) => !!byStep[id], true);
	const f2lPairs = [stepTimes.f2l_1, stepTimes.f2l_2, stepTimes.f2l_3, stepTimes.f2l_4];

	return {
		steps,
		method,
		stepOrder: def.steps,
		stepTimes,
		stepSplits,
		stepCases,
		currentStep,
		currentPhase,
		crossSolved: !!byStep.cross,
		f2lCount: f2lPairs.filter((t) => t != null).length,
		ollIdentified,
		pllIdentified,
		isSolved,
		scrambleError: false,
		times: {
			cross: stepTimes.cross,
			f2l: stepTimes.f2l_4,
			f2l_pairs: f2lPairs,
			oll: stepTimes.oll,
			oll_eo: stepTimes.eo,
			pll: stepTimes.pll,
			pll_cp: stepTimes.cp,
			total: elapsed > 0 ? elapsed : undefined,
			recognition,
			execution,
		},
	};
}
