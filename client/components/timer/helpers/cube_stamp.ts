import { puzzleOfBucket } from '../../../../shared/cube_puzzle';
import { activeCubeFor, CubeState, LocalCube, smartCubeByBleId } from '../../../lib/cubes/active_cube';

/**
 * Which physical cube a new timer solve is stamped with (design magnet-cubes 4.3, K-3).
 *
 * Pure: the caller passes the cube state and the BLE id of the connected smart cube, so the
 * rules are testable without Redux or localStorage.
 *
 *   smart cube solve       the connected cube, whatever the main is (that cube is in the hands)
 *   virtual cube solve     nothing (no physical cube)
 *   every other input      the main cube of the bucket's puzzle, or nothing
 *
 * A cube is only ever stamped onto a bucket of its own puzzle: a 3x3 smart cube connected
 * while the timer is on 7x7 stamps nothing (S-3). The server applies the same rule.
 */
export interface CubeStampSolve {
	cube_type?: string | null;
	scramble_subset?: string | null;
	is_smart_cube?: boolean | null;
	is_virtual_cube?: boolean | null;
}

export function cubeIdForSolve(
	solve: CubeStampSolve,
	state: Pick<CubeState, 'cubes' | 'mains'>,
	smartBleDeviceId: string | null | undefined
): string | null {
	if (solve.is_virtual_cube) return null;

	const puzzle = puzzleOfBucket(solve.cube_type, solve.scramble_subset);
	if (!puzzle) return null;

	if (solve.is_smart_cube) {
		const cube = smartCubeByBleId(state, smartBleDeviceId);
		return cube && cube.puzzle === puzzle ? cube.id : null;
	}

	return activeCubeFor(solve, state)?.id ?? null;
}

/** The registered cube behind a connected smart cube, for labels. null while unknown (offline first connect). */
export function connectedSmartCube(
	state: Pick<CubeState, 'cubes'>,
	smartBleDeviceId: string | null | undefined
): LocalCube | null {
	return smartCubeByBleId(state, smartBleDeviceId);
}
