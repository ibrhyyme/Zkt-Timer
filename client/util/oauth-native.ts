import {Browser} from '@capacitor/browser';
import {App as CapApp} from '@capacitor/app';
import {isNative} from './platform';

export function openOAuthFlow(authUrl: string): void {
	if (!isNative()) {
		window.location.href = authUrl;
		return;
	}

	Browser.open({url: authUrl, presentationStyle: 'popover'});

	const listenerPromise = CapApp.addListener('appUrlOpen', (data: {url: string}) => {
		const url = new URL(data.url);
		if (url.pathname.startsWith('/oauth/wca')) {
			Browser.close();
			listenerPromise.then((h) => h.remove());
			window.location.href = url.pathname + url.search;
		}
	});
}
