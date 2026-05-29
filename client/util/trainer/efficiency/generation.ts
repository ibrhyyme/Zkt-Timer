/**
 * Scramble generation + solving. Glues together existing infrastructure (scramble worker + cross solver worker);
 * no new engine.
 *
 * rotation: user's cube orientation angle (CUBE_ORIENTATIONS). Prepended to scramble →
 * solver solves rotated state, bottom face (D) changes according to rotation. selectSolution always
 * picks D (rotation determined bottom face).
 */
import {getNewScrambleAsync} from '../../../components/timer/helpers/scramble';
import {solveCrossAsync, getEasyCrossAsync} from '../../cross-solver/worker-manager';
import {scrambleFromCrossMaskAsync} from '../../scramble-worker-manager';
import {remapSlot} from './rotation_slot_map';
import type {SolverResult} from '../../cross-solver/types';
import type {EfficiencyType} from '../../../components/trainer/efficiency/types';

export async function generateAndSolve(
	type: EfficiencyType,
	xcrossSlot?: number,
	rotation = ''
): Promise<{scramble: string; results: SolverResult[]}> {
	const raw = await getNewScrambleAsync('333');
	const scramble = rotation ? `${rotation} ${raw}`.replace(/\s+/g, ' ').trim() : raw;
	// Remap slot according to rotation: twisty applies rotation visually but solver
	// solves raw (slot absolute) → remap to align with what user sees.
	const solverSlot = xcrossSlot !== undefined ? remapSlot(xcrossSlot, rotation) : undefined;
	const orientation = type === 'xcross' && solverSlot !== undefined ? String(solverSlot) : undefined;
	const results = await solveCrossAsync(scramble, type, orientation);
	return {scramble, results};
}

/**
 * Phase 3 target-length (getEasyCross full pruning) — EXACT targetLength-move cross/xcross.
 * If rotation selected, getEasy breaks D-cross → return null (caller falls back to generate-and-retry).
 * Only cross/xcross + 1-9 + no rotation.
 */
export async function generateEasyScramble(
	type: EfficiencyType,
	targetLength: number,
	xcrossSlot?: number,
	rotation = ''
): Promise<{scramble: string; results: SolverResult[]} | null> {
	if (rotation) return null;
	if ((type !== 'cross' && type !== 'xcross') || targetLength < 1 || targetLength > 9) {
		return null;
	}
	const mask = await getEasyCrossAsync(targetLength * 10 + targetLength, type);
	if (!mask) return null;
	const scramble = await scrambleFromCrossMaskAsync(mask, type === 'xcross');
	if (!scramble) return null;
	const orientation = type === 'xcross' && xcrossSlot !== undefined ? String(xcrossSlot) : undefined;
	const results = await solveCrossAsync(scramble, type, orientation);
	return {scramble, results};
}
