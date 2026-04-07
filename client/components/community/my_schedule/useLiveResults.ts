import {useCallback, useEffect, useRef, useState} from 'react';
import {gqlQueryTyped} from '../../api';
import {
	WcaLiveRoundResultsDocument,
	WcaLiveRoundResultsQuery,
	WcaLiveCompetitionOverviewDocument,
	WcaLiveCompetitionOverviewQuery,
} from '../../../@types/generated/graphql';

export type LiveRoundData = WcaLiveRoundResultsQuery['wcaLiveRoundResults'];
export type LiveOverviewData = WcaLiveCompetitionOverviewQuery['wcaLiveCompetitionOverview'];

const ROUND_POLL_INTERVAL = 30 * 1000;
const OVERVIEW_CACHE_TTL = 60 * 1000; // 60s — server cache ile align
const OVERVIEW_CACHE_MAX = 20;

// Module-level cache: overview verisi sayfa gecislerinde kaybolmasin
const overviewCache = new Map<string, {data: LiveOverviewData; timestamp: number}>();

function setOverviewCache(key: string, data: LiveOverviewData) {
	overviewCache.delete(key);
	overviewCache.set(key, {data, timestamp: Date.now()});
	while (overviewCache.size > OVERVIEW_CACHE_MAX) {
		const firstKey = overviewCache.keys().next().value;
		if (firstKey) overviewCache.delete(firstKey);
	}
}

// Sessiz prefetch — disaridan cagrilabilir, cache'i doldurur
export async function prefetchWcaLiveOverview(competitionId: string): Promise<LiveOverviewData | null> {
	if (!competitionId) return null;
	const cached = overviewCache.get(competitionId);
	if (cached && Date.now() - cached.timestamp < OVERVIEW_CACHE_TTL) {
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
			setOverviewCache(competitionId, overview);
			// Ilk event'in default round'unu da prefetch et (sessiz)
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
		await gqlQueryTyped(
			WcaLiveRoundResultsDocument,
			{input: {competitionId, liveRoundId}},
			{fetchPolicy: 'no-cache'}
		);
	} catch {
		// sessiz
	}
}

export function useWcaLiveOverview(competitionId: string, enabled: boolean) {
	const [data, setData] = useState<LiveOverviewData | null>(() => {
		const cached = overviewCache.get(competitionId);
		if (cached && Date.now() - cached.timestamp < OVERVIEW_CACHE_TTL) {
			return cached.data;
		}
		return null;
	});
	const [loading, setLoading] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<number | null>(() => {
		const cached = overviewCache.get(competitionId);
		return cached ? cached.timestamp : null;
	});
	const overviewReqIdRef = useRef(0);

	const fetchOverview = useCallback((force: boolean = false) => {
		if (!enabled || !competitionId) return;

		if (!force) {
			const cached = overviewCache.get(competitionId);
			if (cached && Date.now() - cached.timestamp < OVERVIEW_CACHE_TTL) {
				setData(cached.data);
				setLastUpdated(cached.timestamp);
				return;
			}
		}

		const myReqId = ++overviewReqIdRef.current;
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
					setOverviewCache(competitionId, overview);
					setLastUpdated(Date.now());
				}
				setData(overview);
			})
			.catch(() => {})
			.finally(() => {
				if (myReqId === overviewReqIdRef.current) setLoading(false);
			});
	}, [competitionId, enabled]);

	useEffect(() => {
		fetchOverview();
	}, [fetchOverview]);

	const refresh = useCallback(() => fetchOverview(true), [fetchOverview]);

	return {data, loading, lastUpdated, refresh};
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
		setData(null);
		setLastUpdated(null);
		setLastError(null);

		if (!enabled || !competitionId || !liveRoundId) {
			setLoading(false);
			return;
		}

		const myRequestId = ++requestIdRef.current;
		setLoading(true);
		doFetch(myRequestId);

		return () => {
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [competitionId, liveRoundId, enabled, doFetch]);

	// Polling: SADECE active round'da
	useEffect(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		if (!enabled || !data?.active || data?.finished) return;

		intervalRef.current = setInterval(() => {
			gqlQueryTyped(
				WcaLiveRoundResultsDocument,
				{input: {competitionId, liveRoundId: liveRoundId!}},
				{fetchPolicy: 'no-cache'}
			)
				.then((res) => {
					const result = res?.data?.wcaLiveRoundResults || null;
					if (result) {
						setData(result);
						setLastUpdated(Date.now());
						setLastError(null);
					}
				})
				.catch(() => {
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
