import {useCallback, useEffect, useRef, useState} from 'react';
import {gqlQueryTyped} from '../../api';
import {
	WcaLiveRoundResultsDocument,
	WcaLiveRoundResultsQuery,
	WcaLiveCompetitionOverviewDocument,
	WcaLiveCompetitionOverviewQuery,
	WcaLiveCompetitorResultsDocument,
	WcaLiveCompetitorResultsQuery,
} from '../../../@types/generated/graphql';
import {socketClient} from '../../../util/socket/socketio';
import {retryDelayMs} from './fetch-error';
import {peekCached, loadCached, storeCached, isOlderThan, CacheEntry} from '../competition-cache';

export type LiveRoundData = WcaLiveRoundResultsQuery['wcaLiveRoundResults'];
export type LiveOverviewData = WcaLiveCompetitionOverviewQuery['wcaLiveCompetitionOverview'];
export type LiveCompetitorData = WcaLiveCompetitorResultsQuery['wcaLiveCompetitorResults'];

const ROUND_POLL_INTERVAL = 60 * 1000; // Fallback when Socket.IO push is available
const OVERVIEW_CACHE_TTL = 60 * 1000; // 60s — align with server cache
// The overview carries which rounds are live right now; refresh it while the tab
// is open and visible. The server answers from its cache.
const OVERVIEW_REFRESH_MS = 60 * 1000;
const COMPETITOR_CACHE_TTL = 60 * 1000;
// Live data is drawn from the last copy kept on the device (competition-cache)
// whatever its age within this window, and refreshed behind it: switching tabs,
// rounds or competitors, or reopening the app, never shows an empty skeleton for
// something already seen.
const LIVE_SHOWN_MAX_AGE = 3 * 24 * 60 * 60 * 1000;

const overviewKey = (competitionId: string) => `overview:${competitionId}`;
const roundKey = (competitionId: string, liveRoundId: string) => `round:${competitionId}:${liveRoundId}`;
const competitorKey = (competitionId: string, personLiveId: string) => `competitor:${competitionId}:${personLiveId}`;

function shown<T>(entry: CacheEntry<T> | null): CacheEntry<T> | null {
	return entry && !isOlderThan(entry, LIVE_SHOWN_MAX_AGE) ? entry : null;
}

// Silent prefetch — can be called externally, populates cache
export async function prefetchWcaLiveOverview(competitionId: string): Promise<LiveOverviewData | null> {
	if (!competitionId) return null;
	const cached = await loadCached<LiveOverviewData>(overviewKey(competitionId));
	if (cached && !isOlderThan(cached, OVERVIEW_CACHE_TTL)) {
		return cached.data;
	}
	try {
		const res = await gqlQueryTyped(
			WcaLiveCompetitionOverviewDocument,
			{input: {competitionId}},
			{fetchPolicy: 'no-cache'}
		);
		const overview = res?.data?.wcaLiveCompetitionOverview || null;
		if (overview) {
			storeCached(overviewKey(competitionId), overview, 'idb');
			// Also prefetch default round of first event (silent)
			const firstEvent = overview.events?.[0];
			if (firstEvent && firstEvent.rounds?.length > 0) {
				const active = firstEvent.rounds.find((r: any) => r.active);
				const finishedRounds = firstEvent.rounds.filter((r: any) => r.finished);
				const defaultRound = active
					|| (finishedRounds.length > 0 ? finishedRounds[finishedRounds.length - 1] : firstEvent.rounds[0]);
				if (defaultRound?.liveRoundId) {
					prefetchWcaLiveRound(competitionId, defaultRound.liveRoundId).catch(() => {});
				}
			}
		}
		return overview;
	} catch {
		return null;
	}
}

export async function prefetchWcaLiveRound(competitionId: string, liveRoundId: string): Promise<void> {
	if (!competitionId || !liveRoundId) return;
	try {
		const res = await gqlQueryTyped(
			WcaLiveRoundResultsDocument,
			{input: {competitionId, liveRoundId}},
			{fetchPolicy: 'no-cache'}
		);
		// Kept, so the round opens with its table already drawn. The result used to
		// be thrown away, which made this prefetch a request for nothing.
		const result = res?.data?.wcaLiveRoundResults || null;
		if (result) storeCached(roundKey(competitionId, liveRoundId), result, 'idb');
	} catch {
		// silent
	}
}

export function useWcaLiveOverview(competitionId: string, enabled: boolean) {
	const [data, setData] = useState<LiveOverviewData | null>(
		() => shown(peekCached<LiveOverviewData>(overviewKey(competitionId)))?.data || null
	);
	const [loading, setLoading] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<number | null>(
		() => shown(peekCached<LiveOverviewData>(overviewKey(competitionId)))?.ts ?? null
	);
	// The last request failed (federation busy, connection dropped). Not the same
	// as "this competition is not on ZKT Live", which is a null answer.
	const [failed, setFailed] = useState(false);
	const overviewReqIdRef = useRef(0);
	const retryRef = useRef<{timer: ReturnType<typeof setTimeout> | null; attempt: number}>({timer: null, attempt: 0});

	const fetchOverview = useCallback((force: boolean = false) => {
		if (!enabled || !competitionId) return;

		const myReqId = ++overviewReqIdRef.current;
		if (!force) {
			const cached = shown(peekCached<LiveOverviewData>(overviewKey(competitionId)));
			if (cached) {
				setData(cached.data);
				setLastUpdated(cached.ts);
				if (!isOlderThan(cached, OVERVIEW_CACHE_TTL)) return;
			} else {
				// Not in memory: draw the copy on the device, if any, while the
				// network answers.
				loadCached<LiveOverviewData>(overviewKey(competitionId)).then((stored) => {
					const usable = shown(stored);
					if (!usable || myReqId !== overviewReqIdRef.current) return;
					setData((prev) => prev || usable.data);
					setLastUpdated((prev) => prev ?? usable.ts);
				});
			}
		}

		setLoading(true);
		gqlQueryTyped(
			WcaLiveCompetitionOverviewDocument,
			{input: {competitionId}},
			{fetchPolicy: 'no-cache'}
		)
			.then((res) => {
				if (myReqId !== overviewReqIdRef.current) return;
				const overview = res?.data?.wcaLiveCompetitionOverview || null;
				if (overview) {
					storeCached(overviewKey(competitionId), overview, 'idb');
					setLastUpdated(Date.now());
				}
				// A null after real data is a hiccup, not the competition leaving
				// ZKT Live: keep what is on screen.
				setData((prev) => overview || prev || null);
				setFailed(false);
				retryRef.current.attempt = 0;
			})
			.catch(() => {
				if (myReqId !== overviewReqIdRef.current) return;
				// Keep whatever is shown and ask again shortly.
				setFailed(true);
				if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
				const delay = retryDelayMs(retryRef.current.attempt);
				retryRef.current.attempt += 1;
				retryRef.current.timer = setTimeout(() => {
					retryRef.current.timer = null;
					fetchOverview(true);
				}, delay);
			})
			.finally(() => {
				if (myReqId === overviewReqIdRef.current) setLoading(false);
			});
	}, [competitionId, enabled]);

	useEffect(() => {
		fetchOverview();
	}, [fetchOverview]);

	useEffect(() => {
		if (!enabled || !competitionId) return;
		const id = setInterval(() => {
			if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
			fetchOverview(true);
		}, OVERVIEW_REFRESH_MS);
		return () => clearInterval(id);
	}, [fetchOverview, enabled, competitionId]);

	useEffect(() => () => {
		if (retryRef.current.timer) clearTimeout(retryRef.current.timer);
	}, []);

	const refresh = useCallback(() => fetchOverview(true), [fetchOverview]);

	return {data, loading, lastUpdated, refresh, failed};
}

export function useLiveRoundResults(
	competitionId: string,
	liveRoundId: string | null,
	enabled: boolean
) {
	const [data, setData] = useState<LiveRoundData | null>(null);
	const [loading, setLoading] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<number | null>(null);
	const [lastError, setLastError] = useState<number | null>(null);
	const requestIdRef = useRef(0);
	const intervalRef = useRef<any>(null);

	const doFetch = useCallback(async (myRequestId: number, retry: number = 0): Promise<void> => {
		if (!competitionId || !liveRoundId) return;
		try {
			const res = await gqlQueryTyped(
				WcaLiveRoundResultsDocument,
				{input: {competitionId, liveRoundId}},
				{fetchPolicy: 'no-cache'}
			);
			if (myRequestId !== requestIdRef.current) return;

			const result = res?.data?.wcaLiveRoundResults || null;

			if (!result && retry < 2) {
				const delay = 800 * Math.pow(2, retry);
				setTimeout(() => doFetch(myRequestId, retry + 1), delay);
				return;
			}

			if (result) {
				storeCached(roundKey(competitionId, liveRoundId), result, 'idb');
				setData(result);
				setLastUpdated(Date.now());
				setLastError(null);
			}
			setLoading(false);
		} catch {
			if (myRequestId !== requestIdRef.current) return;
			if (retry < 1) {
				setTimeout(() => doFetch(myRequestId, retry + 1), 1000);
				return;
			}
			setLastError(Date.now());
			setLoading(false);
		}
	}, [competitionId, liveRoundId]);

	useEffect(() => {
		// The round's last table is drawn at once (memory, else the device), the
		// fresh one replaces it. An empty skeleton on every round switch made the
		// results feel slow even when the server answered quickly.
		const memory = competitionId && liveRoundId
			? shown(peekCached<LiveRoundData>(roundKey(competitionId, liveRoundId)))
			: null;
		setData(memory?.data || null);
		setLastUpdated(memory?.ts ?? null);
		setLastError(null);

		if (!enabled || !competitionId || !liveRoundId) {
			setLoading(false);
			return;
		}

		const myRequestId = ++requestIdRef.current;
		if (!memory) {
			loadCached<LiveRoundData>(roundKey(competitionId, liveRoundId)).then((stored) => {
				const usable = shown(stored);
				if (!usable || myRequestId !== requestIdRef.current) return;
				setData((prev) => prev || usable.data);
				setLastUpdated((prev) => prev ?? usable.ts);
			});
		}
		setLoading(true);
		doFetch(myRequestId);

		// Socket.IO subscription — real-time update via server push
		const socket = socketClient();
		socket.emit('wca-live:subscribe', {competitionId, liveRoundId});

		const handleUpdate = (data: LiveRoundData) => {
			if (!data) return;
			storeCached(roundKey(competitionId, liveRoundId), data, 'idb');
			setData(data);
			setLastUpdated(Date.now());
			setLastError(null);
			setLoading(false);
		};
		socket.on('wca-live:round-update', handleUpdate);

		return () => {
			socket.emit('wca-live:unsubscribe', {liveRoundId});
			socket.off('wca-live:round-update', handleUpdate);
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [competitionId, liveRoundId, enabled, doFetch]);

	// Polling: ONLY on active round
	useEffect(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		if (!enabled || !data?.active || data?.finished) return;

		intervalRef.current = setInterval(() => {
			// Skip polling while the tab is hidden — socket.io still pushes updates when
			// visible, and a backgrounded tab shouldn't drain battery/network.
			if (typeof document !== 'undefined' && document.hidden) return;

			// Guard against a slow/stale poll response overwriting fresher data: bump the
			// shared request id and ignore this response if a newer fetch/poll superseded it.
			const myRequestId = ++requestIdRef.current;
			gqlQueryTyped(
				WcaLiveRoundResultsDocument,
				{input: {competitionId, liveRoundId: liveRoundId!}},
				{fetchPolicy: 'no-cache'}
			)
				.then((res) => {
					if (myRequestId !== requestIdRef.current) return;
					const result = res?.data?.wcaLiveRoundResults || null;
					if (result) {
						storeCached(roundKey(competitionId, liveRoundId!), result, 'idb');
						setData(result);
						setLastUpdated(Date.now());
						setLastError(null);
					}
				})
				.catch(() => {
					if (myRequestId !== requestIdRef.current) return;
					setLastError(Date.now());
				});
		}, ROUND_POLL_INTERVAL);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
			intervalRef.current = null;
		};
	}, [enabled, data?.active, data?.finished, competitionId, liveRoundId]);

	const refresh = useCallback(() => {
		if (!enabled || !competitionId || !liveRoundId) return;
		const myRequestId = ++requestIdRef.current;
		setLoading(true);
		doFetch(myRequestId);
	}, [enabled, competitionId, liveRoundId, doFetch]);

	return {
		data,
		loading,
		lastUpdated,
		lastError,
		refresh,
		isLive: !!data,
		isActive: !!data?.active,
		isFinished: !!data?.finished,
	};
}

// --- Competitor Live Results (in-app competitor result display) ---

export function useCompetitorLiveResults(
	competitionId: string,
	personLiveId: string | null,
	enabled: boolean
) {
	const cacheKey = competitorKey(competitionId, personLiveId || '');
	const [data, setData] = useState<LiveCompetitorData | null>(() => {
		if (!enabled || !personLiveId) return null;
		return shown(peekCached<LiveCompetitorData>(cacheKey))?.data || null;
	});
	const [loading, setLoading] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<number | null>(
		() => shown(peekCached<LiveCompetitorData>(cacheKey))?.ts ?? null
	);
	const [lastError, setLastError] = useState<number | null>(null);
	const requestIdRef = useRef(0);

	const doFetch = useCallback(async (myRequestId: number, retry: number = 0): Promise<void> => {
		if (!competitionId || !personLiveId) return;
		try {
			const res = await gqlQueryTyped(
				WcaLiveCompetitorResultsDocument,
				{input: {competitionId, personLiveId}},
				{fetchPolicy: 'no-cache'}
			);
			if (myRequestId !== requestIdRef.current) return;

			const result = res?.data?.wcaLiveCompetitorResults || null;

			if (!result && retry < 1) {
				setTimeout(() => doFetch(myRequestId, retry + 1), 800);
				return;
			}

			if (result) {
				storeCached(cacheKey, result, 'idb');
				setData(result);
				setLastUpdated(Date.now());
				setLastError(null);
			}
			setLoading(false);
		} catch {
			if (myRequestId !== requestIdRef.current) return;
			if (retry < 1) {
				setTimeout(() => doFetch(myRequestId, retry + 1), 1000);
				return;
			}
			setLastError(Date.now());
			setLoading(false);
		}
	}, [competitionId, personLiveId, cacheKey]);

	useEffect(() => {
		if (!enabled || !competitionId || !personLiveId) {
			setLoading(false);
			return;
		}

		const myRequestId = ++requestIdRef.current;
		const cached = shown(peekCached<LiveCompetitorData>(cacheKey));
		if (cached) {
			setData(cached.data);
			setLastUpdated(cached.ts);
			if (!isOlderThan(cached, COMPETITOR_CACHE_TTL)) {
				setLoading(false);
				return;
			}
		} else {
			loadCached<LiveCompetitorData>(cacheKey).then((stored) => {
				const usable = shown(stored);
				if (!usable || myRequestId !== requestIdRef.current) return;
				setData((prev) => prev || usable.data);
				setLastUpdated((prev) => prev ?? usable.ts);
			});
		}
		setLoading(true);
		doFetch(myRequestId);
	}, [competitionId, personLiveId, enabled, cacheKey, doFetch]);

	const refresh = useCallback(() => {
		if (!enabled || !competitionId || !personLiveId) return;
		const myRequestId = ++requestIdRef.current;
		setLoading(true);
		doFetch(myRequestId);
	}, [enabled, competitionId, personLiveId, cacheKey, doFetch]);

	return {data, loading, lastUpdated, lastError, refresh};
}
