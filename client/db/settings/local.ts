import {AllSettings, getDefaultSettings} from './query';
import {getLocalStorage, setLocalStorage, setLocalStorageObject} from '../../util/data/local_storage';
import {getMe} from '../../components/store';
import {VISITOR_FIRST_LOOK_MARKER, visitorFirstLookPatch} from './visitor_first_look';

export function getAllLocalSettings(userId: string): AllSettings {
	const settingsVal = getLocalStorage('settings');
	// A copy: on a desktop viewport getDefaultSettings() hands back the module's own
	// defaults object, which nothing may write through.
	let output: AllSettings = {...getDefaultSettings()};

	if (settingsVal && typeof settingsVal === 'object') {
		const userSettings = settingsVal[userId];
		if (userSettings && Object.keys(userSettings).length) {
			// The stored entry only holds the keys that existed when it was first written.
			// Layered over the current defaults, a setting added since still has a value,
			// and so a row in the settings collection: the anonymous boot builds its rows
			// from this object alone, and setSettings cannot update a row that is missing.
			output = {...output, ...userSettings};
		} else {
			settingsVal[userId] = getDefaultSettings();
			setLocalStorageObject('settings', settingsVal);
		}
	} else {
		output = findLegacyLocalSettings();

		setLocalStorageObject('settings', {
			[userId]: output,
		});
	}

	return output;
}

export function getLocalSettingValue<T extends keyof AllSettings>(key: T): AllSettings[T] {
	const me = getMe();
	const userId = me?.id || '_anon';

	const localSettings = getAllLocalSettings(userId);
	return localSettings[key];
}

export function setLocalSettingValue<T extends keyof AllSettings>(key: T, value: AllSettings[T]): void {
	const me = getMe();
	const userId = me?.id || '_anon';

	// Seeds the user's entry on a first visit, so there is always one to write into.
	getAllLocalSettings(userId);

	// Written into the stored entry itself rather than into getAllLocalSettings' result.
	// That one is layered over the current defaults, and saving it would freeze every
	// default into storage, so a default changed in a later release would never reach
	// this user.
	const allSettingsVal = getLocalStorage('settings') || {};
	const stored = allSettingsVal[userId] && typeof allSettingsVal[userId] === 'object' ? allSettingsVal[userId] : {};
	stored[key] = value;
	allSettingsVal[userId] = stored;

	setLocalStorageObject('settings', allSettingsVal);
}

/**
 * The visitor's first look (visitor_first_look.ts), written once into their stored
 * settings before the anonymous boot reads them. Never throws: storage may be blocked,
 * and the timer must boot either way.
 */
export function applyVisitorFirstLook(): void {
	try {
		if (getLocalStorage(VISITOR_FIRST_LOOK_MARKER)) return;
		// Seeds the visitor's entry on a first visit, so there is one to write into.
		getAllLocalSettings('_anon');
		const allSettingsVal = getLocalStorage('settings') || {};
		const stored = allSettingsVal._anon && typeof allSettingsVal._anon === 'object' ? allSettingsVal._anon : {};
		const patch = visitorFirstLookPatch(stored);
		if (Object.keys(patch).length) {
			allSettingsVal._anon = {...stored, ...patch};
			setLocalStorageObject('settings', allSettingsVal);
		}
		setLocalStorage(VISITOR_FIRST_LOOK_MARKER, '1');
	} catch (e) {
		// Storage unavailable: the visitor gets the plain defaults.
	}
}

function findLegacyLocalSettings() {
	const defaultSettings = getDefaultSettings();
	const newSettings = {...defaultSettings};

	for (const key of Object.keys(defaultSettings)) {
		const localValue = getLocalStorage(key);

		if (localValue === null || localValue === undefined) {
			continue;
		}

		newSettings[key] = localValue;
	}

	return newSettings;
}
