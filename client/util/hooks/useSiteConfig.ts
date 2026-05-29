import {useEffect, useState} from 'react';
import {gqlQueryTyped} from '../../components/api';
import {SiteConfigDocument, SiteConfigQuery} from '../../@types/generated/graphql';

export type SiteConfigData = SiteConfigQuery['siteConfig'];

const SITE_CONFIG_TTL = 30 * 1000; // 30s — aligned with server
let cachedConfig: {data: SiteConfigData; ts: number} | null = null;
const subscribers = new Set<(data: SiteConfigData | null) => void>();

function getCached(): SiteConfigData | null {
	if (!cachedConfig) return null;
	if (Date.now() - cachedConfig.ts > SITE_CONFIG_TTL) return null;
	return cachedConfig.data;
}

let inFlight: Promise<void> | null = null;
function fetchSiteConfig(): Promise<void> {
	if (inFlight) return inFlight;
	inFlight = gqlQueryTyped(SiteConfigDocument, {}, {fetchPolicy: 'no-cache'})
		.then((res) => {
			const data = res?.data?.siteConfig;
			if (data) {
				cachedConfig = {data, ts: Date.now()};
				subscribers.forEach((cb) => cb(data));
			}
		})
		.catch(() => {})
		.finally(() => {
			inFlight = null;
		});
	return inFlight;
}

// Force fresh fetch — doesn't break cache, just re-requests; distributes result to subscribers when it arrives
export function refreshSiteConfig() {
	// Bypass in-flight check
	inFlight = null;
	gqlQueryTyped(SiteConfigDocument, {}, {fetchPolicy: 'no-cache'})
		.then((res) => {
			const data = res?.data?.siteConfig;
			if (data) {
				cachedConfig = {data, ts: Date.now()};
				subscribers.forEach((cb) => cb(data));
			}
		})
		.catch(() => {});
}

// Manual cache set (optimistic update after admin mutation)
export function setSiteConfigCache(data: SiteConfigData) {
	cachedConfig = {data, ts: Date.now()};
	subscribers.forEach((cb) => cb(data));
}

export function useSiteConfig(): SiteConfigData | null {
	const [config, setConfig] = useState<SiteConfigData | null>(() => getCached());

	useEffect(() => {
		// Subscribe to global cache changes
		subscribers.add(setConfig);

		// If cache is fresh, do nothing
		const cached = getCached();
		if (cached) {
			setConfig(cached);
		} else {
			// Fetch
			fetchSiteConfig();
		}

		// Window focus — fresh fetch (user returns to tab)
		// Don't null cache, refresh silently in background — no UI loading shown
		const handleFocus = () => {
			if (!cachedConfig || Date.now() - cachedConfig.ts > 10 * 1000) {
				refreshSiteConfig();
			}
		};
		window.addEventListener('focus', handleFocus);

		// Polling only runs when page is visible — battery saving
		let pollInterval: ReturnType<typeof setInterval> | null = null;
		const startPolling = () => {
			if (pollInterval) return;
			pollInterval = setInterval(() => {
				refreshSiteConfig();
			}, 30 * 1000);
		};
		const stopPolling = () => {
			if (pollInterval) {
				clearInterval(pollInterval);
				pollInterval = null;
			}
		};

		const handleVisibility = () => {
			if (document.visibilityState === 'visible') {
				handleFocus();
				startPolling();
			} else {
				stopPolling();
			}
		};
		document.addEventListener('visibilitychange', handleVisibility);

		if (typeof document === 'undefined' || document.visibilityState === 'visible') {
			startPolling();
		}

		return () => {
			subscribers.delete(setConfig);
			window.removeEventListener('focus', handleFocus);
			document.removeEventListener('visibilitychange', handleVisibility);
			stopPolling();
		};
	}, []);

	return config;
}
