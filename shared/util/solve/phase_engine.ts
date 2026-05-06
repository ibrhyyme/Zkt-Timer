/**
 * Smart cube reconstruction engine — ana entry point.
 *
 * cstimer recons.js calcRecons() port + Zkt-Timer adaptasyonu:
 *   - Progress-based monoton seviye dususu ile faz tespiti
 *   - 6-axis rotation (cstimer'da CFOP icin n_axis=6)
 *   - Burst handling: ardisik fazlar tek hamlede atlanirsa skipped:true ile doldurulur
 *   - 1-move phase merge: cok kisa noisy phase'leri sonraki phase'e baglar
 *   - OLL/PLL case identification phase boundary'lerinde
 *   - Recognition vs execution time split (tsStart vs tsFirst)
 *
 * Engine SAF: turn dizisi + start state -> transitions array. Wrapper'lar bu output'u
 * frontend (LiveAnalysisResult) veya backend (DB steps) shape'ine donusturur.
 */

import Cube from 'cubejs';
import { SOLVED_FACELET } from './facelet_masks';
import {
	getCFOPProgress,
	progressToPhaseName,
	CROSS_AXIS_LABELS,
	getAxisRotationMove,
} from './cube_progress';
import { MoveCounter } from './move_counter';
import {
	SolveTurn,
	PhaseTransition,
	PhaseEngineResult,
	AnalyzeOptions,
	CFOPPhase,
	MoveCounts,
} from './types';
import { buildPrettyRecon } from './pretty_recon';
import { getMatchingOLLState, getMatchingPLLState } from './ll_identification';

const ROTATION_MOVES = new Set(['x', 'y', 'z', "x'", "y'", "z'", 'x2', 'y2', 'z2']);

function isEffectiveMove(move: string): boolean {
	const trimmed = (move || '').trim();
	if (!trimmed) return false;
	return !ROTATION_MOVES.has(trimmed);
}

const PHASE_ORDER: CFOPPhase[] = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

/**
 * Verili turn dizisi + start state'den CFOP phase analiz uretir.
 *
 * @param turns        SolveTurn[] (turn + ms timestamp)
 * @param startState   54-char facelet (scramble bittiginde cube state'i)
 * @param options      method (CFOP only su an), OLL/PLL identification toggle'lari
 */
export function analyzePhases(
	turns: SolveTurn[],
	startState?: string,
	options: AnalyzeOptions = {}
): PhaseEngineResult {
	const { identifyOLL = true, identifyPLL = true } = options;

	const cube = startState ? safeFromString(startState) : new Cube();

	const transitions: PhaseTransition[] = [];
	const totalCounter = new MoveCounter();

	// initial progress
	const initialState = cube.asString();
	const initial = getCFOPProgress(initialState);
	let progress = initial.progress;
	let crossAxisIndex: number | null = null;

	// Boundary-aware HTM: tek totalCounter, phase basinda snapshot, phase sonunda delta.
	// Boylece axis-mask state phase boundary'sinde kaybolmaz; cross sonu R + F2L_1 basi R
	// = R2 (1 HTM) olarak yakalanir. Garanti: SUM(transitions[i].moveCount.htm) === totalMoves.htm.
	let phaseStartSnapshot: MoveCounts = totalCounter.snapshot();
	let phaseMoves: string[] = [];
	let phaseMoveTimestamps: number[] = [];
	let phaseStartMs = turns.length > 0 ? turns[0].timestamp : 0;
	let firstMoveMs = Infinity;

	// State snapshot'lari OLL/PLL identification icin: phase boyunca state'leri sakla
	// "before-phase" state = onceki phase'in sonu = bu phase'in basi
	// OLL identifikasyonu icin: f2l_4 sonu state (= OLL phase'i basi)
	// PLL icin: oll sonu state (= PLL basi)
	const phaseEndStates: Partial<Record<CFOPPhase, string>> = {};
	const phaseEndAxis: Partial<Record<CFOPPhase, number>> = {};

	// Kismi-cozum subsetleri (333cfop>oll, >pll, >ll vb.) icin: scramble cube'u zaten bazi
	// fazlar cozulu halde getirir. Engine bu fazlar icin transition uretmez (curProg < progress
	// dususu olmaz). Identification chain'i (`beforeOLLState = phaseEndStates.f2l_4 || ...`)
	// bu durumda null kalir → OLL/PLL case key bulunamaz, vakalar/istatistikler kirik.
	//
	// Cozum: initial state'ten "kac faz zaten cozulu" inferle, o fazlarin phaseEndStates'ini
	// initialState ile pre-populate et. Cross/F2L/OLL atlanmissa identification chain'i dolu
	// kalir, kullanicinin yaptigi son fazlar (orn. PLL-only) icin case key dogru bulunur.
	//
	// progress 7 = full scramble (hicbir faz cozulu degil)
	// progress 6 = cross cozulu, f2l_1'den itibaren cozulecek
	// progress 1 = cross+f2l+oll cozulu, sadece pll cozulecek
	// progress 0 = cube zaten solved
	//
	// numCompleted = 7 - initial.progress  (clamped to PHASE_ORDER length).
	const numCompleted = Math.max(0, Math.min(PHASE_ORDER.length, 7 - initial.progress));
	for (let i = 0; i < numCompleted; i++) {
		phaseEndStates[PHASE_ORDER[i]] = initialState;
		phaseEndAxis[PHASE_ORDER[i]] = initial.axisIndex;
	}

	for (let i = 0; i < turns.length; i++) {
		const t = turns[i];
		const move = t.turn;
		try {
			cube.move(move);
		} catch {
			// Gecersiz move: atla.
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
		const cur = getCFOPProgress(stateNow);
		const curProg = cur.progress;

		if (curProg < progress) {
			// One ya da daha fazla phase tamamlandi (burst varsa whileloop)
			if (crossAxisIndex === null) {
				crossAxisIndex = cur.axisIndex;
			}

			// Ilk dusus: progress -> progress-1 phase'i tamamlandi
			const completedPhase = progressToPhaseName(progress - 1);
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

			// Burst: progress hala curProg'dan buyukse, ara phase'leri skipped:true ile doldur
			while (progress > curProg) {
				const skipPhase = progressToPhaseName(progress - 1);
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

			// Reset for next phase. phaseStartSnapshot zaten guncel (yukarida set edildi).
			// totalCounter state'ini KORUYORUZ — yeni MoveCounter yok, axis-mask phase'ler arasi akar.
			phaseMoves = [];
			phaseMoveTimestamps = [];
			phaseStartMs = t.timestamp;
			firstMoveMs = Infinity;
		}
	}

	// 1-move phase merge pass: HTM=1 olan phase'leri sonraki "real" phase'e baglar
	mergeOneMovePhases(transitions);

	// OLL/PLL identification
	let ollIdentified: PhaseEngineResult['ollIdentified'];
	let pllIdentified: PhaseEngineResult['pllIdentified'];
	if (identifyOLL && phaseEndStates.oll) {
		// OLL phase sonunda state = OLL solved (top face solid). Identification icin
		// OLL phase BASLAMADAN onceki state'i kullaniriz (= f2l_4 sonu).
		const beforeOLLState = phaseEndStates.f2l_4 || phaseEndStates.f2l_3 || phaseEndStates.f2l_2 || phaseEndStates.f2l_1 || phaseEndStates.cross;
		const axisForOLL = phaseEndAxis.oll ?? phaseEndAxis.f2l_4 ?? crossAxisIndex ?? 0;
		if (beforeOLLState) {
			const m = getMatchingOLLState(beforeOLLState, CROSS_AXIS_LABELS[axisForOLL]);
			if (m) ollIdentified = m;
		}
	}
	if (identifyPLL && phaseEndStates.pll) {
		const beforePLLState = phaseEndStates.oll;
		const axisForPLL = phaseEndAxis.pll ?? phaseEndAxis.oll ?? crossAxisIndex ?? 0;
		if (beforePLLState) {
			const m = getMatchingPLLState(beforePLLState, CROSS_AXIS_LABELS[axisForPLL]);
			if (m) pllIdentified = m;
		}
	}

	const totalTimeMs = turns.length > 0 ? turns[turns.length - 1].timestamp - turns[0].timestamp : 0;
	const finalProgressInfo = transitions.length > 0 ? progress : initial.progress;

	const result: PhaseEngineResult = {
		transitions: orderTransitions(transitions),
		totalMoves: totalCounter.snapshot(),
		totalTimeMs,
		ollIdentified,
		pllIdentified,
		prettyRecon: '',
		method: 'cfop',
		finalProgress: finalProgressInfo,
		crossFace: crossAxisIndex !== null ? CROSS_AXIS_LABELS[crossAxisIndex] : null,
	};

	result.prettyRecon = buildPrettyRecon(result);

	return result;
}

function safeFromString(facelet: string): any {
	try {
		return Cube.fromString(facelet);
	} catch {
		// Patolojik input — solved cube ile basla.
		return new Cube();
	}
}

/**
 * Transitions'i CFOP sirasina sirala. Engine zaten siralanmis ekler,
 * bu sadece guvence amacli.
 */
function orderTransitions(transitions: PhaseTransition[]): PhaseTransition[] {
	const order: Record<CFOPPhase, number> = {
		cross: 0,
		f2l_1: 1,
		f2l_2: 2,
		f2l_3: 3,
		f2l_4: 4,
		oll: 5,
		pll: 6,
	};
	return transitions.slice().sort((a, b) => order[a.phase] - order[b.phase]);
}

/**
 * cstimer recons.js:127-151 port. HTM=1 olan phase'leri bir sonraki real phase'e merge eder.
 * Genellikle "noise" hamleler (yanlislikla yapilan tek hamle, geri alinmis) bu sekilde temizlenir.
 *
 * Algoritma: HTM=1 phase bulunca, bir sonraki HTM>0 phase'i bul, ikisini birlestir.
 */
function mergeOneMovePhases(transitions: PhaseTransition[]) {
	for (let i = 0; i < transitions.length; i++) {
		const cur = transitions[i];
		if (cur.skipped) continue;
		if (cur.moveCount.htm !== 1) continue;

		// Sonraki real phase'i bul
		let j = i + 1;
		while (j < transitions.length && (transitions[j].skipped || transitions[j].moves.length === 0)) {
			j++;
		}
		if (j >= transitions.length) break;

		const next = transitions[j];

		// Mevcut phase'in hamlelerini next phase'in basina ekle (kronolojik sira)
		next.moves = cur.moves.concat(next.moves);

		// HTM toplami: cur ve next zaten boundary-aware delta'lar. Basit toplama,
		// SUM(transitions.htm) === totalCounter.htm invariant'ini korur.
		next.moveCount = addCounts(cur.moveCount, next.moveCount);

		// Recognition start'i kaydir: artik bu birlesik phase mevcut phase'in startindan basliyor
		next.recognitionStart = cur.recognitionStart;
		next.firstMoveTimestamp = Math.min(cur.firstMoveTimestamp, next.firstMoveTimestamp);

		// Mevcut phase'i degistir: sifir-hamle skipped'a donustur (gorunmez yap)
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

export function findTransition(result: PhaseEngineResult, phase: CFOPPhase): PhaseTransition | undefined {
	return result.transitions.find((t) => t.phase === phase);
}

export { PHASE_ORDER };
