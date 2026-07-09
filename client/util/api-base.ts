import {Consts} from '../shared/consts';
import {isNative} from './platform';

// Canonical site origin for API calls and outward-facing links.
//
// Web: the page origin (same-origin, unchanged behavior).
// Native: always the absolute production origin. In the Faz 2 local-bundle mode the
// WebView origin is capacitor://localhost / https://localhost, so origin-relative
// URLs would point at the bundle instead of the server. On older binaries that still
// load the site remotely, window.location.origin === STORAGE_ORIGIN anyway, so this
// is a no-op for them (backward compatible).
export function getApiBase(): string {
	if (typeof window === 'undefined') {
		// SSR callers keep their own localhost handling (see client/components/api.ts)
		return Consts.STORAGE_ORIGIN;
	}

	if (isNative()) {
		return Consts.STORAGE_ORIGIN;
	}

	return window.location.origin;
}

// True only in the Faz 2 bundled-shell mode: native runtime whose WebView origin is
// NOT the remote site. Old binaries (server.url remote loading) return false, which
// keeps their Faz 1 behavior (service worker offline, in-webview OAuth) intact.
export function isLocalShell(): boolean {
	if (typeof window === 'undefined' || !isNative()) {
		return false;
	}

	return window.location.origin !== Consts.STORAGE_ORIGIN;
}

// Landing/marketing imagery (public/welcome, public/partners) is deliberately NOT
// packed into the native bundle (~20 MB of binary weight for online-only pages).
// In the local shell these resolve to the remote site instead; everywhere else the
// relative path is kept (web SSR, old binaries, and bundled assets).
export function landingAsset(path: string): string {
	return isLocalShell() ? Consts.STORAGE_ORIGIN + path : path;
}
