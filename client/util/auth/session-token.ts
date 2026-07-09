import {Capacitor} from '@capacitor/core';
import {isNative} from '../platform';

// Native session token store (Faz 2 local-bundle auth).
//
// The httpOnly session cookie is unreadable/unsendable from the local-bundle origin
// (iOS ITP blocks third-party cookies), so the server hands the same JWT to native
// clients via the X-Session-Token response header and we persist it in
// @capacitor/preferences, sending it back as Authorization: Bearer.
//
// Old binaries don't ship the Preferences plugin: every call here degrades to a
// silent no-op there (they keep using the same-origin cookie).
const TOKEN_KEY = 'zkt_session_token';

let cachedToken: string | null | undefined = undefined; // undefined = not loaded yet

function preferencesAvailable(): boolean {
	return isNative() && Capacitor.isPluginAvailable('Preferences');
}

export async function getSessionToken(): Promise<string | null> {
	if (!isNative()) {
		return null;
	}

	if (cachedToken !== undefined) {
		return cachedToken;
	}

	if (!preferencesAvailable()) {
		cachedToken = null;
		return null;
	}

	try {
		const {Preferences} = await import('@capacitor/preferences');
		const {value} = await Preferences.get({key: TOKEN_KEY});
		cachedToken = value || null;
	} catch (e) {
		cachedToken = null;
	}

	return cachedToken;
}

export async function setSessionToken(token: string): Promise<void> {
	if (!token || !preferencesAvailable()) {
		return;
	}

	cachedToken = token;
	try {
		const {Preferences} = await import('@capacitor/preferences');
		await Preferences.set({key: TOKEN_KEY, value: token});
	} catch (e) {
		// Persist failure: token stays in memory for this session only
	}
}

export async function clearSessionToken(): Promise<void> {
	cachedToken = null;
	if (!preferencesAvailable()) {
		return;
	}

	try {
		const {Preferences} = await import('@capacitor/preferences');
		await Preferences.remove({key: TOKEN_KEY});
	} catch (e) {
		// Nothing to clear
	}
}
