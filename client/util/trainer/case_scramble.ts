/**
 * Scrambles for trainer cases (3x3).
 *
 * The trainer used to set a case up with the drilled algorithm written backwards (the library's
 * `setup` was the shorter of a Kociemba solution and the inverse, and for nearly every case the
 * inverse won). Reading the setup backwards gave the solution away, so the case was never
 * recognised, only replayed. These setups are a solver's face turns instead: they reach the
 * same case, and nothing in them spells the algorithm.
 *
 * min2phase (cstimer's solver, already in the bundle for the smart cube) answers in a few ms;
 * its tables build on the first call (~60 ms).
 */
import type {KPattern} from 'cubing/kpuzzle';
import {Search, INVERSE_SOLUTION} from '../../../shared/scramble/lib/min2phase';
import {computeSetupInverse} from './algorithm_engine';
import {ensureKPuzzleReady, getKPuzzle, fixOrientation, patternToGANFacelets} from './pattern_utils';

/**
 * Face turns that take a cube in `from` to `target`, centers ignored and both orientation
 * fixed. '' when the cube is already there, null when the solver rejects the state.
 */
export function scrambleBetween(from: KPattern, target: KPattern): string | null {
	const start = fixOrientation(from).experimentalToTransformation();
	const end = fixOrientation(target).experimentalToTransformation();
	if (!start || !end) return null;
	// The state that, applied after `from`, gives `target`.
	const difference = start.invert().applyTransformation(end).toKPattern();
	// INVERSE_SOLUTION: the moves that build the state, not the ones that solve it.
	const result = new Search().solution(patternToGANFacelets(difference), 21, 1e9, 0, INVERSE_SOLUTION);
	if (result.startsWith('Error')) return null;
	return result.trim().split(/\s+/).filter(Boolean).join(' ');
}

/** The 24 ways to hold a cube. */
const ROTATIONS = ['', 'x', 'x2', "x'", 'z', "z'"].flatMap((base) =>
	['', 'y', 'y2', "y'"].map((y) => [base, y].filter(Boolean).join(' '))
);

function centersHome(pattern: KPattern): boolean {
	return pattern.patternData['CENTERS'].pieces.every((piece, i) => piece === i);
}

/**
 * The case an algorithm solves, held in the home orientation: the algorithm undone.
 *
 * An algorithm that turns the whole cube (y, d, r, M...) ends solved but rotated. Undoing it
 * and only then turning the cube home gives a state the algorithm does not solve (applying
 * it to a turned cube is not turning the cube after it). So its rotation comes first: undone
 * from there, the algorithm leaves the centers home.
 */
export async function caseTarget(algorithm: string): Promise<KPattern | null> {
	await ensureKPuzzleReady();
	const kpuzzle = getKPuzzle();
	if (!kpuzzle) return null;
	const inverse = await computeSetupInverse(algorithm);
	const solved = kpuzzle.defaultPattern();
	for (const rotation of ROTATIONS) {
		const candidate = solved.applyAlg(rotation ? `${rotation} ${inverse}` : inverse);
		if (centersHome(candidate)) return candidate;
	}
	return null;
}

/** A scramble that sets a 3x3 case up on a solved cube, or null when it cannot be made. */
export async function caseScramble(algorithm: string): Promise<string | null> {
	const target = await caseTarget(algorithm);
	const kpuzzle = getKPuzzle();
	if (!target || !kpuzzle) return null;
	try {
		return scrambleBetween(kpuzzle.defaultPattern(), target);
	} catch {
		return null;
	}
}
