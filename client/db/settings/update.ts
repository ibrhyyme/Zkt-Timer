import {Setting} from '../../@types/generated/graphql';
import {gql} from '@apollo/client';
import {SETTING_FRAGMENT} from '../../util/graphql/fragments';
import {gqlMutate, gqlQuery} from '../../components/api';
import {snakeCase} from 'change-case';
import {
	AllSettings,
	getSetting,
	isGlobalSetting,
	isLocalOnlySetting,
	isPlatformSetting,
	getPlatformPrefsKey,
	collectPlatformPrefs,
} from './query';
import {getSettingsDb, SettingValue} from './init';
import {updateOfflineHash} from '../../components/layout/offline';
import {emitEvent} from '../../util/event_handler';
import {setLocalSettingValue} from './local';

export const MOBILE_FONT_SIZE_MULTIPLIER = 0.75;
export const MIN_MOBILE_FREEZE_TIME = 0.45;

export function setCurrentSession(id: string) {
	return setSetting('session_id', id);
}

export function setCubeType(cubeType: string) {
	return setSetting('cube_type', cubeType);
}

export function setScrambleSubset(subset: string | null) {
	return setSetting('scramble_subset', subset);
}

export function setScrambleTopColor(color: string | null) {
	return setSetting('scramble_top_color', color);
}

export async function refreshSettings() {
	const query = gql`
		${SETTING_FRAGMENT}

		query Query {
			settings {
				...SettingsFragment
			}
		}
	`;

	interface SettingsData {
		settings: Setting;
	}

	const settingsDb = getSettingsDb();
	const res = await gqlQuery<SettingsData>(query);
	const backend: any = res.data.settings;

	// Parse the active platform's prefs blob (desktop_prefs / mobile_prefs)
	let platformPrefs: Record<string, any> = {};
	const rawPrefs = backend?.[getPlatformPrefsKey()];
	if (rawPrefs) {
		try {
			platformPrefs = JSON.parse(rawPrefs) || {};
		} catch {
			platformPrefs = {};
		}
	}

	function applyValue(key: string, value: any) {
		if (isLocalOnlySetting(key as keyof AllSettings)) return; // never overwrite device-local state
		const setVal = settingsDb.findOne({id: key});
		if (!setVal) return;
		setVal.value = value;
		settingsDb.update(setVal);
	}

	// Global settings come from columns; platform settings come from the prefs blob.
	for (const key of Object.keys(backend)) {
		if (key === 'desktop_prefs' || key === 'mobile_prefs') continue;
		if (!isGlobalSetting(key as keyof AllSettings)) continue; // platform keys handled below
		applyValue(key, backend[key]);
	}
	for (const key of Object.keys(platformPrefs)) {
		applyValue(key, platformPrefs[key]);
	}
}

type BoolSettingKeys = {[k in keyof AllSettings]: AllSettings[k] extends boolean ? k : never}[keyof AllSettings];
type BoolSettingKey = {[k in BoolSettingKeys]: boolean};
export function toggleSetting(key: keyof BoolSettingKey) {
	const val = getSetting(key);
	setSetting(key, !val);
}

export function setSetting<T extends keyof AllSettings>(key: T, value: AllSettings[T]) {
	const payload: {[key in keyof Partial<AllSettings>]: AllSettings[key]} = {
		[key]: value,
	};

	updatePartialSettings(payload);
}

async function updatePartialSettings(payload: Partial<AllSettings>) {
	const settingsDb = getSettingsDb();

	const localSettingUpdates: SettingValue[] = [];
	const globalPayload: Record<string, any> = {};
	let platformChanged = false;

	for (const key of Object.keys(payload)) {
		const value = payload[key];

		const setVal = settingsDb.findOne({id: key});
		const newVal = {...setVal};
		newVal.value = value;
		localSettingUpdates.push(newVal);

		if (isLocalOnlySetting(key as keyof AllSettings)) {
			// device-only — never synced
			continue;
		}
		if (isGlobalSetting(key as keyof AllSettings)) {
			globalPayload[snakeCase(key)] = value;
		} else {
			// platform setting — sent as a prefs blob (collected after LokiJS update)
			platformChanged = true;
		}
	}

	// Update local store first so collectPlatformPrefs() sees the new values.
	setSettingLocal(localSettingUpdates);
	emitSettingUpdateEvent(localSettingUpdates);

	if (platformChanged) {
		globalPayload[getPlatformPrefsKey()] = JSON.stringify(collectPlatformPrefs());
	}

	if (Object.keys(globalPayload).length) {
		setSettingApi(globalPayload);
	}
}

function setSettingLocal(setVals: SettingValue[]) {
	const settingsDb = getSettingsDb();

	for (const setVal of setVals) {
		settingsDb.update(setVal);
		setLocalSettingValue(setVal.id as any, setVal.value);
	}
}

async function setSettingApi(gqlPayload: Record<string, any>) {
	// Terminate if no keys to set
	if (!Object.keys(gqlPayload).length) {
		return;
	}

	const promises: Promise<any>[] = [updateOfflineHash()];

	const query = gql`
		mutation Mutate($input: SettingInput) {
			setSetting(input: $input) {
				id
			}
		}
	`;

	promises.push(
		gqlMutate(query, {
			input: gqlPayload,
		})
	);

	await Promise.all(promises);
}

function emitSettingUpdateEvent(setVals: SettingValue[]) {
	for (const setVal of setVals) {
		emitEvent('settingsDbUpdatedEvent', setVal);
	}
}

// Push the active platform's full prefs blob to the server. Used by the
// first-time platform migration to seed desktop_prefs / mobile_prefs from the
// values resolved out of old columns + localStorage during initial load.
export async function syncPlatformPrefs() {
	await setSettingApi({[getPlatformPrefsKey()]: JSON.stringify(collectPlatformPrefs())});
}
