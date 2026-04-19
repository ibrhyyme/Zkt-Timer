import {useEffect, useRef} from 'react';
import {socketClient} from '../../../util/socket/socketio';
import {
	ZktCompClientEvent,
	ZktCompServerEvent,
} from '../../../../shared/zkt_competition/events';

/**
 * Subscribe to all Socket.IO events for a specific competition and invoke
 * the refetch callback whenever anything changes. Debounced to 200ms so
 * rapid bursts (e.g. batch result submit) coalesce into one refetch.
 *
 * Pass `null` competitionId to temporarily disable.
 */
export function useZktCompRefetch(
	competitionId: string | null | undefined,
	refetch: () => void
) {
	const debounceRef = useRef<number | null>(null);
	const refetchRef = useRef(refetch);
	refetchRef.current = refetch;

	useEffect(() => {
		if (!competitionId) return;

		const socket = socketClient();
		socket.emit(ZktCompClientEvent.JOIN_COMP, competitionId);

		const trigger = () => {
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
			debounceRef.current = window.setTimeout(() => {
				refetchRef.current();
			}, 200);
		};

		const EVENTS = [
			ZktCompServerEvent.RESULT_UPDATED,
			ZktCompServerEvent.RESULT_DELETED,
			ZktCompServerEvent.ROUND_STATUS_CHANGED,
			ZktCompServerEvent.COMP_STATUS_CHANGED,
			ZktCompServerEvent.REGISTRATION_UPDATED,
			ZktCompServerEvent.ASSIGNMENT_UPDATED,
		];
		EVENTS.forEach((ev) => socket.on(ev, trigger));

		return () => {
			EVENTS.forEach((ev) => socket.off(ev, trigger));
			socket.emit(ZktCompClientEvent.LEAVE_COMP, competitionId);
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
		};
	}, [competitionId]);
}

/**
 * Subscribe to the global ZKT competition list room. Fires the refetch
 * whenever a competition is created, updated, or deleted. For admin listing
 * and the public "All competitions" page.
 */
export function useZktCompListRefetch(refetch: () => void) {
	const debounceRef = useRef<number | null>(null);
	const refetchRef = useRef(refetch);
	refetchRef.current = refetch;

	useEffect(() => {
		const socket = socketClient();
		socket.emit(ZktCompClientEvent.JOIN_LIST);

		const trigger = () => {
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
			debounceRef.current = window.setTimeout(() => {
				refetchRef.current();
			}, 200);
		};

		socket.on(ZktCompServerEvent.LIST_CHANGED, trigger);

		return () => {
			socket.off(ZktCompServerEvent.LIST_CHANGED, trigger);
			socket.emit(ZktCompClientEvent.LEAVE_LIST);
			if (debounceRef.current) window.clearTimeout(debounceRef.current);
		};
	}, []);
}
