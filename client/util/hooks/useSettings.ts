import {AllSettings, getSetting} from '../../db/settings/query';
import {useSettingsChangeCounter} from '../../providers/DataProvider';

export function useSettings<T extends keyof AllSettings>(key: T): AllSettings[T] {
	const settingsChangeCounter = useSettingsChangeCounter();
	const value = getSetting(key);
	
	// Re-render when settings change (via global context)
	// settingsChangeCounter is used to trigger re-renders

	return value;
}
