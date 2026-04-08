import {useEffect, useState} from 'react';
import {gqlQueryTyped} from '../../components/api';
import {SiteConfigDocument, SiteConfigQuery} from '../../@types/generated/graphql';

export type SiteConfigData = SiteConfigQuery['siteConfig'];

const SITE_CONFIG_TTL = 30 * 1000; // 30s — server ile align
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

// Force fresh fetch — cache'i bozmadan, sadece yeniden ister, sonuc gelince subscriber'lara dagitir
export function refreshSiteConfig() {
	// in-flight'i bypass et
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

// Manuel cache set (admin mutation sonrasi optimistic update)
export function setSiteConfigCache(data: SiteConfigData) {
	cachedConfig = {data, ts: Date.now()};
	subscribers.forEach((cb) => cb(data));
}

export function useSiteConfig(): SiteConfigData | null {
	const [config, setConfig] = useState<SiteConfigData | null>(() => getCached());

	useEffect(() => {
		// Subscribe to global cache changes
		subscribers.add(setConfig);

		// Cache fresh ise hicbir sey yapma
		const cached = getCached();
		if (cached) {
			setConfig(cached);
		} else {
			// Fetch
			fetchSiteConfig();
		}

		// Window focus → fresh fetch (kullanici tab'a geri donerse)
		// Cache'i null'lamayiz, sessizce arka planda yenileriz — UI loading gostermez
		const handleFocus = () => {
			if (!cachedConfig || Date.now() - cachedConfig.ts > 10 * 1000) {
				refreshSiteConfig();
			}
		};
		window.addEventListener('focus', handleFocus);
		const handleVisibility = () => {
			if (document.visibilityState === 'visible') handleFocus();
		};
		document.addEventListener('visibilitychange', handleVisibility);

		// Polling: 30 saniyede bir sessiz refresh (cache bozmaz, UI loading gostermez)
		const pollInterval = setInterval(() => {
			refreshSiteConfig();
		}, 30 * 1000);

		return () => {
			subscribers.delete(setConfig);
			window.removeEventListener('focus', handleFocus);
			document.removeEventListener('visibilitychange', handleVisibility);
			clearInterval(pollInterval);
		};
	}, []);

	return config;
}
