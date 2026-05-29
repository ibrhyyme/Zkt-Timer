import { getSocketIO } from './socket';
import { RemoteSocket, Socket } from 'socket.io';
import { createRedisKey, getValueFromRedis, keyExistsInRedis, RedisNamespace, setKeyInRedis } from './redis';
import { getMeWithCookieString } from '../util/auth';
import { PublicUserAccount } from '../schemas/UserAccount.schema';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';

export type SocketType = Socket | RemoteSocket<DefaultEventsMap, any>;

function rehydrateUserDates(user: any): void {
	if (user.created_at && typeof user.created_at === 'string') user.created_at = new Date(user.created_at);
	if (user.last_solve_at && typeof user.last_solve_at === 'string') user.last_solve_at = new Date(user.last_solve_at);
	if (user.banned_until && typeof user.banned_until === 'string') user.banned_until = new Date(user.banned_until);
	if (user.pro_expires_at && typeof user.pro_expires_at === 'string') user.pro_expires_at = new Date(user.pro_expires_at);
	if (user.premium_expires_at && typeof user.premium_expires_at === 'string') user.premium_expires_at = new Date(user.premium_expires_at);
	if (user.profile?.created_at && typeof user.profile.created_at === 'string') {
		user.profile.created_at = new Date(user.profile.created_at);
	}
}

export function getBasicUser(user: PublicUserAccount): PublicUserAccount {
	const {
		id,
		admin,
		mod,
		is_pro,
		is_premium,
		last_solve_at,
		username,
		banned_forever,
		banned_until,
		created_at,
		verified,
		badges,
	} = user;
	const { id: profileId, pfp_image, top_solves, top_averages } = user.profile;

	return {
		id,
		username,
		admin,
		mod,
		is_pro,
		is_premium,
		banned_forever,
		last_solve_at,
		banned_until,
		created_at,
		verified,
		badges,
		// PublicUserFragment requires integrations and the schema defines it as non-nullable.
		// To avoid a DB hit in the socket context, return an empty array.
		integrations: [],
		profile: {
			id: profileId,
			user_id: id,
			pfp_image,
			top_solves,
			top_averages,
			created_at: user.created_at,
		},
	};
}

export type DetailedClientInfo = {
	client: SocketType;
	user: PublicUserAccount;
};

export async function getClientById(id: string): Promise<SocketType> {
	const clients = await getSocketIO().in(id).fetchSockets();

	if (!clients || !clients.length) {
		return null;
	}

	return clients.at(0);
}

export async function getDetailedClientInfo(client: SocketType): Promise<DetailedClientInfo> {
	const user = await getUserFromClient(client);

	return {
		client,
		user,
	};
}

export async function getClientsInRoom(room: string) {
	return getSocketIO().in(room).fetchSockets();
}

export async function getClientIdsInRoom(room: string) {
	return getSocketIO().in(room).allSockets();
}

export function updateMyRooms(client: SocketType) {
	const rooms = getClientRooms(client);

	getSocketIO().to(client.id).emit('myRoomsUpdated', rooms);
}

export function joinRoom(client: SocketType, room: string) {
	getSocketIO().in(client.id).socketsJoin(room);
	client.join(room);

	updateMyRooms(client);
}

export function leaveRoom(client: SocketType, room: string) {
	getSocketIO().in(client.id).socketsLeave(room);
	client.leave(room);
	updateMyRooms(client);
}

export async function getUserFromClient(client: SocketType): Promise<PublicUserAccount> {
	if (!client) {
		return null;
	}

	const redisKey = createRedisKey(RedisNamespace.SOCKET_IO_CLIENT_USER, client.id);
	const existsInRedis = await keyExistsInRedis(redisKey);

	// Set the user in Redis if it doesn't exist
	if (!existsInRedis) {
		const user = await getMeWithCookieString(client.handshake.headers.cookie);
		if (!user) {
			return null;
		}

		const basicUser = getBasicUser(user);

		// Two days in seconds
		const ONE_DAY_IN_SECONDS = 60 * 60 * 24;

		await setKeyInRedis(
			createRedisKey(RedisNamespace.SOCKET_IO_CLIENT_USER, client.id),
			JSON.stringify(basicUser),
			ONE_DAY_IN_SECONDS
		);

		return basicUser;
	}

	const userJson = await getValueFromRedis(createRedisKey(RedisNamespace.SOCKET_IO_CLIENT_USER, client.id));
	return JSON.parse(userJson);
}

export async function getUsersInRoom(room: string) {
	const users: PublicUserAccount[] = [];
	const clientsInRoom = await getClientsInRoom(room);
	for (const client of clientsInRoom) {
		const { user } = await getDetailedClientInfo(client);
		users.push(user);
	}

	return users;
}

export function getAllRooms() {
	return getSocketIO().sockets.adapter.rooms;
}

export type OnlineCounts = {
	totalSockets: number;
	uniqueUsers: number;
	anonymous: number;
};

export async function getOnlineCounts(): Promise<OnlineCounts> {
	const sockets = await getSocketIO().fetchSockets();
	const userIds = new Set<string>();
	let anonymous = 0;

	for (const s of sockets) {
		const uid = (s as any).data?.userId ?? (s as any).userId;
		if (uid) {
			userIds.add(uid);
		} else {
			anonymous++;
		}
	}

	return {
		totalSockets: sockets.length,
		uniqueUsers: userIds.size,
		anonymous,
	};
}

export type OnlineUserEntry = {
	user: PublicUserAccount;
	tabCount: number;
};

export const ADMIN_ONLINE_WATCHERS_ROOM = 'admin:online-watchers';

// Disconnects all socket connections for a user. Used during logout / ban / account deletion flows
// to prevent "ghost online user" states. Best-effort, does not throw errors.
export async function disconnectUserSockets(userId: string): Promise<void> {
	try {
		const io = getSocketIO();
		if (!io || !userId) return;
		const sockets = await io.fetchSockets();
		for (const s of sockets) {
			const uid = (s as any).data?.userId ?? (s as any).userId;
			if (uid === userId) {
				s.disconnect(true);
			}
		}
	} catch {
		// best-effort
	}
}

let broadcastDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const BROADCAST_DEBOUNCE_MS = 500;

export function broadcastOnlineUsersChanged(): void {
	if (broadcastDebounceTimer) {
		clearTimeout(broadcastDebounceTimer);
	}
	broadcastDebounceTimer = setTimeout(async () => {
		broadcastDebounceTimer = null;
		try {
			const io = getSocketIO();
			if (!io) return;
			const room = io.in(ADMIN_ONLINE_WATCHERS_ROOM);
			const sockets = await room.fetchSockets();
			if (sockets.length === 0) return;
			const users = await getOnlineUsers();
			io.to(ADMIN_ONLINE_WATCHERS_ROOM).emit('admin:online_users_changed', users);
		} catch {
			// Silently suppress errors on broadcast — broadcast is best-effort
		}
	}, BROADCAST_DEBOUNCE_MS);
}

export async function getOnlineUsers(): Promise<OnlineUserEntry[]> {
	const sockets = await getSocketIO().fetchSockets();
	const byUserId = new Map<string, { user: PublicUserAccount; tabCount: number }>();

	for (const s of sockets) {
		const uid = (s as any).data?.userId ?? (s as any).userId;
		if (!uid) {
			continue;
		}

		const existing = byUserId.get(uid);
		if (existing) {
			existing.tabCount++;
			continue;
		}

		const redisKey = createRedisKey(RedisNamespace.SOCKET_IO_CLIENT_USER, s.id);
		const userJson = await getValueFromRedis(redisKey);
		if (!userJson) {
			continue;
		}

		try {
			const user = JSON.parse(userJson) as PublicUserAccount;
			// Older cache entries may not have integrations/badges — fill with empty arrays
			// to avoid schema violations for non-null fields.
			if (!user.integrations) user.integrations = [];
			if (!user.badges) user.badges = [];
			// JSON.parse leaves Date fields as strings — type-graphql "@Field() Date"
			// doesn't accept strings, so manually hydrate with new Date().
			rehydrateUserDates(user);
			byUserId.set(uid, { user, tabCount: 1 });
		} catch {
			// Corrupted cache entry — skip
		}
	}

	return Array.from(byUserId.values());
}

// All the rooms a client is in
export function getClientRooms(client: SocketType): string[] {
	if (!client || !client.rooms) {
		return [];
	}

	return Array.from(client.rooms);
}

export async function getRoomSize(room: string) {
	const clientsInRoom = await getClientsInRoom(room);
	return clientsInRoom.length;
}

export function isClientInRoom(client: Socket, room: string) {
	return getClientRooms(client).includes(room);
}

// Returns true if a user exists in a room
export async function userExistsInRoom(user: PublicUserAccount, room: string): Promise<boolean> {
	const usersInRoom = await getUsersInRoom(room);
	return usersInRoom.some((u) => u.id === user.id);
}
