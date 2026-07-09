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
		handleDeepLink(url);
	});
}

function handleDeepLink(rawUrl: string): void {
	let parsed: URL;
	try {
		parsed = new URL(rawUrl);
	} catch (e) {
		return;
	}

	if (parsed.protocol === 'https:') {
		// Universal/App Link (e.g. https://zktimer.app/oauth/wca?...) — route the path
		// into the shell; the SPA router takes it from there.
		if (parsed.hostname.endsWith('zktimer.app')) {
			navigateShell(parsed.pathname + parsed.search);
		}
		return;
	}

	if (parsed.protocol !== 'zkttimer:') {
		return;
	}

	// zkttimer://oauth/wca/login?... parses as host='oauth', pathname='/wca/login'
	const path = '/' + parsed.host + parsed.pathname;
	closeInAppBrowser();

	if (path.startsWith('/oauth/')) {
		navigateShell(path + parsed.search);
	}
}

function navigateShell(pathWithSearch: string): void {
	// Full navigation on purpose: the local server serves index.html for any path,
	// the shell reboots (cheap, all-local) and the route component handles the rest.
	window.location.href = pathWithSearch;
}

function closeInAppBrowser(): void {
	if (!Capacitor.isPluginAvailable('Browser')) {
		return;
	}
	import('@capacitor/browser')
		.then(({Browser}) => Browser.close())
		.catch(() => {
			// Browser.close is a no-op/unimplemented on Android Custom Tabs
		});
}
