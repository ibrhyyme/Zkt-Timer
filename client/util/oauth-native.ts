import {getApiBase, isLocalShell} from './api-base';
import {openInAppBrowser} from './external-link';

// WCA OAuth in the Faz 2 local-bundle shell.
//
// The shell's origin (capacitor://localhost) can't be a WCA redirect_uri, so the
// authorize round-trip always lands on the site (https://zktimer.app/oauth/...),
// which runs in the EXTERNAL browser. That page has no access to the app's
// sessionStorage, so the only channel telling it "this flow belongs to the native
// app" is the OAuth `state` parameter: we prefix it with `zktnative.` and the site
// page relays code+state back into the app via the zkttimer:// deep link instead
// of processing the login itself. Old remote-loading binaries never get the prefix
// (isLocalShell() false) and keep their in-webview flow untouched.
export const NATIVE_OAUTH_STATE_PREFIX = 'zktnative.';

// Absolute redirect_uri — must byte-match what the provider has registered.
// Both providers are driven from here: WCA, and the Zeka Kupu Turkiye
// federation, which runs its own authorization server.
export type OAuthCallbackPath =
	| '/oauth/wca/login'
	| '/oauth/wca'
	| '/oauth/zkt/login'
	| '/oauth/zkt';

export function oauthRedirectUri(path: OAuthCallbackPath): string {
	return getApiBase() + path;
}

// Wrap a state value (random CSRF state or a redirect path) with the native marker.
export function markNativeOAuthState(state: string): string {
	return isLocalShell() ? NATIVE_OAUTH_STATE_PREFIX + state : state;
}

export function isNativeRelayState(state: string | null): boolean {
	return !!state && state.startsWith(NATIVE_OAUTH_STATE_PREFIX);
}

// Remove the marker to recover the original state (e.g. the redirect path the
// linking flow carries in `state`).
export function stripNativeOAuthState(state: string | null): string | null {
	if (!state) {
		return state;
	}
	return isNativeRelayState(state) ? state.slice(NATIVE_OAUTH_STATE_PREFIX.length) : state;
}

// Start the authorize flow: external browser sheet in the local shell (deep link
// brings the user back), plain navigation everywhere else (web + old binaries).
export function openOAuthAuthorize(url: string): void {
	if (isLocalShell()) {
		void openInAppBrowser(url);
		return;
	}
	window.location.href = url;
}

// zkttimer://oauth/wca/login?code=..&state=.. — parsed by client/util/deep-link.ts.
export function buildNativeRelayDeepLink(path: string, params: URLSearchParams): string {
	return `zkttimer:/${path}?${params.toString()}`;
}
