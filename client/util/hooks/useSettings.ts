import {AllSettings, getSetting} from '../../db/settings/query';
import {useDataContext} from '../../providers/DataProvider';

export function useSettings<T extends keyof AllSettings>(key: T): AllSettings[T] {
	const { settingsChangeCounter } = useDataContext();
	const value = getSetting(key);
	
	// Re-render when settings change (via global context)
	// settingsChangeCounter is used to trigger re-renders

	return value;
}
