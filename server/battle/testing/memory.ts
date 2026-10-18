/**
 * Test doubles for the Online Battle realtime layer: an in-memory BattleStore with Redis
 * semantics (sorted sets, hashes, TTL, SCAN globs) and a fake clock whose timers fire in
 * order when the test advances time. Kept outside __tests__ because Jest runs every .ts
 * file there as a test.
 */

import {BattleClock, BattleStore, TimerHandle} from '../store';

interface Timer {
	id: number;
	at: number;
	fn: () => void;
	every: number | null;
}

/** Lets pending promise chains settle (several rounds of microtasks and immediates). */
export async function flushAsync(rounds: number = 20): Promise<void> {
	for (let i = 0; i < rounds; i++) {
		await new Promise<void>((resolve) => setImmediate(resolve));
	}
}

export class FakeClock implements BattleClock {
	private t: number;
	private seq = 0;
	private timers = new Map<number, Timer>();

	constructor(start: number = Date.UTC(2026, 9, 7, 12, 0, 0)) {
		this.t = start;
	}

	now(): number {
		return this.t;
	}

	setTimeout(fn: () => void, ms: number): TimerHandle {
		const id = ++this.seq;
		this.timers.set(id, {id, at: this.t + Math.max(0, ms), fn, every: null});
		return id;
	}

	clearTimeout(handle: TimerHandle): void {
		this.timers.delete(handle as number);
	}

	setInterval(fn: () => void, ms: number): TimerHandle {
		const id = ++this.seq;
		this.timers.set(id, {id, at: this.t + ms, fn, every: ms});
		return id;
	}

	clearInterval(handle: TimerHandle): void {
		this.timers.delete(handle as number);
	}

	pendingTimers(): number {
		return this.timers.size;
	}

	/**
	 * Moves time forward, firing every timer that falls due in order and letting the async
	 * work each one starts settle before the next.
	 */
	async advance(ms: number): Promise<void> {
		const end = this.t + ms;
		await flushAsync();
		for (;;) {
			let next: Timer | null = null;
			for (const timer of this.timers.values()) {
				if (timer.at <= end && (!next || timer.at < next.at || (timer.at === next.at && timer.id < next.id))) next = timer;
			}
			if (!next) break;
			this.t = Math.max(this.t, next.at);
			if (next.every != null) next.at += next.every;
			else this.timers.delete(next.id);
			next.fn();
			await flushAsync();
		}
		this.t = end;
		await flushAsync();
	}
}

function globToRegExp(glob: string): RegExp {
	const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
	return new RegExp(`^${escaped}$`);
}

export class MemoryStore implements BattleStore {
	strings = new Map<string, string>();
	zsets = new Map<string, Map<string, number>>();
	hashes = new Map<string, Map<string, string>>();
	private expiry = new Map<string, number>();
	private locks = new Set<string>();

	constructor(private clock: {now(): number}) {}

	private alive(key: string): boolean {
		const exp = this.expiry.get(key);
		if (exp != null && exp <= this.clock.now()) {
			this.strings.delete(key);
			this.zsets.delete(key);
			this.hashes.delete(key);
			this.expiry.delete(key);
			return false;
		}
		return this.strings.has(key) || this.zsets.has(key) || this.hashes.has(key);
	}

	async get(key: string) {
		return this.alive(key) ? this.strings.get(key) ?? null : null;
	}
	async set(key: string, value: string, ttlSec?: number) {
		this.strings.set(key, value);
		if (ttlSec && ttlSec > 0) this.expiry.set(key, this.clock.now() + ttlSec * 1000);
		else this.expiry.delete(key);
	}
	async del(key: string) {
		const existed = this.alive(key);
		this.strings.delete(key);
		this.zsets.delete(key);
		this.hashes.delete(key);
		this.expiry.delete(key);
		return existed ? 1 : 0;
	}
	async ttl(key: string) {
		if (!this.alive(key)) return -2;
		const exp = this.expiry.get(key);
		return exp == null ? -1 : Math.ceil((exp - this.clock.now()) / 1000);
	}
	async incr(key: string, ttlSec: number) {
		const n = (this.alive(key) ? Number(this.strings.get(key)) || 0 : 0) + 1;
		this.strings.set(key, String(n));
		if (n === 1) this.expiry.set(key, this.clock.now() + ttlSec * 1000);
		return n;
	}
	async zadd(key: string, score: number, member: string) {
		this.alive(key);
		let z = this.zsets.get(key);
		if (!z) this.zsets.set(key, (z = new Map()));
		z.set(member, score);
	}
	async zrem(key: string, member: string) {
		const z = this.alive(key) ? this.zsets.get(key) : undefined;
		if (!z || !z.has(member)) return 0;
		z.delete(member);
		if (!z.size) this.zsets.delete(key);
		return 1;
	}
	async zrangeWithScores(key: string) {
		const z = this.alive(key) ? this.zsets.get(key) : undefined;
		if (!z) return [];
		return Array.from(z.entries())
			.map(([member, score]) => ({member, score}))
			.sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : 1));
	}
	async zcard(key: string) {
		return this.alive(key) ? this.zsets.get(key)?.size ?? 0 : 0;
	}
	async hset(key: string, field: string, value: string) {
		this.alive(key);
		let h = this.hashes.get(key);
		if (!h) this.hashes.set(key, (h = new Map()));
		h.set(field, value);
	}
	async hget(key: string, field: string) {
		return this.alive(key) ? this.hashes.get(key)?.get(field) ?? null : null;
	}
	async hdel(key: string, field: string) {
		const h = this.alive(key) ? this.hashes.get(key) : undefined;
		if (!h || !h.has(field)) return 0;
		h.delete(field);
		if (!h.size) this.hashes.delete(key);
		return 1;
	}
	async hgetall(key: string) {
		const h = this.alive(key) ? this.hashes.get(key) : undefined;
		return h ? Object.fromEntries(h.entries()) : {};
	}
	async scanKeys(pattern: string) {
		const re = globToRegExp(pattern);
		const keys = new Set([...this.strings.keys(), ...this.zsets.keys(), ...this.hashes.keys()]);
		return Array.from(keys).filter((k) => re.test(k) && this.alive(k));
	}
	async withLock(key: string, _durationMs: number, fn: () => Promise<void>) {
		if (this.locks.has(key)) return false;
		this.locks.add(key);
		try {
			await fn();
		} finally {
			this.locks.delete(key);
		}
		return true;
	}
}
