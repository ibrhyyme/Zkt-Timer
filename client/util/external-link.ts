import {Capacitor} from '@capacitor/core';
import {isNative} from './platform';

/**
 * WCA, WCA Live gibi web sayfalari icin
 * Web'de yeni sekmede acar, Capacitor'de sistem tarayicisinda acar
 */
export function openInAppBrowser(url: string) {
	if (isNative()) {
		window.open(url, '_blank');
	} else {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
}

/**
 * Harita linkleri icin - native harita uygulamasina yonlendir
 * Web'de Google Maps'e yonlendirir
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
