import { useMemo } from 'react';
import { SolveMethodStep } from '../../../../../server/schemas/SolveStepMethod.schema';
import { expandMove } from '../../../../util/expand_notation';

export interface FlattenedMove {
	move: string;
	stepIdx: number;
	stepName: string;
	moveInStepIdx: number; // Index in original step.turns — used for table highlighting
	relativeMs: number;
}

export interface FlattenedMovesResult {
	allMoves: FlattenedMove[];
	stepStartIndices: number[]; // stepStartIndices[stepIdx] = global flat-quarter index
	// tokenStartIndices[stepIdx][tokenIdx] = global index of this token's FIRST quarter
	// tokenQuarterCounts[stepIdx][tokenIdx] = quarter count for this token (1, 2, 3...)
	// Used in SolutionInfo table highlighting: does currentMoveIdx fall in this range?
	tokenStartIndices: number[][];
	tokenQuarterCounts: number[][];
}

/**
 * Converts method steps into a single flat moves list.
 * Used by both ReplayPlayer (TwistyPlayer moves) and SolutionInfo (table highlighting)
 * with the same data.
 *
 * Multi-quarter notation like U3/U4/U5 is expanded into same-direction single-quarter sequences
 * (U3 → U U U). This way TwistyPlayer plays each quarter with separate animation,
 * timing is properly aligned, and table highlighting preserves the original step.turns index
 * (moveInStepIdx).
 *
 * Per-move ms is calculated by dividing step total time by raw quarter count.
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
			// Expand each token to single-quarter sequence (U3 → [U,U,U]). Total quarter count:
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
