import Redis from 'ioredis';
import {logger} from './logger';
import Redlock, {Lock} from 'redlock';

let redlock: Redlock;
let redisPubClient: Redis;
let redisSubClient: Redis;

export enum RedisNamespace {
	PRO_DATA = 'cd:pro',
	PLAY = 'cd:play',
	SITEMAP = 'cd:site:sitemap_lock',
	MATCH_CACHE = 'cd:match:cache',
	MATCH_ACTIVITY = 'cd:match:activity',
	SOCKET_IO_CLIENT_USER = 'cd:socketio:client:user',
	TRAINER_DATA = 'cd:trainerdata',
	TRAINER_DATA_DATE = 'cd:trainerdata:date',
	WCA_COMPETITIONS = 'cd:wca:competitions',
	WCA_RESULTS = 'cd:wca:results',
	WCA_WCIF = 'cd:wca:wcif',
	WCA_COMP_INFO = 'cd:wca:compinfo',
	WCA_WORLD_RECORDS = 'cd:wca:worldrecords',
	ZKT_COMP_LIST = 'cd:zktcomp:list',
	ZKT_COMP_DETAIL = 'cd:zktcomp:detail',
	ZKT_RECORDS = 'cd:zktcomp:records',
	// Federation (zekakuputurkiye) public-read consumer cache — separate from the
	// legacy local management namespaces above so both can coexist during Phase A.
	ZKT_FED_LIST = 'cd:zktfed:list',
	ZKT_FED_WCIF = 'cd:zktfed:wcif',
	ZKT_FED_DETAIL = 'cd:zktfed:detail',
	ZKT_FED_RESULTS = 'cd:zktfed:results',
	ZKT_FED_GROUP = 'cd:zktfed:group',
	ZKT_FED_COMPETITOR = 'cd:zktfed:competitor',
	ZKT_FED_COMP_RECORDS = 'cd:zktfed:comprecords',
	ZKT_FED_RECENT_RECORDS = 'cd:zktfed:recentrecords',
	ZKT_FED_MY_COMPS = 'cd:zktfed:mycomps',
	ZKT_FED_PERSON = 'cd:zktfed:person',
	// Competition lifecycle notifications: cron locks, discovery gates and the
	// crons' own caches (never the page's WCIF key, see cron_competition_lifecycle.ts).
	COMPETITION_LIFECYCLE = 'cd:lifecycle',
	IAP_EVENTS = 'cd:iap:events',
	FRIENDLY_ROOM_SESSION = 'cd:friendly_room:session',
	// Pending requests to join a full room (hash per room, field per user) and the one-shot
	// approval a manager's "accept" leaves behind. See friendly_room/join_requests.ts.
	FRIENDLY_ROOM_JOIN_REQUESTS = 'cd:friendly_room:join_requests',
	FRIENDLY_ROOM_JOIN_APPROVAL = 'cd:friendly_room:join_approval',
	SUPPORT_TICKET_RATE = 'cd:support:rate',
	NATIVE_MIGRATE_STASH = 'cd:native_migrate:stash',
	NATIVE_MIGRATE_RATE = 'cd:native_migrate:rate',
	// Online Battle leaderboard pages (server/models/battle.ts), 60 s.
	BATTLE_LEADERBOARD = 'cd:battle:leaderboard',
	// Online Battle realtime (server/battle). Queue: sorted set per puzzle (score = rating)
	// plus a meta hash; the matcher's lock; one JSON snapshot per running match; the
	// one-queue-or-one-match session per user; abandon cooldowns; the last opponent; and a
	// short tombstone so a reconnect learns why its match ended.
	BATTLE_QUEUE = 'cd:battle:queue',
	BATTLE_QUEUE_META = 'cd:battle:queue_meta',
	BATTLE_MATCHER_LOCK = 'cd:battle:matcher',
	BATTLE_MATCH = 'cd:battle:match',
	BATTLE_SESSION = 'cd:battle:session',
	BATTLE_COOLDOWN = 'cd:battle:cooldown',
	BATTLE_ABANDONS = 'cd:battle:abandons',
	BATTLE_RECENT_OPPONENT = 'cd:battle:recent_opponent',
	BATTLE_ENDED = 'cd:battle:ended',
}

export type generatedRedisKey = {
	key: string;
};

export function createRedisKey(redisKey: RedisNamespace, hash: string = ''): generatedRedisKey {
	return {
		key: `${redisKey}#${hash}`,
	};
}

export async function fetchDataFromCache<T>(
	redisKey: generatedRedisKey,
	callback: () => Promise<T>,
	expireSeconds: number
): Promise<T> {
	const processStart = Date.now();
	const redisData = await getValueFromRedis(redisKey);

	let output: T;
	let cacheHit = false;

	if (redisData) {
		cacheHit = true;

		output = JSON.parse(redisData);
	} else {
		output = await callback();
		await setKeyInRedis(redisKey, JSON.stringify(output), expireSeconds);
	}

	logger.debug(`Redis cache ${cacheHit ? 'HIT' : 'MISS'}`, {
		redisKey: redisKey.key,
		processTime: Date.now() - processStart,
	});

	return output;
}

export async function initRedisClient() {
	redisPubClient = new Redis(process.env.REDIS_URL);
	redisSubClient = redisPubClient.duplicate();

	const clientConnectionPromise = [
		new Promise((resolve, reject) => {
			redisPubClient.on('connect', resolve);
			redisPubClient.on('error', (err) => reject(err));
		}),
		new Promise((resolve, reject) => {
			redisSubClient.on('connect', resolve);
			redisSubClient.on('error', (err) => reject(err));
		}),
	];

	logger.debug('Attempting to connect Redis client');
	await Promise.all(clientConnectionPromise);
	connectRedisLock();
	logger.debug('Redis client connected successfully.');
}

function connectRedisLock() {
	redlock = new Redlock([redisPubClient], {
		driftFactor: 0.01,
		retryCount: 0,
		retryJitter: 200,
		automaticExtensionThreshold: 500,
	});
}

export async function acquireRedisLock(redisKey: generatedRedisKey, durationMs: number): Promise<Lock> {
	try {
		return await redlock.acquire([redisKey.key], durationMs);
	} catch (e) {
		return null;
	}
}

export function getRedisPubClient() {
	return redisPubClient;
}

export function getRedisSubClient() {
	return redisSubClient;
}

export async function keyExistsInRedis({key}: generatedRedisKey): Promise<number> {
	const client = getRedisPubClient();
	return client.exists(key);
}

export async function getValueFromRedis({key}: generatedRedisKey): Promise<string> {
	const client = getRedisPubClient();
	return client.get(key);
}

export async function getKeyTTLFromRedis({key}: generatedRedisKey): Promise<number> {
	const client = getRedisPubClient();
	return client.ttl(key);
}

export async function setKeyInRedis({key}: generatedRedisKey, value: string, expireSeconds?: number): Promise<string> {
	const client = getRedisPubClient();
	const res = await client.set(key, value);
	if (expireSeconds) {
		await client.expire(key, expireSeconds);
	}
	return res;
}

export async function deleteKeyInRedis({key}: generatedRedisKey): Promise<number> {
	const client = getRedisPubClient();
	return client.del(key);
}
