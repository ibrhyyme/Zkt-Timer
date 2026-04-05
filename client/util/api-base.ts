import { isNative, isAndroidNative } from './platform';

const API_BASE = 'https://zktimer.app';

/**
 * iOS native'de local asset'lerden yukleniyor, API cross-origin.
 * Android ve web'de ayni origin'den yukleniyor.
 */
export function getApiBase(): string {
	if (isNative() && !isAndroidNative()) {
		return API_BASE;
	}
	return '';
}
