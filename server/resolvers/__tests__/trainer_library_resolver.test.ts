import 'reflect-metadata';

// The served trainer library: the private file never leaves the server whole. Mains go to
// anyone, alternatives only one category at a time, and both are rate limited.

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

const redisStore: Record<string, number> = {};
jest.mock('../../services/redis', () => ({
	getRedisPubClient: () => ({
		incr: async (k: string) => (redisStore[k] = (redisStore[k] || 0) + 1),
		expire: async () => 1,
		ttl: async () => 30,
		get: async (k: string) => (k in redisStore ? String(redisStore[k]) : null),
	}),
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const {TrainerLibraryResolver} = require('../TrainerLibrary.resolver');
const {buildTrainerLibrary, setTrainerLibraryForTests} = require('../../util/trainer_library');
const {ALG_SET_RATE_LIMITS} = require('../../../shared/trainer/alg_sets');
/* eslint-enable @typescript-eslint/no-var-requires */

const LIBRARY = {
	PLL: [
		{
			subset: 'Adj corners',
			algorithms: [
				{name: 'Aa perm', algorithm: "x R' U R' D2 R U' R' D2 R2 x'", setup: 'S', alternatives: ['A1', 'A2']},
				{name: 'T perm', algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'"},
			],
		},
	],
	'1LLL': [{subset: '1LLL 1', algorithms: [{name: '1LLL 1 1', algorithm: "R U R'", alternatives: ['B1']}]}],
};

const resolver = new TrainerLibraryResolver();
const ctx = (extra: any = {}) => ({ipAddress: '10.0.0.1', user: null, ...extra});

beforeEach(() => {
	for (const k of Object.keys(redisStore)) delete redisStore[k];
	setTrainerLibraryForTests(buildTrainerLibrary(JSON.stringify(LIBRARY), true));
});

describe('buildTrainerLibrary', () => {
	it('keeps alternatives out of the mains and counts them', () => {
		const lib = buildTrainerLibrary(JSON.stringify(LIBRARY), true);
		const aa = lib.mains[0].subsets[0].algorithms[0];
		expect(aa).toEqual({name: 'Aa perm', algorithm: LIBRARY.PLL[0].algorithms[0].algorithm, setup: 'S', alternativeCount: 2});
		expect(JSON.stringify(lib.mains)).not.toContain('A1');
		expect(lib.mains[0].subsets[0].algorithms[1].alternativeCount).toBe(0);
		expect(lib.alternatives.get('PLL')).toEqual([{name: 'Aa perm', alternatives: ['A1', 'A2']}]);
	});

	it('versions by content', () => {
		const a = buildTrainerLibrary(JSON.stringify(LIBRARY), true).version;
		const b = buildTrainerLibrary(JSON.stringify({...LIBRARY, OLL: []}), true).version;
		expect(a).toMatch(/^[0-9a-f]{16}$/);
		expect(a).not.toBe(b);
		expect(buildTrainerLibrary(JSON.stringify(LIBRARY), true).version).toBe(a);
	});
});

describe('trainerLibrary', () => {
	it('gives anyone the mains, without alternatives', async () => {
		const res = await resolver.trainerLibrary(ctx());
		expect(res.categories.map((c: any) => c.category)).toEqual(['PLL', '1LLL']);
		expect(JSON.stringify(res)).not.toContain('A1');
	});

	it('answers a client on the current version with the version only, uncounted', async () => {
		const {version} = await resolver.trainerLibrary(ctx());
		for (let i = 0; i < ALG_SET_RATE_LIMITS.LIBRARY.max + 5; i++) {
			const res = await resolver.trainerLibrary(ctx(), version);
			expect(res).toEqual({version, categories: null});
		}
	});

	it('limits full payloads per IP', async () => {
		for (let i = 0; i < ALG_SET_RATE_LIMITS.LIBRARY.max; i++) await resolver.trainerLibrary(ctx());
		await expect(resolver.trainerLibrary(ctx())).rejects.toMatchObject({extensions: {code: 'RATE_LIMITED'}});
		// another IP is not affected
		await expect(resolver.trainerLibrary(ctx({ipAddress: '10.0.0.2'}))).resolves.toBeTruthy();
	});
});

describe('trainerLibraryAlternatives', () => {
	const user = {id: 'u1'};

	it('returns one category', async () => {
		const res = await resolver.trainerLibraryAlternatives(ctx({user}), 'PLL');
		expect(res.category).toBe('PLL');
		expect(res.cases).toEqual([{name: 'Aa perm', alternatives: ['A1', 'A2']}]);
		expect(JSON.stringify(res)).not.toContain('B1');
	});

	it('refuses an unknown or oversized category', async () => {
		await expect(resolver.trainerLibraryAlternatives(ctx({user}), 'Nope')).rejects.toMatchObject({extensions: {code: 'NOT_FOUND'}});
		await expect(resolver.trainerLibraryAlternatives(ctx({user}), 'x'.repeat(100))).rejects.toMatchObject({
			extensions: {code: 'NOT_FOUND'},
		});
	});

	it('limits a user walking the categories', async () => {
		for (let i = 0; i < ALG_SET_RATE_LIMITS.LIBRARY_ALTERNATIVES_HOUR.max; i++) {
			await resolver.trainerLibraryAlternatives(ctx({user}), i % 2 ? 'PLL' : '1LLL');
		}
		await expect(resolver.trainerLibraryAlternatives(ctx({user}), 'PLL')).rejects.toMatchObject({
			extensions: {code: 'RATE_LIMITED'},
		});
		await expect(resolver.trainerLibraryAlternatives(ctx({user: {id: 'u2'}}), 'PLL')).resolves.toBeTruthy();
	});
});
