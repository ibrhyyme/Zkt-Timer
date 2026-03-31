import {InAppBrowser} from '@capgo/inappbrowser';
import {isNative} from './platform';

export function openOAuthFlow(authUrl: string): void {
	if (!isNative()) {
		window.location.href = authUrl;
		return;
	}

	InAppBrowser.open({url: authUrl});

	InAppBrowser.addListener('urlChangeEvent', (event: {url: string}) => {
		try {
			const url = new URL(event.url);
			if (url.pathname.startsWith('/oauth/wca')) {
				InAppBrowser.removeAllListeners();
				InAppBrowser.close();
				window.location.href = url.pathname + url.search;
			}
		} catch (e) {
			// ignore
		}
	});
}
