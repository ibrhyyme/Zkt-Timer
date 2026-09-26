// Carries an OAuth signup's pending token from the callback page to the username
// page, for the native shell only.
//
// The server parks the provider profile in an httpOnly cookie between those two
// requests. The local-bundle app calls the API cross-origin, and iOS ITP drops that
// cookie as third-party, so every iOS signup died on "session expired" at the
// username step. The server therefore also hands the same signed token to native
// clients in the response body, and it rides back as a mutation argument.
//
// sessionStorage, not localStorage: the token holds the provider's access and
// refresh tokens and only has to survive the one same-tab navigation between the
// two pages. It never goes in the URL for the same reason.
export type PendingSignupProvider = 'zkt' | 'wca';

function storageKey(provider: PendingSignupProvider): string {
	return `zkt_pending_signup_${provider}`;
}

/** Pass the result's token as-is: an empty value clears a leftover from an earlier attempt. */
export function storePendingSignupToken(provider: PendingSignupProvider, token: string | null | undefined): void {
	try {
		if (token) {
			sessionStorage.setItem(storageKey(provider), token);
		} else {
			sessionStorage.removeItem(storageKey(provider));
		}
	} catch (e) {
		// Storage unavailable: the cookie path still works everywhere but iOS native.
	}
}

export function readPendingSignupToken(provider: PendingSignupProvider): string | null {
	try {
		return sessionStorage.getItem(storageKey(provider)) || null;
	} catch (e) {
		return null;
	}
}

export function clearPendingSignupToken(provider: PendingSignupProvider): void {
	storePendingSignupToken(provider, null);
}
