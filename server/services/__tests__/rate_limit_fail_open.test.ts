// checkRateLimit / peekRateLimit when Redis is unreachable (design trainer-sets 4.5):
// the default refuses, failOpen lets the request through. Existing callers pass no
// options and keep the old behavior.

jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

let client: any = null;
jest.mock('../redis', () => ({getRedisPubClient: () => client}));

import {checkRateLimit, peekRateLimit} from '../rate_limit';

describe('rate limit without Redis', () => {
	beforeEach(() => {
		client = null;
	});

	it('refuses by default (writes)', async () => {
		const res = await checkRateLimit('algset:write:u1', 120, 60);
		expect(res.allowed).toBe(false);
	});

	it('lets a failOpen read through', async () => {
		const res = await checkRateLimit('algset:read:user:u1', 120, 60, {failOpen: true});
		expect(res.allowed).toBe(true);
	});

	it('refuses by default when Redis throws, passes with failOpen', async () => {
		client = {
			incr: jest.fn(async () => {
				throw new Error('connection lost');
			}),
			get: jest.fn(async () => {
				throw new Error('connection lost');
			}),
		};
		expect((await checkRateLimit('k', 5, 60)).allowed).toBe(false);
		expect((await checkRateLimit('k', 5, 60, {failOpen: true})).allowed).toBe(true);
		expect(await peekRateLimit('k')).toBe(Number.MAX_SAFE_INTEGER);
		expect(await peekRateLimit('k', {failOpen: true})).toBe(0);
	});

	it('peek blocks by default and reports an empty counter with failOpen', async () => {
		expect(await peekRateLimit('algset:nflock:ip:1.2.3.4')).toBe(Number.MAX_SAFE_INTEGER);
		expect(await peekRateLimit('algset:nflock:ip:1.2.3.4', {failOpen: true})).toBe(0);
	});
});

describe('rate limit with Redis', () => {
	it('counts and refuses over the limit in both modes', async () => {
		const store: Record<string, number> = {};
		client = {
			incr: jest.fn(async (k: string) => (store[k] = (store[k] || 0) + 1)),
			expire: jest.fn(async () => 1),
			ttl: jest.fn(async () => 30),
			get: jest.fn(async (k: string) => (k in store ? String(store[k]) : null)),
		};
		expect((await checkRateLimit('r', 2, 60, {failOpen: true})).allowed).toBe(true);
		expect((await checkRateLimit('r', 2, 60, {failOpen: true})).allowed).toBe(true);
		expect((await checkRateLimit('r', 2, 60, {failOpen: true})).allowed).toBe(false);
		expect(await peekRateLimit('r', {failOpen: true})).toBe(3);
	});
});
