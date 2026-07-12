import {App as CapApp} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {isNative} from './platform';

// Deep link entry point for the Faz 2 local-bundle shell.
//
// Arrival paths:
//   zkttimer://oauth/...   custom scheme fired by the site-side OAuth relay pages
//   https://zktimer.app/.. Android App Links / iOS Universal Links (existing filter)
//
// Old binaries never registered the zkttimer scheme, so this listener simply never
// fires there — safe to ship via web deploy.
export function initDeepLinkHandler(): void {
	if (!isNative()) {
		return;
	}

	CapApp.addListener('appUrlOpen', ({url}) => {
		void handleDeepLink(url);
	});
}

async function handleDeepLink(rawUrl: string): Promise<void> {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch (e) {
		return;
	}

	if (parsed.protocol === 'https:') {
		// Universal/App Link (e.g. https://zktimer.app/oauth/wca?...) — route the path
		// into the shell; the SPA router takes it from there. iOS can intercept the
		// WCA -> zktimer.app redirect while the OAuth sheet is still presented, so the
		// sheet must be dismissed here too (same rule as the zkttimer: branch below),
		// otherwise it stays open on top of the already-logged-in app.
		if (parsed.hostname.endsWith('zktimer.app')) {
			await closeInAppBrowser();
			navigateShell(parsed.pathname + parsed.search);
		}
		return;
	}

	if (parsed.protocol !== 'zkttimer:') {
		return;
	}

	// zkttimer://oauth/wca/login?... parses as host='oauth', pathname='/wca/login'
	const path = '/' + parsed.host + parsed.pathname;
	// AWAIT the sheet dismissal before any full-page navigation: navigateShell tears
	// down this JS context, and a fire-and-forget Browser.close() bridge call that
	// hasn't reached native yet dies with it — the iOS Safari sheet then stays open
	// on top of the app forever.
	await closeInAppBrowser();

	// Hidden debug switch: eruda is off by default and there is no console to set the
	// flag from, so typing zkttimer://debug (or zkttimer://debug-off) in the device
	// browser toggles it. Exposes nothing sensitive — only the on-device DevTools.
	if (path === '/debug' || path === '/debug-off') {
		try {
			if (path === '/debug') {
				localStorage.setItem('zkt_debug', '1');
			} else {
				localStorage.removeItem('zkt_debug');
			}
		} catch (e) {}
		navigateShell('/timer');
		return;
	}

	if (path.startsWith('/oauth/')) {
		navigateShell(path + parsed.search);
	}
}

function navigateShell(pathWithSearch: string): void {
	// Full navigation on purpose: the local server serves index.html for any path,
	// the shell reboots (cheap, all-local) and the route component handles the rest.
	window.location.href = pathWithSearch;
}

async function closeInAppBrowser(): Promise<void> {
	if (!Capacitor.isPluginAvailable('Browser')) {
		return;
	}
	try {
		const {Browser} = await import('@capacitor/browser');
		await Browser.close();
	} catch (e) {
		// Browser.close is a no-op/unimplemented on Android Custom Tabs
	}
}
