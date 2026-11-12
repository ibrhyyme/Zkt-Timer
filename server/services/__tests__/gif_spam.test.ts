import {
	checkGifSendWith,
	cooldownForStrike,
	GIF_BURST_MAX,
	GifSpamStore,
} from '../gif_spam';

/** In-memory stand-in with a controllable clock (seconds), enough for what the brake uses. */
function memoryStore() {
	let now = 0;
	const values = new Map<string, {value: number; expiresAt: number | null}>();
	const sets = new Map<string, {members: Map<string, number>; expiresAt: number | null}>();
	const liveSet = (key: string) => {
		const entry = sets.get(key);
		if (entry && entry.expiresAt !== null && entry.expiresAt <= now) sets.delete(key);
		return sets.get(key);
	};
	const alive = (key: string) => {
		const entry = values.get(key);
		if (entry && entry.expiresAt !== null && entry.expiresAt <= now) values.delete(key);
		return values.get(key);
	};

	const store: GifSpamStore = {
		async ttl(key) {
			const entry = alive(key) || liveSet(key);
			if (!entry) return -2;
			return entry.expiresAt === null ? -1 : entry.expiresAt - now;
		},
		async incr(key) {
			const entry = alive(key) || {value: 0, expiresAt: null};
			entry.value += 1;
			values.set(key, entry);
			return entry.value;
		},
		async expire(key, seconds) {
			const entry = alive(key) || liveSet(key);
			if (entry) entry.expiresAt = now + seconds;
		},
		async set(key, value, _mode, seconds) {
			values.set(key, {value: Number(value), expiresAt: now + seconds});
		},
		async del(key) {
			values.delete(key);
			sets.delete(key);
		},
		async zadd(key, score, member) {
			const entry = liveSet(key) || {members: new Map(), expiresAt: null};
			entry.members.set(member, score);
			sets.set(key, entry);
		},
		async zremrangebyscore(key, min, max) {
			const entry = liveSet(key);
			if (!entry) return;
			for (const [member, score] of Array.from(entry.members)) {
				if (score >= Number(min) && score <= Number(max)) entry.members.delete(member);
			}
		},
		async zcard(key) {
			return liveSet(key)?.members.size ?? 0;
		},
	};

	return {store, advance: (seconds: number) => (now += seconds), nowMs: () => now * 1000};
}

let clock: () => number = () => 0;

async function burst(store: GifSpamStore, count: number) {
	const results = [];
	for (let i = 0; i < count; i++) results.push(await checkGifSendWith(store, 'u1', clock()));
	return results;
}

describe('GIF cooldown', () => {
	it('lets a normal burst through', async () => {
		const {store, nowMs} = memoryStore();
		clock = nowMs;
		const results = await burst(store, GIF_BURST_MAX);
		expect(results.every((r) => r.allowed)).toBe(true);
	});

	it('blocks the attempt over the limit for a minute, then escalates to 5 and 10', async () => {
		const {store, advance, nowMs} = memoryStore();
		clock = nowMs;

		const first = await burst(store, GIF_BURST_MAX + 1);
		expect(first[GIF_BURST_MAX]).toEqual({allowed: false, retryAfter: 60});

		advance(61);
		const second = await burst(store, GIF_BURST_MAX + 1);
		expect(second.slice(0, GIF_BURST_MAX).every((r) => r.allowed)).toBe(true);
		expect(second[GIF_BURST_MAX]).toEqual({allowed: false, retryAfter: 300});

		advance(301);
		const third = await burst(store, GIF_BURST_MAX + 1);
		expect(third[GIF_BURST_MAX]).toEqual({allowed: false, retryAfter: 600});

		// Stays at the top step.
		advance(601);
		const fourth = await burst(store, GIF_BURST_MAX + 1);
		expect(fourth[GIF_BURST_MAX].retryAfter).toBe(600);
	});

	it('does not extend the block while someone keeps pressing during it', async () => {
		const {store, advance, nowMs} = memoryStore();
		clock = nowMs;
		await burst(store, GIF_BURST_MAX + 1);
		advance(20);
		const during = await checkGifSendWith(store, 'u1', nowMs());
		expect(during).toEqual({allowed: false, retryAfter: 40});
	});

	it('forgets strikes after an hour without one', async () => {
		const {store, advance, nowMs} = memoryStore();
		clock = nowMs;
		await burst(store, GIF_BURST_MAX + 1);
		advance(60 * 60 + 61);
		const later = await burst(store, GIF_BURST_MAX + 1);
		expect(later[GIF_BURST_MAX].retryAfter).toBe(60);
	});

	// The case a fixed window let through: a burst that straddles the window reset.
	it('counts a burst that straddles where a fixed window would have reset', async () => {
		const {store, advance, nowMs} = memoryStore();
		clock = nowMs;
		await burst(store, 1);
		advance(25);
		await burst(store, 1);
		advance(6); // the first one is now 31 s old and out; the second is 6 s old
		const results = await burst(store, GIF_BURST_MAX);
		// The second plus four more make five; the fifth of this run is the sixth in 30 s.
		expect(results.slice(0, GIF_BURST_MAX - 1).every((r) => r.allowed)).toBe(true);
		expect(results[GIF_BURST_MAX - 1]).toEqual({allowed: false, retryAfter: 60});
	});

	it('lets a steady pace through indefinitely', async () => {
		const {store, advance, nowMs} = memoryStore();
		clock = nowMs;
		for (let i = 0; i < 20; i++) {
			expect((await burst(store, 1))[0].allowed).toBe(true);
			advance(7);
		}
	});

	it('maps strikes onto the steps', () => {
		expect([1, 2, 3, 4, 9].map(cooldownForStrike)).toEqual([60, 300, 600, 600, 600]);
	});
});
