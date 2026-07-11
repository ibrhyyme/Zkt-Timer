import {useEffect, useState} from 'react';
import {gqlQueryTyped} from '../../components/api';
import {SiteConfigDocument, SiteConfigQuery} from '../../@types/generated/graphql';

export type SiteConfigData = SiteConfigQuery['siteConfig'];

const SITE_CONFIG_TTL = 30 * 1000; // 30s — aligned with server
const SNAPSHOT_KEY = 'zkt_site_config_cache';
let cachedConfig: {data: SiteConfigData; ts: number} | null = null;
const subscribers = new Set<(data: SiteConfigData | null) => void>();

// Last-known-good snapshot in localStorage: an offline boot must not leave every
// FeatureGuard'ed page blank just because the config query can't run. Seeded at
// module load with the original timestamp, so online TTL/freshness is unchanged.
function readSnapshot(): {data: SiteConfigData; ts: number} | null {
	try {
		const raw = localStorage.getItem(SNAPSHOT_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || !parsed.data || typeof parsed.ts !== 'number') return null;
		return parsed;
	} catch (e) {
		return null;
	}
}

function writeSnapshot(snap: {data: SiteConfigData; ts: number}): void {
	try {
		localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
	} catch (e) {
		// Storage unavailable — memory cache still works for this session
	}
}

if (typeof window !== 'undefined') {
	cachedConfig = readSnapshot();
}

function getCached(): SiteConfigData | null {
	if (!cachedConfig) return null;
	if (Date.now() - cachedConfig.ts > SITE_CONFIG_TTL) {
		// Expired: offline, stale flags beat blank pages; online, force a refetch.
		if (typeof navigator !== 'undefined' && navigator.onLine === false) {
			return cachedConfig.data;
		}
		return null;
	}
	return cachedConfig.data;
}

// Single in-flight request shared by initial loads, focus refreshes and the poller —
// N mounted hooks must never translate into N parallel /graphql hits.
let inFlight: Promise<void> | null = null;
function requestConfig(): Promise<void> {
	if (inFlight) return inFlight;
	inFlight = gqlQueryTyped(SiteConfigDocument, {}, {fetchPolicy: 'no-cache'})
		.then((res) => {
			const data = res?.data?.siteConfig;
			if (data) {
				cachedConfig = {data, ts: Date.now()};
				writeSnapshot(cachedConfig);
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
	void requestConfig();
}

// Manual cache set (optimistic update after admin mutation)
export function setSiteConfigCache(data: SiteConfigData) {
	cachedConfig = {data, ts: Date.now()};
	writeSnapshot(cachedConfig);
	subscribers.forEach((cb) => cb(data));
}

// Module-level polling with subscriber refcount: exactly ONE 30s interval and ONE
// focus/visibility listener pair regardless of how many components use the hook.
// (Previously every mounted hook ran its own interval, multiplying server load.)
let pollRefCount = 0;
let pollInterval: ReturnType<typeof setInterval> | null = null;

function handleFocus() {
	if (!cachedConfig || Date.now() - cachedConfig.ts > 10 * 1000) {
		void requestConfig();
	}
}

function startPollTimer() {
	if (pollInterval) return;
	pollInterval = setInterval(() => {
		void requestConfig();
	}, SITE_CONFIG_TTL);
}

function stopPollTimer() {
	if (pollInterval) {
		clearInterval(pollInterval);
		pollInterval = null;
	}
}

// Polling only runs when page is visible — battery saving
function handleVisibility() {
	if (document.visibilityState === 'visible') {
		handleFocus();
		startPollTimer();
	} else {
		stopPollTimer();
	}
}

function attachGlobalPolling() {
	pollRefCount += 1;
	if (pollRefCount > 1 || typeof window === 'undefined') return;
	window.addEventListener('focus', handleFocus);
	document.addEventListener('visibilitychange', handleVisibility);
	if (document.visibilityState === 'visible') {
		startPollTimer();
	}
}

function detachGlobalPolling() {
	pollRefCount = Math.max(0, pollRefCount - 1);
	if (pollRefCount > 0 || typeof window === 'undefined') return;
	window.removeEventListener('focus', handleFocus);
	document.removeEventListener('visibilitychange', handleVisibility);
	stopPollTimer();
}

export function useSiteConfig(): SiteConfigData | null {
	const [config, setConfig] = useState<SiteConfigData | null>(() => getCached());

	useEffect(() => {
		// Subscribe to global cache changes
		subscribers.add(setConfig);
		attachGlobalPolling();

		const cached = getCached();
		if (cached) {
			setConfig(cached);
		} else {
			void requestConfig();
		}

		return () => {
			subscribers.delete(setConfig);
			detachGlobalPolling();
		};
	}, []);

	return config;
}
