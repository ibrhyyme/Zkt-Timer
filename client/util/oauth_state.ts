// OAuth CSRF korumasi — state parameter generate, store, validate.
// Saldirganin kurbani kendi OAuth code'una yonlendirmesini engeller.

import {markNativeOAuthState} from './oauth-native';

const STATE_KEY = 'zkt_wca_oauth_state';

function randomState(): string {
	// Browser native crypto API — secure random
	if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
		const buf = new Uint8Array(32);
		window.crypto.getRandomValues(buf);
		return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
	}
	// Fallback (SSR yapilmaz, savunma amacli)
	return `${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

// Yeni state olustur, sessionStorage'a yaz, geri don
export function createAndStoreOAuthState(): string {
	// In the local shell the state gets a 'zktnative.' prefix: the site-side callback
	// page relays the code back into the app via the zkttimer:// deep link. The
	// prefixed value is what gets stored, so the round-trip comparison matches 1:1.
	const state = markNativeOAuthState(randomState());
	try {
		sessionStorage.setItem(STATE_KEY, state);
	} catch {
		// sessionStorage erisilemiyorsa state korumasiz devam (private mode vs.)
	}
	return state;
}

// Callback sayfasinda cagrilir — sessionStorage'taki state ile URL'deki state karsilastir
// Bir kez kullanilir (replay korumasi): kontrol sonrasi siler.
export function consumeAndValidateOAuthState(receivedState: string | null): boolean {
	let stored: string | null = null;
	try {
		stored = sessionStorage.getItem(STATE_KEY);
		sessionStorage.removeItem(STATE_KEY);
	} catch {
		return false;
	}
	if (!stored || !receivedState) return false;
	return stored === receivedState;
}
