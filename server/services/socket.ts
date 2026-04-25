import { Server } from 'socket.io';
import { getRedisPubClient, getRedisSubClient } from './redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { listenForFriendlyRoomEvents } from '../friendly_room';
import { listenForZktCompEvents } from '../zkt_competition';
import { getUserFromClient } from './socket_util';
import { subscribeRound, unsubscribeRound, unsubscribeAllRounds, setPollerIOGetter } from './WcaLivePoller';

let io: Server;

export function initSocket(server: any) {
	io = new Server(server, {
		cors: {
			origin: '*',
		},
	});

	const socketAdaptor = createAdapter(getRedisPubClient(), getRedisSubClient());
	io.adapter(socketAdaptor as any);

	setPollerIOGetter(() => io);

	io.sockets.on('connection', async (client) => {
		// Online sayaci icin userId attach et (anonymous ise null kalir)
		try {
			const user = await getUserFromClient(client);
			if (user) {
				(client as any).userId = user.id;
				client.data.userId = user.id;
			}
		} catch (err) {
			// Auth fail durumunda anonymous olarak devam
		}

		// Friendly Room events
		listenForFriendlyRoomEvents(client);

		// ZKT Unofficial Competition events
		listenForZktCompEvents(client);

		// WCA Live round subscription
		client.on('wca-live:subscribe', ({competitionId, liveRoundId}: {competitionId: string; liveRoundId: string}) => {
			if (!client.data.userId || !competitionId || !liveRoundId) return;
			client.join(`wca-live-round:${liveRoundId}`);
			subscribeRound(client.id, competitionId, liveRoundId);
		});

		client.on('wca-live:unsubscribe', ({liveRoundId}: {liveRoundId: string}) => {
			if (!liveRoundId) return;
			client.leave(`wca-live-round:${liveRoundId}`);
			unsubscribeRound(client.id, liveRoundId);
		});

		client.on('disconnect', () => {
			unsubscribeAllRounds(client.id);
		});
	});
}

export function getSocketIO() {
	return io;
}
