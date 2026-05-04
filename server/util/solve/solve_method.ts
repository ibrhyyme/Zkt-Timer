/**
 * Backend wrapper — shared phase engine'i Solve.resolver.ts'in bekledigi DB steps shape'ine
 * cevirir. Eski 558-satirlik phase detection logic'i shared/util/solve/phase_engine.ts'e
 * tasindi; bu dosya ince adapter.
 *
 * Engine output (PhaseEngineResult) -> backend steps shape donusumu:
 *   - transitions[] -> { cross, f2l, oll, pll, f2l_1..4 } objesi
 *   - Her step: turn_count, turns string, total_time (saniye), tps, parent_name,
 *     recognition_time, oll_case_key, pll_case_key, step_index, step_name
 *
 * createSolveMethodSteps (server/models/solve_method_step.ts) bu shape'i alir, DB'ye yazar.
 */

import { cascadeQuartersForDisplay, SmartTurn } from '../../../client/util/smart_scramble';
import { analyzePhases } from '../../../shared/util/solve/phase_engine';
import { CFOPPhase, SolveTurn, PhaseTransition } from '../../../shared/util/solve/types';
import { countHTM } from '../../../shared/util/solve/move_counter';

export function getSolveSteps(turns: SmartTurn[]) {
	try {
		return getSolveStepsInner(turns);
	} catch (e: any) {
		console.warn('[getSolveSteps] engine failed:', e?.message);
		return { cross: null, f2l: null, oll: null, pll: null };
	}
}

function getSolveStepsInner(turns: SmartTurn[]) {
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

	// Backend'de start state yok — engine bunsuz da calisir (varsayilan: solved cube),
	// ama o zaman cross detection sallar. solve_method'un mevcut yaklasimi: turns
	// dizisini ters cevirip cube'u scrambled state'e getirmek (reverseTurns). Ama bu
	// dogru sirayla phase detection yapmaz; biz zaten engine'i kullanip turns'u sirayla
	// uygulariz.
	//
	// Onemli: backend solve_method end-state olarak SOLVED varsayar (turn dizisi cozulmus
	// bir solve'dur). Bu yuzden basla = ters-uygulanan turns + solved = orijinal scramble state.
	const startState = computeStartStateFromSolvedEnd(engineTurns);

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
		// cstimer-grade HTM: engine her transition icin moveCount.htm hesabi yapiyor.
		// Ham moves.length yerine HTM kullanmak DB tutarli, TPS dogru.
		const moveCount = t.moveCount.htm;
		const tps = moveCount && totalSec > 0 ? Math.floor((moveCount / totalSec) * 100) / 100 : 0;
		const turnsAsObjects: any[] = moves.map((m) => ({ turn: m }));
		return {
			index: stepIndex,
			parentName,
			skipped: t.skipped || moveCount <= 2,
			turns: turnsAsObjects,
			recognitionTime: recognitionSec,
			tps,
			turnsString: cascadeQuartersForDisplay(turnsAsObjects).join(' '),
			turnCount: moveCount,
			time: totalSec,
			...(extra || {}),
		};
	};

	const ollExtra = result.ollIdentified ? { ollCaseKey: result.ollIdentified.key } : undefined;
	const pllExtra = result.pllIdentified ? { pllCaseKey: result.pllIdentified.key } : undefined;

	steps.cross = buildStep(transitionByPhase.cross, 'cross', 0, null);

	// f2l parent + 4 sub-step. Backend'de toplu f2l "parent" step ile 4 sub-step sakliyor.
	// Engine bize 4 ayri f2l_1..4 transition veriyor. f2l parent ozellikle ihtiyac duyulan
	// alanlar icin (toplam sure) f2l_4'un timestamp'inden, ilk slot recognitionStart'indan
	// yola cikilarak agregat olusturulur.
	const f2lTransitions = ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4']
		.map((p) => transitionByPhase[p as CFOPPhase])
		.filter(Boolean) as PhaseTransition[];

	if (f2lTransitions.length > 0) {
		const first = f2lTransitions[0];
		const last = f2lTransitions[f2lTransitions.length - 1];
		const f2lMoves = f2lTransitions.flatMap((t) => t.moves);
		const f2lMovesAsObj = f2lMoves.map((m) => ({ turn: m }));
		const f2lTotalSec = Math.max(0, (last.timestamp - first.recognitionStart) / 1000);
		// cstimer-grade HTM: tum F2L hamlelerini tek seferde say (phase boundary'sinde
		// olusabilecek paralel duzlem cancel'lari yakalanir).
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
			turnsString: cascadeQuartersForDisplay(f2lMovesAsObj).join(' '),
			turnCount: f2lHtm,
			time: f2lTotalSec,
		};

		// Sub-step'ler parent='f2l' ile DB'ye yazilir.
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
 * Backend'de turns dizisi cozulmus solve oldugu icin end-state SOLVED'dir.
 * Start-state hesaplamak icin: solved cube'a turns'u TERS sirada UYGULA — bu cube'u
 * scrambled state'e getirir.
 */
function computeStartStateFromSolvedEnd(turns: SolveTurn[]): string | undefined {
	try {
		// Lazy import — shared engine already imports Cube; burada da kullanmak icin require.
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
