import {useEffect, useState} from 'react';
import {socketClient} from '../../../util/socket/socketio';
import {BattleClientEvent, type SearchingCountAck} from '../../../../shared/battle/events';

/** The landing card asks this often while it is on screen (design 5.2). */
export const SEARCHING_COUNT_POLL_MS = 10000;

/**
 * "Searching now: N" for the Online Battle card on /battle (design 5.2).
 *
 * Asked over the socket with an ack, not GraphQL. Returns null until the first answer and
 * while inactive; the card hides the line for null and for 0 so an empty queue does not
 * greet the visitor. The server only answers a logged-in socket.
 */
export function useSearchingCount(active: boolean): number | null {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		if (!active) {
			setCount(null);
			return;
		}
		const socket = socketClient();
		if (!socket) return;
		let alive = true;
		const ask = () => {
			if (!socket.connected) return;
			socket.emit(BattleClientEvent.SEARCHING_COUNT, {}, (ack: SearchingCountAck) => {
				const n = Number(ack?.searchingCount);
				if (alive && Number.isFinite(n)) setCount(Math.max(0, Math.floor(n)));
			});
		};
		ask();
		socket.on('connect', ask);
		const id = setInterval(ask, SEARCHING_COUNT_POLL_MS);
		return () => {
			alive = false;
			clearInterval(id);
			socket.off('connect', ask);
		};
	}, [active]);

	return count;
}
