/**
 * case_drawing: what our cube engine needs to draw a trainer case, shared by the case pictures
 * (common/case_snapshot.ts) and the live case view (common/CaseCube.tsx), so both show the
 * same case with the same stickering.
 *
 * Only cubes (2x2, 3x3, 4x4) with an algorithm the engine can read (case_cube.ts); everything
 * else is drawn by cubing.js, so callers check engineDrawsCase first.
 */
import {getOrientationRotation, getPuzzleType, getStickering} from './algorithm_engine';
import {getRemappedMask} from './stickering_remap';
import {algTurns, capLooksFromMask, caseTurns} from './case_cube';
import type {CubeFace} from '../../components/trainer/types';
import type {PuzzleSize} from '../../components/timer/smart_cube/cube_view/render/cube_model';
import type {CapLooks} from '../../components/timer/smart_cube/cube_view/render/cube_renderer';

export interface CaseToDraw {
	category: string;
	algorithm: string;
	topFace: CubeFace;
	frontFace: CubeFace;
}

export interface CaseDrawing {
	size: PuzzleSize;
	turns: string[];
	looks: CapLooks | null;
}

/** The engine's puzzle for a category, or null for one it does not draw. */
export function enginePuzzleSize(category: string): PuzzleSize | null {
	const type = getPuzzleType(category);
	return type === '3x3x3' ? 3 : type === '2x2x2' ? 2 : type === '4x4x4' ? 4 : null;
}

/** Can our engine draw this case? */
export function engineDrawsCase(category: string, algorithm: string): boolean {
	return enginePuzzleSize(category) !== null && algTurns(algorithm) !== null;
}

/**
 * The case's turns from solved and its stickering. The mask is taken unrotated and read for
 * the places the orientation puts pieces in (capLooksFromMask). Null when the engine cannot
 * draw the case.
 */
export async function caseDrawing({category, algorithm, topFace, frontFace}: CaseToDraw): Promise<CaseDrawing | null> {
	const size = enginePuzzleSize(category);
	if (!size) return null;
	const rotation = getOrientationRotation(topFace, frontFace);
	const turns = caseTurns(algorithm, rotation);
	if (!turns) return null;
	const stickering = size === 3 ? getStickering(category) : 'full';
	const mask = stickering !== 'full' ? await getRemappedMask(stickering, '') : null;
	return {size, turns, looks: mask ? capLooksFromMask(mask, rotation) : null};
}
