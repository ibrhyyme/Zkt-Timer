import { Server } from 'socket.io';
import { getRedisPubClient, getRedisSubClient } from './redis';
import { createAdapter } from '@socket.io/redis-adapter';
import { listenForFriendlyRoomEvents } from '../friendly_room';
import { listenForZktCompEvents } from '../zkt_competition';
import { getUserFromClient, broadcastOnlineUsersChanged, ADMIN_ONLINE_WATCHERS_ROOM, getOnlineUsers } from './socket_util';
import { subscribeRound, unsubscribeRound, unsubscribeAllRounds, setPollerIOGetter } from './WcaLivePoller';

let io: Server;

// Cross-Site WebSocket Hijacking koruma: sadece bilinen origin'lerden baglanti kabul et
// Capacitor mobile origin'leri: iOS WKWebView "capacitor://localhost",
// Android "https://localhost" / "http://localhost" / Capacitor v6 default'larina gore
const ALLOWED_SOCKET_ORIGINS = process.env.NODE_ENV === 'production'
	? [
		'https://zktimer.app',
		'https://www.zktimer.app',
		'capacitor://localhost',
		'http://localhost',
		'https://localhost',
		'ionic://localhost',
	]
	: [
		'http://localhost:3000',
		'http://localhost:8100',
		'http://localhost:5173',
		'capacitor://localhost',
		'https://localhost',
	];

export function initSocket(server: any) {
	io = new Server(server, {
		cors: {
			origin: (origin, callback) => {
				// Origin yoksa native app baglantisi olabilir — gec
				if (!origin) return callback(null, true);
				if (ALLOWED_SOCKET_ORIGINS.includes(origin)) return callback(null, true);
				return callback(new Error('CORS: origin not allowed'));
			},
			credentials: true,
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
