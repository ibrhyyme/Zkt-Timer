import { useMemo } from 'react';
import { SolveMethodStep } from '../../../../../server/schemas/SolveStepMethod.schema';
import { expandMove } from '../../../../util/expand_notation';

export interface FlattenedMove {
	move: string;
	stepIdx: number;
	stepName: string;
	moveInStepIdx: number; // Orijinal step.turns icindeki index — tablo highlight icin
	relativeMs: number;
}

export interface FlattenedMovesResult {
	allMoves: FlattenedMove[];
	stepStartIndices: number[]; // stepStartIndices[stepIdx] = global flat-quarter index'i
	// tokenStartIndices[stepIdx][tokenIdx] = bu token'in ILK quarter'inin global index'i
	// tokenQuarterCounts[stepIdx][tokenIdx] = bu token'in quarter sayisi (1, 2, 3...)
	// SolutionInfo tablo highlight'inda kullaniliyor: currentMoveIdx range'ine duser mi?
	tokenStartIndices: number[][];
	tokenQuarterCounts: number[][];
}

/**
 * Method step'leri tek bir flat hamle listesine cevirir.
 * Hem ReplayPlayer (TwistyPlayer hamleleri) hem SolutionInfo (tablo highlight)
 * tarafindan ayni veriyle calisilir.
 *
 * U3/U4/U5 gibi cok-quarter notation'lar ayni-yonlu tek-quarter dizisine acilir
 * (U3 → U U U). Bu sayede TwistyPlayer her quarter'i ayri animasyonla oynatir,
 * timing dogru hizalanir, ve tablo highlight'inda orijinal step.turns index'i
 * (moveInStepIdx) korunur.
 *
 * Per-hamle ms'i step toplam suresini ham quarter sayisina bolerek hesaplar.
 */
export function useFlattenedMoves(steps: SolveMethodStep[]): FlattenedMovesResult {
	return useMemo(() => {
		const allMoves: FlattenedMove[] = [];
		const stepStartIndices: number[] = [];
		const tokenStartIndices: number[][] = [];
		const tokenQuarterCounts: number[][] = [];
		let cumulativeMs = 0;

		steps.forEach((step, sIdx) => {
			const tokens = (step.turns || '').split(' ').filter(Boolean);
			// Her token'i tek-quarter dizisine ac (U3 → [U,U,U]). Total quarter sayisi:
			const expandedPerToken = tokens.map((t) => expandMove(t).split(' ').filter(Boolean));
			const totalQuarters = expandedPerToken.reduce((s, arr) => s + arr.length, 0);
			const stepMs = (step.total_time || 0) * 1000;
			const msPerQuarter = totalQuarters > 0 ? stepMs / totalQuarters : 0;

			stepStartIndices[sIdx] = allMoves.length;
			tokenStartIndices[sIdx] = [];
			tokenQuarterCounts[sIdx] = [];

			let qIdxInStep = 0;
			tokens.forEach((_, mIdx) => {
				const quarters = expandedPerToken[mIdx];
				tokenStartIndices[sIdx][mIdx] = allMoves.length;
				tokenQuarterCounts[sIdx][mIdx] = quarters.length;
				quarters.forEach((singleQuarter) => {
					allMoves.push({
						move: singleQuarter,
						stepIdx: sIdx,
						stepName: step.step_name,
						moveInStepIdx: mIdx,
						relativeMs: cumulativeMs + qIdxInStep * msPerQuarter,
					});
					qIdxInStep += 1;
				});
			});

			cumulativeMs += stepMs;
		});

		return { allMoves, stepStartIndices, tokenStartIndices, tokenQuarterCounts };
	}, [steps]);
}
