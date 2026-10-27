import {
	createBackoff,
	createRequestBudget,
	createResilientCache,
	EnvelopeStore,
	FederationUnavailableError,
	parseEnvelope,
} from '../zkt_federation_cache';

jest.mock('../logger', () => ({logger: {warn: jest.fn(), debug: jest.fn(), error: jest.fn(), info: jest.fn()}}));

function memoryStore(): EnvelopeStore & {data: Map<string, string>} {
	const data = new Map<string, string>();
	return {
		data,
		async get(key) {
			return data.has(key) ? (data.get(key) as string) : null;
		},
		async set(key, value) {
			data.set(key, value);
		},
	};
}

function clock(start = 1_000_000) {
	let t = start;
	return {now: () => t, advance: (ms: number) => (t += ms)};
}

function httpError(status: number, retryAfterS?: number) {
	return Object.assign(new Error(`http ${status}`), {status, retryAfterS});
}

// Let queued microtasks (background refreshes) run.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('createRequestBudget', () => {
	it('caps each priority within a rolling minute and frees slots as they age out', () => {
		const c = clock();
		const budget = createRequestBudget({high: 3, normal: 2, low: 1}, c.now);
		expect(budget.tryAcquire('low')).toBe(true);
		expect(budget.tryAcquire('low')).toBe(false);
		expect(budget.tryAcquire('normal')).toBe(true);
		expect(budget.tryAcquire('normal')).toBe(false);
		expect(budget.tryAcquire('high')).toBe(true);
		expect(budget.tryAcquire('high')).toBe(false);
		expect(budget.secondsUntilSlot()).toBe(60);
		c.advance(60_001);
		expect(budget.used()).toBe(0);
		expect(budget.tryAcquire('low')).toBe(true);
	});
});

describe('createBackoff', () => {
	it('honours Retry-After on 429 with a floor of 5 seconds', () => {
		const c = clock();
		const backoff = createBackoff(c.now);
		backoff.onFailure({status: 429, retryAfterS: 42});
		expect(backoff.remainingMs()).toBe(42_000);
		backoff.onSuccess();
		backoff.onFailure({status: 429, retryAfterS: 1});
		expect(backoff.remainingMs()).toBe(5_000);
	});

	it('grows exponentially on other failures, capped at 60 seconds, and resets on success', () => {
		const c = clock();
		const backoff = createBackoff(c.now);
		const pauses: number[] = [];
		for (let i = 0; i < 7; i++) {
			backoff.onFailure({status: 503});
			pauses.push(backoff.remainingMs());
			c.advance(backoff.remainingMs());
		}
		expect(pauses).toEqual([3000, 6000, 12000, 24000, 48000, 60000, 60000]);
		backoff.onSuccess();
		expect(backoff.remainingMs()).toBe(0);
	});
});

describe('parseEnvelope', () => {
	it('treats legacy plain values and junk as a miss', () => {
		expect(parseEnvelope(null)).toBeNull();
		expect(parseEnvelope('null')).toBeNull();
		expect(parseEnvelope('{"items":[]}')).toBeNull();
		expect(parseEnvelope('not json')).toBeNull();
		expect(parseEnvelope('{"v":null,"t":5}')).toEqual({v: null, t: 5});
	});
});

describe('createResilientCache', () => {
	function setup() {
		const c = clock();
		const store = memoryStore();
		const cache = createResilientCache({
			store,
			now: c.now,
			budget: createRequestBudget({high: 100, normal: 100, low: 100}, c.now),
			backoff: createBackoff(c.now),
		});
		return {c, store, cache};
	}

	it('serves a fresh value without calling upstream', async () => {
		const {c, cache} = setup();
		const fetcher = jest.fn().mockResolvedValue({n: 1});
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toEqual({n: 1});
		c.advance(5_000);
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toEqual({n: 1});
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('shares one upstream call between concurrent misses (single flight)', async () => {
		const {cache} = setup();
		let resolve!: (v: any) => void;
		const fetcher = jest.fn(() => new Promise((r) => (resolve = r)));
		const reads = [1, 2, 3, 4, 5].map(() => cache.read('k', fetcher, {freshMs: 10_000}));
		await flush();
		resolve({n: 1});
		expect(await Promise.all(reads)).toEqual([{n: 1}, {n: 1}, {n: 1}, {n: 1}, {n: 1}]);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('serves stale at once and refreshes in the background', async () => {
		const {c, cache} = setup();
		const fetcher = jest.fn().mockResolvedValueOnce({n: 1}).mockResolvedValueOnce({n: 2});
		await cache.read('k', fetcher, {freshMs: 10_000});
		c.advance(15_000);
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toEqual({n: 1});
		await flush();
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toEqual({n: 2});
	});

	it('never caches an error: a failed refresh keeps the last good value', async () => {
		const {c, cache, store} = setup();
		const fetcher = jest.fn().mockResolvedValueOnce({n: 1}).mockRejectedValue(httpError(500));
		await cache.read('k', fetcher, {freshMs: 10_000});
		const before = store.data.get('k');
		c.advance(15_000);
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toEqual({n: 1});
		await flush();
		expect(store.data.get('k')).toBe(before);
		// Long past the stale window it still falls back rather than failing.
		c.advance(10 * 60_000);
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toEqual({n: 1});
	});

	it('caches a 404 (null) as a real answer', async () => {
		const {c, cache} = setup();
		const fetcher = jest.fn().mockResolvedValue(null);
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toBeNull();
		c.advance(1_000);
		expect(await cache.read('k', fetcher, {freshMs: 10_000})).toBeNull();
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it('fails a never-fetched key with FederationUnavailableError and then backs off', async () => {
		const {c, cache} = setup();
		const fetcher = jest.fn().mockRejectedValue(httpError(429, 20));
		await expect(cache.read('a', fetcher, {freshMs: 10_000})).rejects.toBeInstanceOf(FederationUnavailableError);
		// Other keys do not hit the federation while it is refusing us.
		const other = jest.fn().mockResolvedValue({n: 1});
		await expect(cache.read('b', other, {freshMs: 10_000})).rejects.toMatchObject({reason: 'cooldown'});
		expect(other).not.toHaveBeenCalled();
		c.advance(20_000);
		expect(await cache.read('b', other, {freshMs: 10_000})).toEqual({n: 1});
	});

	it('pauses only the failing key on a 5xx or timeout, so one broken endpoint cannot freeze the rest', async () => {
		const {c, cache} = setup();
		const broken = jest.fn().mockRejectedValue(httpError(500));
		await expect(cache.read('wcif', broken, {freshMs: 10_000})).rejects.toBeInstanceOf(FederationUnavailableError);
		// Another key still reaches the federation at once.
		const live = jest.fn().mockResolvedValue({round: 1});
		expect(await cache.read('round', live, {freshMs: 10_000})).toEqual({round: 1});
		// The broken key itself waits out its own pause.
		await expect(cache.read('wcif', broken, {freshMs: 10_000})).rejects.toMatchObject({reason: 'cooldown'});
		expect(broken).toHaveBeenCalledTimes(1);
		c.advance(3_000);
		const timeout = Object.assign(new Error('timeout'), {code: 'ECONNABORTED'});
		broken.mockRejectedValueOnce(timeout);
		await expect(cache.read('wcif', broken, {freshMs: 10_000})).rejects.toMatchObject({reason: 'upstream'});
		expect(await cache.read('other', live, {freshMs: 10_000})).toEqual({round: 1});
	});

	it('pauses every key when the host is unreachable', async () => {
		const {cache} = setup();
		const refused = Object.assign(new Error('refused'), {code: 'ECONNREFUSED'});
		await expect(cache.read('a', jest.fn().mockRejectedValue(refused), {freshMs: 10_000})).rejects.toMatchObject({
			reason: 'upstream',
		});
		const other = jest.fn().mockResolvedValue({n: 1});
		await expect(cache.read('b', other, {freshMs: 10_000})).rejects.toMatchObject({reason: 'cooldown'});
		expect(other).not.toHaveBeenCalled();
	});

	it('writes with the per-read keep time when one is given', async () => {
		const ttls: number[] = [];
		const cache = createResilientCache({
			store: {get: async () => null, set: async (_k, _v, ttl) => void ttls.push(ttl)},
			budget: createRequestBudget({high: 100, normal: 100, low: 100}),
		});
		await cache.read('search', async () => ({items: []}), {freshMs: 1_000, keepSeconds: 600});
		await cache.read('list', async () => ({items: []}), {freshMs: 1_000});
		expect(ttls).toEqual([600, 3 * 24 * 60 * 60]);
	});

	it('lets lower priority refreshes give way first while a page with nothing cached still gets through', async () => {
		const c = clock();
		const store = memoryStore();
		const cache = createResilientCache({
			store,
			now: c.now,
			budget: createRequestBudget({high: 3, normal: 2, low: 1}, c.now),
			backoff: createBackoff(c.now),
		});
		// Seed two round keys so the poller has something to fall back on.
		await cache.prime('r1', {round: 1});
		await cache.prime('r2', {round: 2});
		c.advance(10_000);
		const poll = jest.fn().mockResolvedValue({round: 'new'});
		expect(await cache.read('r1', poll, {freshMs: 6_000, mode: 'refresh', priority: 'low'})).toEqual({round: 'new'});
		// Budget for low is spent: the poller keeps the current value instead.
		expect(await cache.read('r2', poll, {freshMs: 6_000, mode: 'refresh', priority: 'low'})).toEqual({round: 2});
		expect(poll).toHaveBeenCalledTimes(1);
		// A page with nothing cached still fetches.
		const page = jest.fn().mockResolvedValue({wcif: true});
		expect(await cache.read('wcif', page, {freshMs: 45_000})).toEqual({wcif: true});
	});

	it('refresh mode waits for the new value instead of returning the previous one', async () => {
		const {c, cache} = setup();
		const fetcher = jest.fn().mockResolvedValueOnce({n: 1}).mockResolvedValueOnce({n: 2});
		await cache.read('k', fetcher, {freshMs: 6_000});
		c.advance(7_000);
		expect(await cache.read('k', fetcher, {freshMs: 6_000, mode: 'refresh', priority: 'low'})).toEqual({n: 2});
	});

	it('treats a store outage as a miss and still answers', async () => {
		const c = clock();
		const cache = createResilientCache({
			store: {
				get: () => Promise.reject(new Error('redis down')),
				set: () => Promise.reject(new Error('redis down')),
			},
			now: c.now,
		});
		expect(await cache.read('k', async () => ({n: 1}), {freshMs: 1_000})).toEqual({n: 1});
	});
});
