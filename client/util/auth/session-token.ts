import {Capacitor} from '@capacitor/core';
import {isNative} from '../platform';

// Native session token store (Faz 2 local-bundle auth).
//
// The httpOnly session cookie is unreadable/unsendable from the local-bundle origin
// (iOS ITP blocks third-party cookies), so the server hands the same JWT to native
// clients via the X-Session-Token response header and we persist it, sending it back
// as Authorization: Bearer.
//
// Storage: @capacitor/preferences primary, localStorage fallback. The fallback is
// deliberate: the shell's localStorage lives inside the app sandbox (same exposure
// class), and a login that silently evaporates because the Preferences plugin is
// missing/broken is strictly worse than the marginal storage-hardening difference.
//
// Old binaries don't ship the Preferences plugin: they land on the localStorage path,
// which is harmless there (they keep using the same-origin cookie anyway).
const TOKEN_KEY = 'zkt_session_token';

let cachedToken: string | null | undefined = undefined; // undefined = not loaded yet

function preferencesAvailable(): boolean {
	return isNative() && Capacitor.isPluginAvailable('Preferences');
}

function readLocalStorageToken(): string | null {
	try {
		return localStorage.getItem(TOKEN_KEY) || null;
	} catch (e) {
		return null;
	}
}

function writeLocalStorageToken(token: string | null): void {
	try {
		if (token) {
			localStorage.setItem(TOKEN_KEY, token);
		} else {
			localStorage.removeItem(TOKEN_KEY);
		}
	} catch (e) {
		// Storage unavailable — nothing else to do
	}
}

export async function getSessionToken(): Promise<string | null> {
	if (!isNative()) {
		return null;
	}

	if (cachedToken !== undefined) {
		return cachedToken;
	}

	// localStorage FIRST: it is written synchronously on every capture, so it always
	// holds the freshest token. Preferences is an async mirror that can lag behind or
	// carry a stale token from an earlier session — reading it first let a dead token
	// shadow a fresh one and poison every boot (the login-bounce bug).
	const localToken = readLocalStorageToken();
	if (localToken) {
		cachedToken = localToken;
		return cachedToken;
	}

	if (preferencesAvailable()) {
		try {
			const {Preferences} = await import('@capacitor/preferences');
			const {value} = await Preferences.get({key: TOKEN_KEY});
			if (value) {
				cachedToken = value;
				// Heal the mirror so the next boot finds it in localStorage too
				writeLocalStorageToken(value);
				return cachedToken;
			}
		} catch (e) {
			// console.error survives the prod build (console.log/warn are stripped)
			console.error('[session-token] Preferences read failed:', (e as any)?.message);
		}
	} else {
		console.error('[session-token] Preferences plugin unavailable, using localStorage fallback');
	}

	cachedToken = null;
	return cachedToken;
}

// Bypass the sticky-null cache and re-read both stores. For the boot getMe when a
// token is EXPECTED (zkt_has_auth set) but the first read came back empty: a fresh
// login's async Preferences write may have landed only after that first read.
export async function refreshSessionTokenCache(): Promise<string | null> {
	cachedToken = undefined;
	return getSessionToken();
}

export async function setSessionToken(token: string): Promise<void> {
	if (!token || !isNative()) {
		return;
	}

	cachedToken = token;
	// Always mirror to localStorage: survives even if the Preferences write fails.
	writeLocalStorageToken(token);

	if (!preferencesAvailable()) {
		return;
	}

	try {
		const {Preferences} = await import('@capacitor/preferences');
		await Preferences.set({key: TOKEN_KEY, value: token});
	} catch (e) {
		console.error('[session-token] Preferences write failed:', (e as any)?.message);
	}
}

export async function clearSessionToken(): Promise<void> {
	cachedToken = null;
	writeLocalStorageToken(null);

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
