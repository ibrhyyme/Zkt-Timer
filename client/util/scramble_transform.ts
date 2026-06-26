/**
 * Scramble Color Transform
 *
 * cstimer standard 3x3 scrambles permute the U layer pieces (white face, cube ref).
 * If the user prefers a different cross/drill color, we transform the scramble
 * via conjugation: rotation + SCRAM + rotation^-1.
 *
 * Net rotation is identity (cube remains in standard orientation), but the scramble's
 * effect is transferred to the selected color's corresponding face. User holds cube
 * in STANDARD grip, compatible with smart cube and classic mode.
 *
 * Mathematically: A · SCRAM · A^(-1) (A = rotation) = each face turn of SCRAM
 * transformed under A. transformMoves(SCRAM, A) performs this operation.
 * This yields a clean scramble of only face turns without extra cube rotations (x/y/z).
 */

import {transformMoves} from '../components/solve_info/util/cross_rotation';

export type TopColorFace = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';

const TOP_COLOR_FACES: TopColorFace[] = ['U', 'D', 'F', 'B', 'R', 'L'];

export function isTopColorFace(value: unknown): value is TopColorFace {
	return typeof value === 'string' && TOP_COLOR_FACES.includes(value as TopColorFace);
}

/**
 * Selected face → U position rotation map.
 *
 * Rotation that moves the face the user wants to drill to the cube's U position.
 * Scramble permutes U layer in standard reference. transformMoves transforms each face turn
 * under this rotation — the scramble's effect is transferred to the selected face.
 *
 * | Color  | Face | Rotation |
 * |--------|------|----------|
 * | White  | U    | ''       | Default, no-op
 * | Yellow | D    | x2       | Yellow top drill
 * | Red    | R    | z        | Red top drill
 * | Orange | L    | z'       | Orange top drill
 * | Green  | F    | x'       | Green top drill
 * | Blue   | B    | x        | Blue top drill
 */
const FACE_TO_U_ROTATION: Record<TopColorFace, string> = {
	U: '',
	D: 'x2',
	R: 'z',
	L: "z'",
	F: "x'",
	B: 'x',
};

/**
 * Top color selection is shown in which cube_type + subset combinations.
 * Only in 3x3 CFOP with PLL/OLL/Cross Solved (f2l) subsets.
 */
const TOP_COLOR_SUBSETS = new Set(['pll', 'oll', 'f2l']);

export function isTopColorAvailable(cubeType: string | null | undefined, subset: string | null | undefined): boolean {
	if (cubeType !== '333cfop') return false;
	if (!subset) return false;
	return TOP_COLOR_SUBSETS.has(subset);
}

/**
 * Transform a standard 3x3 scramble according to the selected top layer color.
 *
 * Implementation: transformMoves(scramble, rotation) — transforms each face turn
 * under the rotation. Result: a clean scramble of only face turns with no residual
 * cube rotations.
 *
 * @param scramble  Standard cstimer scramble (example: "R U R' F D L'")
 * @param topColor  The color the user wants to hold on top. null/'U' = no transform.
 * @returns Transformed scramble. On error, returns original scramble.
 *
 * NOTE: Async signature for backward compatibility — old cubing.js Alg required lazy load.
 * Currently runs synchronously but callers still await; signature unchanged.
 */
export async function applyTopColorTransform(
	scramble: string,
	topColor?: TopColorFace | null
): Promise<string> {
	if (!scramble || !topColor || topColor === 'U') return scramble;
	const rot = FACE_TO_U_ROTATION[topColor];
	if (!rot) return scramble;
	try {
		const result = transformMoves(scramble, rot);
		return result || scramble;
	} catch (e) {
		console.warn('[scramble_transform] transformMoves failed, returning original:', e);
		return scramble;
	}
}

// Color-neutral training: each scramble is transformed onto a random face from the
// level's pool. Reuses applyTopColorTransform's conjugation so the cube stays in the
// standard grip (smart-cube compatible). 'dual' = white/yellow, 'six' = all faces.
const COLOR_NEUTRAL_POOLS: Record<string, TopColorFace[]> = {
	dual: ['U', 'D'],
	six: ['U', 'D', 'F', 'B', 'R', 'L'],
};

export async function applyColorNeutral(
	scramble: string,
	mode: string | null | undefined
): Promise<string> {
	const pool = mode ? COLOR_NEUTRAL_POOLS[mode] : null;
	if (!scramble || !pool) return scramble;
	const face = pool[Math.floor(Math.random() * pool.length)];
	return applyTopColorTransform(scramble, face);
}
