import { Server } from 'socket.io';
import { getRedisPubClient, getRedisSubClient } from './redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { listenForFriendlyRoomEvents } from '../friendly_room';

let io: Server;

export function initSocket(server: any) {
	io = new Server(server, {
		cors: {
			origin: '*',
		},
	});

	const socketAdaptor = createAdapter(getRedisPubClient(), getRedisSubClient());
	io.adapter(socketAdaptor as any);

	io.sockets.on('connection', (client) => {
		// Friendly Room events
		listenForFriendlyRoomEvents(client);
	});
}

export function getSocketIO() {
	return io;
}
