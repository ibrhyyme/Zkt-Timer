import {useSmartCubeStore} from '../../../util/hooks/useSmartCubeStore';
import type {SmartCubePuzzle} from '../../../../shared/smart_cube/puzzle';
import {smartCubePuzzleFor} from './util';

export interface SmartPuzzleMatch {
	/** A cube is connected and it is not the puzzle this bucket is timed with. */
	mismatch: boolean;
	/** Puzzle of the connected cube. */
	cube: SmartCubePuzzle;
	/** Puzzle the bucket needs, or null when no smart cube can time it. */
	session: SmartCubePuzzle | null;
}

/**
 * Does the connected smart cube fit the puzzle being timed?
 *
 * The cube stays connected either way: the link belongs to the app, and the user may be about
 * to switch the session to the cube in their hands. A page that sees a mismatch stops feeding
 * its engine and says why, rather than matching a 3x3 scramble against a 2x2.
 */
export function useSmartPuzzleMatch(cubeType: string | null | undefined, scrambleSubset?: string | null): SmartPuzzleMatch {
	const connected = useSmartCubeStore('smartCubeConnected');
	const cube = useSmartCubeStore('smartCubePuzzle') || '333';
	const session = smartCubePuzzleFor(cubeType, scrambleSubset);
	return {mismatch: !!connected && !!session && cube !== session, cube, session};
}

/** "3x3" / "2x2", for the mismatch message. */
export function smartPuzzleLabel(puzzle: SmartCubePuzzle | null): string {
	return puzzle === '222' ? '2x2' : '3x3';
}
