// "Çözüm yapılan küp" (design .feedback/designs/magnet-cubes.md 5.4 and 5.5): which cube new
// timer solves are stamped with, shown in the quick settings and as a small label under the
// digits. Pure, so the visibility rules are testable without React.
import { puzzleOfBucket } from '../../../../shared/cube_puzzle';
import { cubesForPuzzle, CubeState, LocalCube, mainCubeFor } from '../../../lib/cubes/active_cube';
import { connectedSmartCube } from '../../timer/helpers/cube_stamp';

/** Above this many cubes the picker gets a search line (5.4). */
export const CUBE_SELECT_SEARCH_THRESHOLD = 10;

export type CubeSelectView =
	/** No row at all: nothing is stamped with this input, or there is nothing to choose. */
	| { kind: 'hidden' }
	/** Smart cube input: the stamp comes from the connected cube, read only (5.4). */
	| { kind: 'smart'; cube: LocalCube }
	/** Magnet Timer without a cube of this puzzle: "Bu türde küpün yok · Ekle". */
	| { kind: 'empty'; puzzle: string }
	/** The cubes of the puzzle (main first), the main, and whether "no cube" is allowed. */
	| { kind: 'select'; puzzle: string; cubes: LocalCube[]; mainId: string | null; allowNone: boolean };

export interface CubeSelectInput {
	signedIn: boolean;
	timerType: string | null | undefined;
	/** The Magnet Timer drives the timer (Pro, sensor, selection): it cannot run without a cube. */
	magnetOwnsInput: boolean;
	cubeType: string | null | undefined;
	scrambleSubset: string | null | undefined;
	state: Pick<CubeState, 'cubes' | 'mains'>;
	/** BLE id of the connected smart cube, when one is connected. */
	smartBleDeviceId?: string | null;
}

/**
 * The puzzle of the timer's bucket, read the way saveSolve stores the bucket: a WCA bucket
 * without an event saves as 3x3, so it is 3x3 here too.
 */
export function timerPuzzle(cubeType: string | null | undefined, scrambleSubset: string | null | undefined): string | null {
	const subset = cubeType === 'wca' ? scrambleSubset || '333' : scrambleSubset || null;
	return puzzleOfBucket(cubeType, subset);
}

export function cubeSelectView(input: CubeSelectInput): CubeSelectView {
	const { signedIn, timerType, magnetOwnsInput, state } = input;
	if (!signedIn) return { kind: 'hidden' };

	const puzzle = timerPuzzle(input.cubeType, input.scrambleSubset);
	if (!puzzle) return { kind: 'hidden' };

	// The virtual cube is no physical cube: its solves are never stamped (4.3).
	if (timerType === 'virtual') return { kind: 'hidden' };

	if (timerType === 'smart') {
		const cube = connectedSmartCube(state, input.smartBleDeviceId);
		return cube && cube.puzzle === puzzle ? { kind: 'smart', cube } : { kind: 'hidden' };
	}

	const cubes = cubesForPuzzle(puzzle, state);
	if (!cubes.length) {
		// Other inputs keep the quick settings short (1.9-j): the row only appears once there is
		// a cube to choose. The Magnet Timer needs one, so it points to adding it.
		return magnetOwnsInput ? { kind: 'empty', puzzle } : { kind: 'hidden' };
	}

	return {
		kind: 'select',
		puzzle,
		cubes,
		mainId: mainCubeFor(puzzle, state)?.id ?? null,
		// The Magnet Timer cannot start without a cube, so "no cube" is not offered there.
		allowNone: !magnetOwnsInput,
	};
}

/**
 * The label under the digits (5.5): the cube the next solve is stamped with, idle only. Smart
 * cube input has its own panel with the connected cube, and the virtual cube stamps nothing.
 */
export function timerCubeLabel(view: CubeSelectView): LocalCube | null {
	if (view.kind !== 'select' || !view.mainId) return null;
	return view.cubes.find((cube) => cube.id === view.mainId) || null;
}
