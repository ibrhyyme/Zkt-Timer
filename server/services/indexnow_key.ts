/**
 * IndexNow (indexnow.org): tells Bing, and through it ChatGPT search and Copilot, plus
 * Yandex, Seznam and Naver, that our pages changed, instead of waiting for a recrawl.
 *
 * The key is public by design: the protocol proves we own the host by serving it at
 * /<key>.txt (search_engines.ts). It is not a secret and needs no env var.
 */
export const INDEXNOW_KEY = '73b029779a68745ab97a31e45597a46d';
export const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;

export interface IndexNowPayload {
	host: string;
	key: string;
	keyLocation: string;
	urlList: string[];
}

/** The request body for `urls`, or null when they cannot be sent (no base URI, nothing to send). */
export function buildIndexNowPayload(baseUri: string | undefined, urls: string[]): IndexNowPayload | null {
	if (!baseUri) return null;
	let origin: URL;
	try {
		origin = new URL(baseUri);
	} catch {
		return null;
	}
	// The protocol rejects the whole batch if one URL is on another host.
	const urlList = Array.from(new Set(urls.filter((u) => {
		try {
			return new URL(u).host === origin.host;
		} catch {
			return false;
		}
	})));
	if (!urlList.length) return null;
	return {
		host: origin.host,
		key: INDEXNOW_KEY,
		keyLocation: `${origin.origin}${INDEXNOW_KEY_PATH}`,
		urlList,
	};
}
