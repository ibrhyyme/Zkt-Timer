import { Server } from 'socket.io';
import { getRedisPubClient, getRedisSubClient } from './redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { listenForFriendlyRoomEvents } from '../friendly_room';
import { listenForZktCompEvents } from '../zkt_competition';
import { getUserFromClient } from './socket_util';

let io: Server;

export function initSocket(server: any) {
	io = new Server(server, {
		cors: {
			origin: '*',
		},
	});

	const socketAdaptor = createAdapter(getRedisPubClient(), getRedisSubClient());
	io.adapter(socketAdaptor as any);

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
	});
}

export function getSocketIO() {
	return io;
}
