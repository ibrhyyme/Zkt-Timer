import {useEffect, useRef, useState, useCallback} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import {socketClient} from '../../../util/socket/socketio';
import {
	ZktCompClientEvent,
	ZktCompServerEvent,
} from '../../../../shared/zkt_competition/events';

const ROUND_RESULTS = gql`
	query ZktLiveRoundResults($roundId: String!) {
		zktRoundResults(roundId: $roundId) {
			id
			user_id
			attempt_1
			attempt_2
			attempt_3
			attempt_4
			attempt_5
			best
			average
			ranking
			proceeds
			single_record_tag
			average_record_tag
			user {
				id
				username
				profile {
					pfp_image {
						id
						url
					}
				}
			}
		}
	}
`;

export interface LiveResult {
	id: string;
	user_id: string;
	attempt_1?: number;
	attempt_2?: number;
	attempt_3?: number;
	attempt_4?: number;
	attempt_5?: number;
	best?: number;
	average?: number;
	ranking?: number;
	proceeds: boolean;
	single_record_tag?: string;
	average_record_tag?: string;
	user?: {
		id: string;
		username: string;
		profile?: {pfp_image?: {url: string}};
	};
}

/**
 * Subscribe to live round results.
 * Joins Socket.IO room `zkt_comp_{competitionId}` on mount.
 * Listens for RESULT_UPDATED events and refetches the round's results.
 */
export function useZktLiveResults(competitionId: string, roundId: string | null) {
	const [results, setResults] = useState<LiveResult[]>([]);
	const [loading, setLoading] = useState(false);
	const [lastUpdated, setLastUpdated] = useState<number>(0);
	const currentRoundId = useRef<string | null>(null);

	const fetchResults = useCallback(async (rid: string) => {
		setLoading(true);
		try {
			const res = await gqlMutate(ROUND_RESULTS, {roundId: rid});
			if (currentRoundId.current === rid) {
				setResults(res?.data?.zktRoundResults || []);
				setLastUpdated(Date.now());
			}
		} catch {
			// ignore
		} finally {
			if (currentRoundId.current === rid) setLoading(false);
		}
	}, []);

	// Join/leave competition room
	useEffect(() => {
		if (!competitionId) return;
		const socket = socketClient();
		socket.emit(ZktCompClientEvent.JOIN_COMP, competitionId);
		return () => {
			socket.emit(ZktCompClientEvent.LEAVE_COMP, competitionId);
		};
	}, [competitionId]);

	// Initial fetch + refetch on round change
	useEffect(() => {
		currentRoundId.current = roundId;
		if (!roundId) {
			setResults([]);
			return;
		}
		fetchResults(roundId);
	}, [roundId, fetchResults]);

	// Socket listeners
	useEffect(() => {
		if (!roundId) return;
		const socket = socketClient();

		const onResultUpdated = (payload: {roundId: string}) => {
			if (payload.roundId === roundId) {
				fetchResults(roundId);
			}
		};

		const onResultDeleted = (payload: {roundId: string}) => {
			if (payload.roundId === roundId) {
				fetchResults(roundId);
			}
		};

		const onRoundStatusChanged = (payload: {roundId: string}) => {
			if (payload.roundId === roundId) {
				fetchResults(roundId);
			}
		};

		socket.on(ZktCompServerEvent.RESULT_UPDATED, onResultUpdated);
		socket.on(ZktCompServerEvent.RESULT_DELETED, onResultDeleted);
		socket.on(ZktCompServerEvent.ROUND_STATUS_CHANGED, onRoundStatusChanged);

		return () => {
			socket.off(ZktCompServerEvent.RESULT_UPDATED, onResultUpdated);
			socket.off(ZktCompServerEvent.RESULT_DELETED, onResultDeleted);
			socket.off(ZktCompServerEvent.ROUND_STATUS_CHANGED, onRoundStatusChanged);
		};
	}, [roundId, fetchResults]);

	// Polling fallback — if Socket.IO misses an event (disconnect, proxy
	// issue, browser background throttling), a 10-second interval guarantees
	// results still converge. Only runs while a round is selected and the
	// tab is visible, so idle traffic stays low.
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
