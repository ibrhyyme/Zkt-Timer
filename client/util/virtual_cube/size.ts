/**
 * Cube-type to virtual cube dimension.
 *
 * cstimer resolves this through `tools.puzzleType(scrambleType)` and its own
 * `types` array (virtual.js:187), which is indexed by side length. Zkt-Timer
 * identifies a solve bucket by (cube_type, scramble_subset) instead, so the
 * mapping is expressed in those terms.
 *
 * Returns null when the current bucket is not an NxN cube, which is how callers
 * know the virtual cube cannot be offered: it only implements NxN, exactly as
 * the ported twisty does.
 */

/** Standalone cube types that are an NxN puzzle regardless of subset. */
const CUBE_TYPE_SIZES: Record<string, number> = {
	'222': 2,
	'333': 3,
	'333cfop': 3,
	'333roux': 3,
	'333mehta': 3,
	'444': 4,
	'444yau': 4,
	'555': 5,
	'666': 6,
	'777': 7,
};

/**
 * WCA event ids, used when cube_type is 'wca' and the subset carries the event.
 * Blindfolded, one-handed, FMC and multi-BLD are all still ordinary cubes.
 */
const WCA_EVENT_SIZES: Record<string, number> = {
	'222': 2,
	'333': 3,
	'333oh': 3,
	'333bf': 3,
	'333ni': 3,
	'333fm': 3,
	'333mbf': 3,
	'333mbld': 3,
	'444': 4,
	'444bf': 4,
	'444bld': 4,
	'555': 5,
	'555bf': 5,
	'555bld': 5,
	'666': 6,
	'777': 7,
};

export function getVirtualCubeSize(
	cubeType: string | null | undefined,
	scrambleSubset?: string | null
): number | null {
	if (!cubeType) {
		return null;
	}

	if (cubeType === 'wca') {
		// Default to 3x3 the same way the scramble generator does when no subset
		// has been chosen yet.
		return WCA_EVENT_SIZES[scrambleSubset || '333'] ?? null;
	}

	return CUBE_TYPE_SIZES[cubeType] ?? null;
}

/** Whether the virtual cube can be used for this bucket at all. */
export function virtualCubeSupports(
	cubeType: string | null | undefined,
	scrambleSubset?: string | null
): boolean {
	return getVirtualCubeSize(cubeType, scrambleSubset) !== null;
}

/**
 * Blindfolded buckets, where the cube hides its colours after the first move and
 * rotations are not free during inspection. virtual.js:16, 44.
 */
export function isBldSubset(scrambleSubset?: string | null): boolean {
	return /^(333ni|333bf|444bld|444bf|555bld|555bf)$/.test(scrambleSubset || '');
}
