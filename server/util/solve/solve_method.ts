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
import { getPrettyMoves, TimedMove } from '../../../shared/util/solve/pretty_moves';
void cascadeQuartersForDisplay; // legacy import — yeni getPrettyMoves'a gecildi

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

	// Start state hesabi:
	// IDEAL: scramble'i solved cube'a uygula → gercek baslangic state. Kismi-cozum subsetleri
	// (333cfop>oll, >pll vb.) icin DOGRU sonuc bu yolla gelir; engine zaten cozulu fazlari
	// pre-populate eder ve OLL/PLL identification calisir.
	//
	// FALLBACK (legacy): scramble verilmediyse (eski admin script'leri) turns'u ters uygulayarak
	// hesapla — tam 333 solve'larinda calisir, kismi subsetlerde identification kirik kalir.
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
		// cstimer-grade HTM: engine her transition icin moveCount.htm hesabi yapiyor.
		// Ham moves.length yerine HTM kullanmak DB tutarli, TPS dogru.
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
		// Per-move timestamps tum F2L sub-phase'leri concat ederek getPrettyMoves'a ver
		const f2lTimed: TimedMove[] = f2lTransitions.flatMap((t) =>
			t.moves.map((turn, i) => ({ turn, timestamp: t.moveTimestamps?.[i] ?? 0 }))
		);
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
			turnsString: getPrettyMoves(f2lTimed),
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
 * Scramble string'ini solved cube'a uygulayarak gercek baslangic state'i hesaplar.
 * Bu kismi-cozum subsetleri icin de DOGRU sonuc verir (cube zaten yari cozulu gelir).
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
				// Gecersiz move: atla
			}
		}
		return cube.asString();
	} catch {
		return undefined;
	}
}

/**
 * LEGACY fallback: turns'u ters uygulayarak start state hesaplar. Sadece tam-cozum
 * (WCA 333) solve'larinda dogru calisir. Scramble erisilemediginde kullanilir.
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
