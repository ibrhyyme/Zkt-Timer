/**
 * Online Battle storage and clock seams (design ranking-battle.md 4.2, 4.6, 4.8).
 *
 * The queue, the sessions and the match snapshots live in Redis. The realtime code talks
 * to it through this small interface so the tests can run the whole flow against an
 * in-memory store and a fake clock (server/battle/testing). Production uses the Redis
 * implementation below and the real clock.
 *
 * Keys follow the project's createRedisKey format: `<namespace>#<hash>`.
 */

import {acquireRedisLock, createRedisKey, getRedisPubClient, RedisNamespace} from '../services/redis';

export interface BattleStore {
	get(key: string): Promise<string | null>;
	/** ttlSec omitted: no expiry. */
	set(key: string, value: string, ttlSec?: number): Promise<void>;
	del(key: string): Promise<number>;
	/** Seconds left, -1 without expiry, -2 when the key does not exist. */
	ttl(key: string): Promise<number>;
	/** Increments a counter; the expiry is set when the counter is created. */
	incr(key: string, ttlSec: number): Promise<number>;
	zadd(key: string, score: number, member: string): Promise<void>;
	/** 1 when the member was removed, 0 when it was not there. */
	zrem(key: string, member: string): Promise<number>;
	zrangeWithScores(key: string): Promise<Array<{member: string; score: number}>>;
	zcard(key: string): Promise<number>;
	hset(key: string, field: string, value: string): Promise<void>;
	hget(key: string, field: string): Promise<string | null>;
	hdel(key: string, field: string): Promise<number>;
	hgetall(key: string): Promise<Record<string, string>>;
	/** Every key matching a glob pattern (SCAN, never KEYS). */
	scanKeys(pattern: string): Promise<string[]>;
	/**
	 * Runs fn only when the lock was acquired (Redlock, no retry). Returns false when another
	 * process holds it.
	 */
	withLock(key: string, durationMs: number, fn: () => Promise<void>): Promise<boolean>;
}

export type TimerHandle = unknown;

export interface BattleClock {
	now(): number;
	setTimeout(fn: () => void, ms: number): TimerHandle;
	clearTimeout(handle: TimerHandle): void;
	setInterval(fn: () => void, ms: number): TimerHandle;
	clearInterval(handle: TimerHandle): void;
}

export const realClock: BattleClock = {
	now: () => Date.now(),
	setTimeout: (fn, ms) => setTimeout(fn, Math.max(0, ms)),
	clearTimeout: (h) => clearTimeout(h as NodeJS.Timeout),
	setInterval: (fn, ms) => setInterval(fn, ms),
	clearInterval: (h) => clearInterval(h as NodeJS.Timeout),
};

/** Full Redis key for a battle namespace. */
export function battleKey(namespace: RedisNamespace, hash: string = ''): string {
	return createRedisKey(namespace, hash).key;
}

/** Glob that matches every key of a namespace. */
export function battleKeyPattern(namespace: RedisNamespace): string {
	return `${namespace}#*`;
}

/** Hash part of a full key (`<namespace>#<hash>`). */
export function keyHash(key: string): string {
	const i = key.indexOf('#');
	return i < 0 ? key : key.slice(i + 1);
}

export function createRedisBattleStore(): BattleStore {
	const r = () => getRedisPubClient();

	return {
		async get(key) {
			return (await r().get(key)) ?? null;
		},
		async set(key, value, ttlSec) {
			if (ttlSec && ttlSec > 0) await r().set(key, value, 'EX', Math.ceil(ttlSec));
			else await r().set(key, value);
		},
		async del(key) {
			return r().del(key);
		},
		async ttl(key) {
			return r().ttl(key);
		},
		async incr(key, ttlSec) {
			const n = await r().incr(key);
			if (n === 1) await r().expire(key, Math.ceil(ttlSec));
			return n;
		},
		async zadd(key, score, member) {
			await r().zadd(key, score, member);
		},
		async zrem(key, member) {
			return r().zrem(key, member);
		},
		async zrangeWithScores(key) {
			const flat = await r().zrange(key, 0, -1, 'WITHSCORES');
			const out: Array<{member: string; score: number}> = [];
			for (let i = 0; i + 1 < flat.length; i += 2) out.push({member: flat[i], score: Number(flat[i + 1])});
			return out;
		},
		async zcard(key) {
			return r().zcard(key);
		},
		async hset(key, field, value) {
			await r().hset(key, field, value);
		},
		async hget(key, field) {
			return (await r().hget(key, field)) ?? null;
		},
		async hdel(key, field) {
			return r().hdel(key, field);
		},
		async hgetall(key) {
			return (await r().hgetall(key)) || {};
		},
		async scanKeys(pattern) {
			const keys: string[] = [];
			let cursor = '0';
			do {
				const [next, batch] = await r().scan(cursor, 'MATCH', pattern, 'COUNT', 200);
				cursor = next;
				keys.push(...batch);
			} while (cursor !== '0');
			return Array.from(new Set(keys));
		},
		async withLock(key, durationMs, fn) {
			const lock = await acquireRedisLock({key}, durationMs);
			if (!lock) return false;
			try {
				await fn();
			} finally {
				await lock.release().catch((): void => undefined);
			}
			return true;
		},
	};
}
