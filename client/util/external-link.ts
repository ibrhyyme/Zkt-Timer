import {Capacitor} from '@capacitor/core';
import {isNative} from './platform';
import {releaseNativeBackButton} from './native-back';

/**
 * For web pages like WCA, WCA Live
 * Opens in new tab on web. On native, uses the Browser plugin (Chrome Custom Tab /
 * SFSafariViewController with a close button, app stays alive underneath) when the
 * installed binary ships it. Older binaries without the plugin fall back to
 * in-WebView navigation with the backButton listener released first, so the
 * hardware back returns to the app instead of being swallowed (see native-back.ts).
 */
export function openInAppBrowser(url: string) {
	if (isNative()) {
		void openExternalOnNative(url);
	} else {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
}

async function openExternalOnNative(url: string) {
	try {
		if (Capacitor.isPluginAvailable('Browser')) {
			const {Browser} = await import('@capacitor/browser');
			await Browser.open({url});
			return;
		}
	} catch (e) {
		console.warn('[Native] Browser.open failed, falling back to WebView navigation:', e);
	}

	await releaseNativeBackButton();
	window.open(url, '_blank');
}

/**
 * For map links — redirect to native maps app
 * On web, redirects to Google Maps
 */
export function openInMaps(query: string) {
	const encoded = encodeURIComponent(query);
	if (isNative()) {
		if (Capacitor.getPlatform() === 'ios') {
			window.open(`maps://?q=${encoded}`, '_system');
		} else {
			window.open(`geo:0,0?q=${encoded}`, '_system');
		}
	} else {
		window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank', 'noopener,noreferrer');
	}
}
