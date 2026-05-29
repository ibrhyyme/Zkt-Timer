import {Capacitor} from '@capacitor/core';
import {isNative} from './platform';

/**
 * For web pages like WCA, WCA Live
 * Opens in new tab on web, opens in system browser on Capacitor
 */
export function openInAppBrowser(url: string) {
	if (isNative()) {
		window.open(url, '_blank');
	} else {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
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
