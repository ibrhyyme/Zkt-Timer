import {useEffect, useRef, useState, useCallback} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {PublicCompetitor} from './shared';

// Live round results from the federation public API. Each row already carries
// ranking + record tags + the three-state advancement (advancing / clinched /
// questionable) computed by the federation — the single source of truth — so the
// consumer only renders. Competitors are opaque-keyed.
const ROUND_RESULTS = gql`
	query ZktPublicRoundResults($competitionId: String!, $roundId: String!) {
		zktPublicRoundResults(competitionId: $competitionId, roundId: $roundId) {
			roundId
			status
			results {
				competitor {
					id
					name
					wcaId
					externalId
					country
					avatarUrl
					isGhost
				}
				ranking
				attempts
				best
				average
				recordTags {
					single
					average
				}
				advancing
				clinched
				questionable
			}
		}
	}
`;

export interface LiveResult {
	competitor: PublicCompetitor;
	ranking?: number | null;
	attempts: number[]; // raw cs (DNF=-1, DNS=-2, empty=0), length = format attempt count
	best?: number | null;
	average?: number | null;
	recordTags?: {single?: string | null; average?: string | null};
	advancing: boolean;
	clinched: boolean;
	questionable: boolean;
}

/**
 * Subscribe to a round's live results. The federation real-time socket push is a
 * later phase; until then a 10-second polling interval (only while a round is
 * selected and the tab is visible) keeps the scoreboard converging. The server
 * Redis-caches live rounds ~15s so this stays cheap.
 *
 * `competitionId` may be the competition slug or UUID — the federation accepts
 * either. Pass `null` until it is known (no-op).
 */
export function useZktLiveResults(competitionId: string | null, roundId: string | null) {
	const [results, setResults] = useState<LiveResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<number>(0);
	const currentRoundId = useRef<string | null>(null);

	const fetchResults = useCallback(
		async (rid: string) => {
			if (!competitionId) return;
			setLoading(true);
			try {
				const res = await gqlMutate(ROUND_RESULTS, {competitionId, roundId: rid});
				if (currentRoundId.current === rid) {
					setResults((res?.data?.zktPublicRoundResults?.results || []) as LiveResult[]);
					setLastUpdated(Date.now());
				}
			} catch {
				// ignore — a transient failure just keeps the last snapshot
			} finally {
				if (currentRoundId.current === rid) setLoading(false);
			}
		},
		[competitionId]
	);

	// Initial fetch + refetch on round change
	useEffect(() => {
		currentRoundId.current = roundId;
		if (!roundId) {
			setResults([]);
			return;
		}
		fetchResults(roundId);
	}, [roundId, fetchResults]);

	// Polling fallback (10s), visibility-gated so idle traffic stays low.
	useEffect(() => {
		if (!roundId) return;
		let active = document.visibilityState === 'visible';
		const onVis = () => {
			active = document.visibilityState === 'visible';
			if (active) fetchResults(roundId);
		};
		document.addEventListener('visibilitychange', onVis);
		const id = window.setInterval(() => {
			if (active) fetchResults(roundId);
		}, 10000);
		return () => {
			window.clearInterval(id);
			document.removeEventListener('visibilitychange', onVis);
		};
	}, [roundId, fetchResults]);

	const refresh = useCallback(() => {
		if (roundId) fetchResults(roundId);
	}, [roundId, fetchResults]);

	return {results, loading, lastUpdated, refresh};
}
