import { fetchSolve } from '../../../db/solves/query';
import { togglePlusTwoSolveDb } from '../../../db/solves/operations';

// The save runs a few frames after the stop and can take longer than the engine's wait on a
// busy page, so a solve not on file yet gets one more look.
const SAVE_RETRY_MS = 1000;

/**
 * +2 on a solve the engine found overturned, through the same path as the +2 button, so the
 * button also takes it back. A solve that is already +2 or DNF stays as it is.
 */
export function applyOverturnPenalty(solveId: string, onApplied: () => void, retry: boolean = true): void {
	const solve = fetchSolve(solveId);
	if (!solve) {
		if (retry) setTimeout(() => applyOverturnPenalty(solveId, onApplied, false), SAVE_RETRY_MS);
		return;
	}
	if (solve.dnf || solve.plus_two) return;

	togglePlusTwoSolveDb(solve);
	onApplied();
}
