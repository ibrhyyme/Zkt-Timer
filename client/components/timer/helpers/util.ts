import {ITimerContext} from '../Timer';
import {getSetting} from '../../../db/settings/query';
import {puzzleOfBucket} from '../../../../shared/cube_puzzle';
import type {SmartCubePuzzle} from '../../../../shared/smart_cube/puzzle';

// Tum 3x3 tabanli cube_type + subset kombinasyonlari. Akilli kup fiziksel
// 3x3 cozumunu takip eder — scramble metoduna bakmaz.
// - '333' ve tum method varyantlari (cfop/roux/zz/mehta)
// - 'wca' + scramble_subset='333' (WCA 3x3x3 etkinligi)
const THREE_BY_THREE_CUBE_TYPES = new Set([
	'333',
	'333cfop',
	'333roux',
	'333mehta',
]);

export function is3x3CubeType(cubeType: string | null | undefined, scrambleSubset?: string | null): boolean {
	if (!cubeType) return false;
	if (THREE_BY_THREE_CUBE_TYPES.has(cubeType)) return true;
	if (cubeType === 'wca' && scrambleSubset === '333') return true;
	return false;
}

/**
 * The smart cube puzzle a timer bucket takes, or null when no smart cube can time it.
 * 3x3 buckets as above; '222' (any subset) and WCA 2x2x2 take the 2x2 models.
 */
export function smartCubePuzzleFor(cubeType: string | null | undefined, scrambleSubset?: string | null): SmartCubePuzzle | null {
	if (is3x3CubeType(cubeType, scrambleSubset)) return '333';
	return puzzleOfBucket(cubeType, scrambleSubset) === '222' ? '222' : null;
}

export function smartCubeSelected(context: ITimerContext) {
	const timerType = getSetting('timer_type');
	const {cubeType, scrambleSubset} = context;

	return timerType === 'smart' && smartCubePuzzleFor(cubeType, scrambleSubset) !== null;
}
