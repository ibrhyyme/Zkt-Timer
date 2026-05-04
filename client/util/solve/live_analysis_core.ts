/**
 * Frontend wrapper — shared phase engine'i LiveAnalysisOverlay/useLiveAnalysis API'sine
 * uyarlar. Eski 460-satirlik phase detection logic'i shared/util/solve/phase_engine.ts'e
 * tasindi; bu dosya ince bir adapter.
 *
 * Engine output (PhaseEngineResult) -> LiveAnalysisResult shape donusumu:
 *   - transitions[] -> steps map (cross, f2l_1..4, oll, pll)
 *   - timestamps -> seconds (relative to first turn)
 *   - ollIdentified/pllIdentified -> string adlari
 *   - currentPhase derivation: en son tamamlanan phase + 1 sonraki phase
 *   - recognition/execution split her phase icin (engine recognitionStart/firstMoveTimestamp'tan)
 *   - prettyRecon: cstimer formatinda annotated solve string (clipboard icin)
 *
 * useLiveAnalysis hook'u (client/util/hooks/useLiveAnalysis.ts) bu fonksiyonu cagiriyor;
 * shape eski alanlarda korundugu icin LiveAnalysisOverlay degismez.
 */

import { SmartTurn } from '../smart_scramble';
import { analyzePhases } from '../../../shared/util/solve/phase_engine';
import { CFOPPhase, SolveTurn, PhaseTransition } from '../../../shared/util/solve/types';

interface PhaseTimes {
	cross?: number;
	f2l_1?: number;
	f2l_2?: number;
	f2l_3?: number;
	f2l_4?: number;
	oll?: number;
	pll?: number;
}

export interface LiveAnalysisResult {
	steps: any;
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
		| 'Scramble/Inspection';
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
		// Yeni: recognition (tanima) ve execution (uygulama) bazli her phase icin saniye.
		// Engine PhaseTransition.recognitionStart vs firstMoveTimestamp vs timestamp uclusunden hesaplanir.
		recognition?: PhaseTimes;
		execution?: PhaseTimes;
	};
	// Yeni: cstimer-format annotated solve string. SolutionInfo'da "Detayli kopyala" butonu icin.
	prettyRecon?: string;
}

const EMPTY_RESULT: LiveAnalysisResult = {
	steps: {},
	currentPhase: 'Scramble/Inspection',
	crossSolved: false,
	f2lCount: 0,
	isSolved: false,
	scrambleError: false,
	times: {},
};

function toEngineTurns(turns: SmartTurn[]): SolveTurn[] {
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

export function analyzeCurrentState(turns: SmartTurn[], startState?: string): LiveAnalysisResult {
	if (!turns || turns.length === 0) {
		return { ...EMPTY_RESULT };
	}

	const engineTurns = toEngineTurns(turns);
	const result = analyzePhases(engineTurns, startState);

	const startMs = engineTurns[0]?.timestamp ?? 0;
	const lastMs = engineTurns[engineTurns.length - 1]?.timestamp ?? startMs;

	const transitionByPhase: Partial<Record<CFOPPhase, PhaseTransition>> = {};
	for (const t of result.transitions) {
		transitionByPhase[t.phase] = t;
	}

	const seconds = (ms: number | undefined) =>
		ms !== undefined && isFinite(ms) ? Math.max(0, (ms - startMs) / 1000) : undefined;

	const crossT = transitionByPhase.cross;
	const f2l1T = transitionByPhase.f2l_1;
	const f2l2T = transitionByPhase.f2l_2;
	const f2l3T = transitionByPhase.f2l_3;
	const f2l4T = transitionByPhase.f2l_4;
	const ollT = transitionByPhase.oll;
	const pllT = transitionByPhase.pll;

	const f2lDoneT = f2l4T;
	const f2lPairs: (number | undefined)[] = [
		seconds(f2l1T?.timestamp),
		seconds(f2l2T?.timestamp),
		seconds(f2l3T?.timestamp),
		seconds(f2l4T?.timestamp),
	];

	const f2lCount = [f2l1T, f2l2T, f2l3T, f2l4T].filter(Boolean).length;

	const totalSec = (lastMs - startMs) / 1000;

	let currentPhase: LiveAnalysisResult['currentPhase'] = 'Scramble/Inspection';
	if (pllT) currentPhase = 'Solved';
	else if (ollT) currentPhase = 'PLL';
	else if (f2l4T) currentPhase = 'OLL';
	else if (f2l3T) currentPhase = 'F2L (4)';
	else if (f2l2T) currentPhase = 'F2L (3)';
	else if (f2l1T) currentPhase = 'F2L (2)';
	else if (crossT) currentPhase = 'F2L (1)';
	else currentPhase = turns.length > 0 ? 'Cross' : 'Scramble/Inspection';

	// Wrapper steps shape: LiveAnalysisOverlay'e uyumlu (case, key, side, index alanlari).
	const steps: any = {};
	const fillStep = (
		key: string,
		t?: PhaseTransition,
		extra?: { case?: string; key?: string }
	) => {
		if (!t) return;
		steps[key] = {
			index: t.turnIndex,
			side: result.crossFace,
			case: extra?.case,
			key: extra?.key,
			skipped: t.skipped,
			recognitionMs: recognitionMs(t),
			executionMs: executionMs(t),
			moveCount: t.moveCount,
		};
	};

	fillStep('cross', crossT);
	fillStep('f2l_1', f2l1T);
	fillStep('f2l_2', f2l2T);
	fillStep('f2l_3', f2l3T);
	fillStep('f2l_4', f2l4T);
	fillStep('f2l', f2lDoneT);
	fillStep('oll', ollT, result.ollIdentified);
	fillStep('pll', pllT, result.pllIdentified);

	const recognition: PhaseTimes = {
		cross: crossT ? recognitionMs(crossT) / 1000 : undefined,
		f2l_1: f2l1T ? recognitionMs(f2l1T) / 1000 : undefined,
		f2l_2: f2l2T ? recognitionMs(f2l2T) / 1000 : undefined,
		f2l_3: f2l3T ? recognitionMs(f2l3T) / 1000 : undefined,
		f2l_4: f2l4T ? recognitionMs(f2l4T) / 1000 : undefined,
		oll: ollT ? recognitionMs(ollT) / 1000 : undefined,
		pll: pllT ? recognitionMs(pllT) / 1000 : undefined,
	};
	const execution: PhaseTimes = {
		cross: crossT ? executionMs(crossT) / 1000 : undefined,
		f2l_1: f2l1T ? executionMs(f2l1T) / 1000 : undefined,
		f2l_2: f2l2T ? executionMs(f2l2T) / 1000 : undefined,
		f2l_3: f2l3T ? executionMs(f2l3T) / 1000 : undefined,
		f2l_4: f2l4T ? executionMs(f2l4T) / 1000 : undefined,
		oll: ollT ? executionMs(ollT) / 1000 : undefined,
		pll: pllT ? executionMs(pllT) / 1000 : undefined,
	};

	return {
		steps,
		currentPhase,
		crossSolved: !!crossT,
		f2lCount,
		ollIdentified: result.ollIdentified?.case,
		pllIdentified: result.pllIdentified?.case,
		isSolved: !!pllT,
		scrambleError: false,
		times: {
			cross: seconds(crossT?.timestamp),
			f2l: seconds(f2lDoneT?.timestamp),
			f2l_pairs: f2lPairs,
			oll: seconds(ollT?.timestamp),
			pll: seconds(pllT?.timestamp),
			total: totalSec > 0 ? totalSec : undefined,
			recognition,
			execution,
		},
		prettyRecon: result.prettyRecon,
	};
}
