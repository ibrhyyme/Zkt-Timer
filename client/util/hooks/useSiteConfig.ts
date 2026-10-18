import {useContext, useEffect, useState} from 'react';
import {ReactReduxContext} from 'react-redux';
import {gqlQueryTyped} from '../../components/api';
import {SiteConfigDocument, SiteConfigQuery} from '../../@types/generated/graphql';
import {SITE_CONFIG_SSR_KEY} from '../../../shared/site_config_ssr';

export type SiteConfigData = SiteConfigQuery['siteConfig'];

const SITE_CONFIG_TTL = 30 * 1000; // 30s — aligned with server
const SNAPSHOT_KEY = 'zkt_site_config_cache';
let cachedConfig: {data: SiteConfigData; ts: number} | null = null;
const subscribers = new Set<(data: SiteConfigData | null) => void>();

// Last-known-good snapshot in localStorage: an offline boot must not leave every
// FeatureGuard'ed page blank just because the config query can't run.
//
// It is an offline fallback only and never counts as fresh. It used to seed
// `cachedConfig` with its original timestamp, so a reload within 30 s of the last fetch
// took the snapshot as current and skipped the request: a flag switched off in between
// (someone taken off an access list) stayed on screen over the server-rendered page
// until the next poll.
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

const bootSnapshot: {data: SiteConfigData; ts: number} | null = typeof window !== 'undefined' ? readSnapshot() : null;

// The config the server rendered this page with (server/services/site_config_ssr.ts). It
// was read at request time, so on the client it counts as a fresh fetch: adopting it lets
// the first frame match the server's markup and spares the request a page load used to
// wait for. Adopted once; App remounts per route but the store, and with it the seed, does
// not change after hydration.
let ssrSeedAdopted = false;
function adoptSsrSeed(seed: SiteConfigData | null | undefined): void {
	if (ssrSeedAdopted || !seed || typeof window === 'undefined') return;
	ssrSeedAdopted = true;
	if (!cachedConfig) cachedConfig = {data: seed, ts: Date.now()};
}

function readSsrSeed(store: any): SiteConfigData | null {
	try {
		return store?.getState?.()?.ssr?.[SITE_CONFIG_SSR_KEY] ?? null;
	} catch (e) {
		return null;
	}
}

function getCached(): SiteConfigData | null {
	if (cachedConfig && Date.now() - cachedConfig.ts <= SITE_CONFIG_TTL) {
		return cachedConfig.data;
	}
	// Missing or expired: offline, stale flags beat blank pages; online, force a refetch.
	if (typeof navigator !== 'undefined' && navigator.onLine === false) {
		return (cachedConfig ?? bootSnapshot)?.data ?? null;
	}
	return null;
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
/**
 * The last config we saw, however old, including the snapshot restored at boot.
 *
 * Only for decisions where being 30 seconds behind is harmless, such as whether to
 * bother asking for presence. Anything that gates access must use `useSiteConfig`,
 * which respects the TTL and refetches.
 */
export function getLastKnownSiteConfig(): SiteConfigData | null {
	return (cachedConfig ?? bootSnapshot)?.data ?? null;
}

export function refreshSiteConfig() {
	void requestConfig();
}

/** Fresh config for boot-time decisions; null when the server could not be reached. */
export async function fetchSiteConfig(): Promise<SiteConfigData | null> {
	const before = cachedConfig;
	await requestConfig();
	// requestConfig swallows failures; an unchanged cache entry means nothing new arrived.
	return cachedConfig && cachedConfig !== before ? cachedConfig.data : null;
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
	// Context rather than useSelector: the seed never changes after hydration, and the hook
	// must keep working where no store is mounted.
	const reduxContext = useContext(ReactReduxContext);
	const [config, setConfig] = useState<SiteConfigData | null>(() => {
		const seed = readSsrSeed(reduxContext?.store);
		// Server: module state is shared by every request, so only the per-request seed counts.
		if (typeof window === 'undefined') return seed;
		adoptSsrSeed(seed);
		return getCached();
	});

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
