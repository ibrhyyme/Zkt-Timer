import { SmartTurn } from '../../../util/smart_scramble';
import { CubeTracker } from '../../../util/smart_cube/tracker';
import { computeTargetFacelets } from '../../../util/smart_cube/solve_engine';

/**
 * Is the scramble already done? A state comparison (simulate the turns, compare the
 * resulting facelets against the target), not a move-list match — immune to move order,
 * half-finished double moves and commuting reorderings, the same way SmartSolveEngine's
 * own scramble-completion check works.
 */
export function preflightChecks(smartTurns: SmartTurn[], scramble: string, turnOffset: number = 0): boolean {
	const target = computeTargetFacelets(scramble);
	if (!target) return false;

	const relevantTurns = turnOffset > 0 ? smartTurns.slice(turnOffset) : smartTurns;
	const tracker = new CubeTracker();
	tracker.applyNew(relevantTurns);
	return tracker.matches(target);
}
