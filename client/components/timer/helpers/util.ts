import {ITimerContext} from '../Timer';
import {getSetting} from '../../../db/settings/query';

// Tum 3x3 tabanli cube_type + subset kombinasyonlari. Akilli kup fiziksel
// 3x3 cozumunu takip eder — scramble metoduna bakmaz.
// - '333' ve tum method varyantlari (cfop/roux/zz/mehta/sub)
// - 'wca' + scramble_subset='333' (WCA 3x3x3 etkinligi)
const THREE_BY_THREE_CUBE_TYPES = new Set([
	'333',
	'333cfop',
	'333roux',
	'333zz',
	'333mehta',
	'333sub',
]);

export function is3x3CubeType(cubeType: string | null | undefined, scrambleSubset?: string | null): boolean {
	if (!cubeType) return false;
	if (THREE_BY_THREE_CUBE_TYPES.has(cubeType)) return true;
	if (cubeType === 'wca' && scrambleSubset === '333') return true;
	return false;
}

export function smartCubeSelected(context: ITimerContext) {
	const timerType = getSetting('timer_type');
	const {cubeType, scrambleSubset} = context;

	return timerType === 'smart' && is3x3CubeType(cubeType, scrambleSubset);
}
