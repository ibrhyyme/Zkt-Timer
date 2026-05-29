/**
 * Scramble uretimi + cozum. Mevcut altyapiyi (scramble worker + cross solver worker)
 * yapistirir; yeni motor yok.
 *
 * rotation: kullanicinin tutus acisi (CUBE_ORIENTATIONS). scramble'a prepend edilir →
 * solver rotated state'i cozer, alt yuz (D) rotation'a gore degisir. selectSolution hep
 * D secer (rotation alt yuzu belirledi).
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
	// Slot'u rotation'a gore remap et: twisty rotation'i gorsel uyguluyor ama solver
	// raw cozuyor (slot mutlak) → kullanicinin gordugu slot ile hizalamak icin remap.
	const solverSlot = xcrossSlot !== undefined ? remapSlot(xcrossSlot, rotation) : undefined;
	const orientation = type === 'xcross' && solverSlot !== undefined ? String(solverSlot) : undefined;
	const results = await solveCrossAsync(scramble, type, orientation);
	return {scramble, results};
}

/**
 * Faz 3 hedef-uzunluk (getEasyCross full pruning) — TAM targetLength-move cross/xcross.
 * Rotation seciliyse getEasy D-cross'u bozar → null don (caller uret-ve-ele'ye duser).
 * Sadece cross/xcross + 1-9 + rotation yok.
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
