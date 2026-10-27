import {
	addJoinRequest,
	clearJoinApproval,
	grantJoinApproval,
	hasJoinApproval,
	listJoinRequests,
	removeJoinRequestsBySocket,
	takeJoinRequest,
	toPublicRequests,
} from '../join_requests';
import {FriendlyRoomConst} from '../../../shared/friendly_room/consts';

// In-memory stand-in for the handful of ioredis calls the module makes.
const hashes = new Map<string, Map<string, string>>();
const strings = new Map<string, string>();

jest.mock('../../services/redis', () => {
	const actual = jest.requireActual('../../services/redis');
	const client = {
		hset: async (key: string, field: string, value: string) => {
			if (!hashes.has(key)) hashes.set(key, new Map());
			hashes.get(key)!.set(field, value);
		},
		hget: async (key: string, field: string) => hashes.get(key)?.get(field) ?? null,
		hdel: async (key: string, ...fields: string[]) => fields.forEach((f) => hashes.get(key)?.delete(f)),
		hgetall: async (key: string) => Object.fromEntries(hashes.get(key) ?? []),
		pexpire: async () => 1,
	};
	return {
		...actual,
		getRedisPubClient: () => client,
		setKeyInRedis: async ({key}: {key: string}, value: string) => strings.set(key, value),
		keyExistsInRedis: async ({key}: {key: string}) => (strings.has(key) ? 1 : 0),
		deleteKeyInRedis: async ({key}: {key: string}) => strings.delete(key),
	};
});

function request(userId: string, socketId: string, requestedAt = Date.now()) {
	return {user_id: userId, username: userId, socket_id: socketId, requested_at: requestedAt};
}

beforeEach(() => {
	hashes.clear();
	strings.clear();
});

describe('join requests', () => {
	it('keeps two simultaneous requests apart and lists them oldest first', async () => {
		await addJoinRequest('room1', request('b', 's-b', 2000 + Date.now()));
		await addJoinRequest('room1', request('a', 's-a', 1000 + Date.now()));
		const list = await listJoinRequests('room1');
		expect(list.map((r) => r.user_id)).toEqual(['a', 'b']);
	});

	it('replaces a repeated request from the same user with the newer socket', async () => {
		await addJoinRequest('room1', request('a', 'old'));
		await addJoinRequest('room1', request('a', 'new'));
		const list = await listJoinRequests('room1');
		expect(list).toHaveLength(1);
		expect(list[0].socket_id).toBe('new');
	});

	it('drops requests older than the TTL', async () => {
		await addJoinRequest('room1', request('stale', 's1', Date.now() - FriendlyRoomConst.JOIN_REQUEST_TTL_MS - 1));
		await addJoinRequest('room1', request('fresh', 's2'));
		expect((await listJoinRequests('room1')).map((r) => r.user_id)).toEqual(['fresh']);
		expect(await takeJoinRequest('room1', 'stale')).toBeNull();
	});

	it('takes a request exactly once', async () => {
		await addJoinRequest('room1', request('a', 's1'));
		expect((await takeJoinRequest('room1', 'a'))?.socket_id).toBe('s1');
		expect(await takeJoinRequest('room1', 'a')).toBeNull();
	});

	it('withdraws only the disconnected socket\'s request', async () => {
		await addJoinRequest('room1', request('a', 'gone'));
		await addJoinRequest('room1', request('b', 'alive'));
		expect(await removeJoinRequestsBySocket('room1', 'gone')).toBe(true);
		expect((await listJoinRequests('room1')).map((r) => r.user_id)).toEqual(['b']);
		expect(await removeJoinRequestsBySocket('room1', 'gone')).toBe(false);
	});

	it('never shows managers the requester\'s socket id', () => {
		const [shown] = toPublicRequests([request('a', 'secret-socket')]);
		expect(shown).not.toHaveProperty('socket_id');
		expect(shown.username).toBe('a');
	});
});

describe('join approvals', () => {
	it('is per room and per user, and clears', async () => {
		await grantJoinApproval('room1', 'a');
		expect(await hasJoinApproval('room1', 'a')).toBe(true);
		expect(await hasJoinApproval('room1', 'b')).toBe(false);
		expect(await hasJoinApproval('room2', 'a')).toBe(false);
		await clearJoinApproval('room1', 'a');
		expect(await hasJoinApproval('room1', 'a')).toBe(false);
	});
});
