import fetch from 'node-fetch';
import { acquireRedisLock, createRedisKey, RedisNamespace } from './redis';
import { logger } from './logger';
import { getDefaultSiteMapUrls } from './sitemap';
import { getSiteConfig } from '../models/site_config';
import { isOnlineBattleLaunched } from '../../client/components/battle/battle_landing_modes';
import { buildIndexNowPayload } from './indexnow_key';

// What IndexNow is and why the key is public: indexnow_key.ts.

const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
// Once per release across every instance. Under 2^31 ms on purpose (timer limits).
const RELEASE_LOCK_MS = 7 * 24 * 60 * 60 * 1000;
// Let the new container settle and start answering the key URL before Bing checks it.
const BOOT_DELAY_MS = 5 * 60 * 1000;

/**
 * Sends the public site pages (the sitemap's site list, every language; no profiles) once
 * per release. Only public page addresses leave the server.
 */
export async function submitSiteUrlsToIndexNow(): Promise<void> {
	if (process.env.ENV !== 'production') return;
	const release = process.env.RELEASE_NAME;
	if (!release || release === 'dev') return;

	const lock = await acquireRedisLock(createRedisKey(RedisNamespace.INDEXNOW, release), RELEASE_LOCK_MS);
	if (!lock) return;

	let launched = false;
	try {
		launched = isOnlineBattleLaunched(await getSiteConfig());
	} catch {
		// Unknown flag: leave the launch-gated pages out, as the sitemap does
	}

	const urls = getDefaultSiteMapUrls(launched).map((u) => u.location);
	const payload = buildIndexNowPayload(process.env.BASE_URI, urls);
	if (!payload) {
		logger.warn('IndexNow: nothing to submit', { baseUri: process.env.BASE_URI });
		return;
	}

	try {
		const res = await fetch(INDEXNOW_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify(payload),
		});
		// 200 and 202 both mean accepted; 403 means the key URL did not answer.
		logger.info('IndexNow submission', { status: res.status, urls: payload.urlList.length, release });
	} catch (e) {
		logger.warn('IndexNow submission failed', { error: (e as Error)?.message, release });
	}
}

export function scheduleIndexNowSubmission(): void {
	setTimeout(() => {
		void submitSiteUrlsToIndexNow();
	}, BOOT_DELAY_MS);
}
