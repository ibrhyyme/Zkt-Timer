import 'reflect-metadata';

// AlgSet.resolver against a small in-memory stand-in for the set tables and Redis: the rules
// that need a database (design trainer-sets 4.2 to 4.5) without one.

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

const redisStore: Record<string, number> = {};
let redisUp = true;
jest.mock('../../services/redis', () => ({
	getRedisPubClient: () =>
		redisUp
			? {
					incr: async (k: string) => (redisStore[k] = (redisStore[k] || 0) + 1),
					expire: async () => 1,
					ttl: async () => 30,
					get: async (k: string) => (k in redisStore ? String(redisStore[k]) : null),
			  }
			: null,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {AlgSetResolver, isLoopbackRequest} = require('../AlgSet.resolver');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library = require('../../../public/trainer/default-algs.json');

// The catalog checks rows against the public library, whatever private library this machine has.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {buildTrainerLibrary, setTrainerLibraryForTests} = require('../../util/trainer_library');
setTrainerLibraryForTests(buildTrainerLibrary(JSON.stringify(library), false));
const AA = library.PLL[0].algorithms.find((a: any) => a.name === 'Aa perm');
const JA = library.PLL[0].algorithms.find((a: any) => a.name === 'Ja perm');

const NOW = new Date('2026-10-06T12:00:00Z');

function owner(id: string, extra: any = {}) {
	return {id, username: id, verified: false, banned_forever: false, banned_until: null, profile: null, ...extra};
}

function makeDb() {
	const sets: any[] = [];
	const items: any[] = [];
	const saves: any[] = [];
	const reports: any[] = [];
	const users: Record<string, any> = {};
	const pool: any[] = [];

	const summary = (s: any) => ({
		...s,
		user: users[s.user_id] || owner(s.user_id),
		items: items
			.filter((i) => i.set_id === s.id)
			.sort((a, b) => a.position - b.position)
			.slice(0, 4),
	});

	const prisma: any = {
		algSet: {
			findUnique: jest.fn(async ({where}: any) => {
				const s = sets.find((x) => (where.id ? x.id === where.id : x.code === where.code));
				return s ? summary(s) : null;
			}),
			findMany: jest.fn(async ({where}: any) => sets.filter((s) => !where?.user_id || s.user_id === where.user_id).map(summary)),
			count: jest.fn(async ({where}: any) => sets.filter((s) => s.user_id === where.user_id).length),
			create: jest.fn(async ({data}: any) => {
				const row = {
					id: `set-${sets.length + 1}`,
					item_count: 0,
					save_count: 0,
					categories: '',
					puzzles: '',
					description: null,
					published_at: null,
					hidden_at: null,
					hidden_reason: null,
					created_at: NOW,
					updated_at: NOW,
					...data,
				};
				sets.push(row);
				return {id: row.id};
			}),
			update: jest.fn(async ({where, data}: any) => {
				const s = sets.find((x) => x.id === where.id);
				Object.assign(s, data);
				return s;
			}),
			updateMany: jest.fn(async ({where, data}: any) => {
				const hit = sets.filter((x) => x.id === where.id && (where.hidden_at !== null || x.hidden_at === null));
				hit.forEach((s) => Object.assign(s, data));
				return {count: hit.length};
			}),
			deleteMany: jest.fn(async () => ({count: 1})),
		},
		algSetItem: {
			findMany: jest.fn(async ({where}: any) => items.filter((i) => i.set_id === where.set_id)),
			createMany: jest.fn(async ({data}: any) => {
				data.forEach((d: any, i: number) => items.push({id: `item-${items.length + i + 1}`, created_at: NOW, ...d}));
				return {count: data.length};
			}),
		},
		algSetSave: {
			findUnique: jest.fn(async ({where}: any) => {
				const {user_id, set_id} = where.user_id_set_id;
				return saves.find((s) => s.user_id === user_id && s.set_id === set_id) || null;
			}),
			count: jest.fn(async ({where}: any) =>
				saves.filter((s) => (!where.user_id || s.user_id === where.user_id) && (!where.set_id || s.set_id === where.set_id)).length
			),
			create: jest.fn(async ({data}: any) => {
				saves.push({id: `save-${saves.length + 1}`, created_at: NOW, ...data});
				return {id: 'x'};
			}),
		},
		report: {
			findFirst: jest.fn(async ({where}: any) =>
				reports.find((r) => r.alg_set_id === where.alg_set_id && r.created_by_id === where.created_by_id && !r.resolved_at) || null
			),
			create: jest.fn(async ({data}: any) => {
				reports.push({id: `r-${reports.length + 1}`, resolved_at: null, ...data});
				return {id: 'r'};
			}),
			findMany: jest.fn(async ({where}: any) => {
				const ids = new Set<string>();
				for (const r of reports) {
					if (r.alg_set_id !== where.alg_set_id || r.resolved_at) continue;
					const u = users[r.created_by_id];
					if (!u?.email_verified || u.created_at > where.created_by.created_at.lte) continue;
					ids.add(r.created_by_id);
				}
				return Array.from(ids).map((created_by_id) => ({created_by_id}));
			}),
		},
		trainerAlternative: {
			findMany: jest.fn(async ({where}: any) =>
				pool.filter((p) => where.case_name.in ? where.case_name.in.includes(p.case_name) : p.case_name === where.case_name)
			),
		},
		$transaction: jest.fn(async (arg: any) => (typeof arg === 'function' ? arg(prisma) : Promise.all(arg))),
	};

	return {prisma, sets, items, saves, reports, users, pool};
}

function ctx(db: any, user: any, req: any = {headers: {'cf-connecting-ip': '9.9.9.9'}}) {
	return {prisma: db.prisma, user, req};
}

const resolver = new AlgSetResolver();
const ME = {id: 'me'};
const OTHER = {id: 'other'};

async function errorOf(p: Promise<unknown>): Promise<any> {
	try {
		await p;
	} catch (e) {
		return e;
	}
	throw new Error('expected an error');
}

beforeEach(() => {
	for (const k of Object.keys(redisStore)) delete redisStore[k];
	redisUp = true;
});

describe('createAlgSet', () => {
	it('cleans the name, defaults to private and makes a code', async () => {
		const db = makeDb();
		const set = await resolver.createAlgSet(ctx(db, ME), {name: '  My   set\n'});
		expect(set.name).toBe('My set');
		expect(set.visibility).toBe('private');
		expect(set.code).toMatch(/^[0-9A-Za-z]{10}$/);
		expect(set.is_owner).toBe(true);
		expect(db.sets[0].published_at).toBeNull();
	});

	it('writes published_at for a public set and refuses an unknown visibility', async () => {
		const db = makeDb();
		await resolver.createAlgSet(ctx(db, ME), {name: 'A', visibility: 'public'});
		expect(db.sets[0].published_at).toBeInstanceOf(Date);
		const err = await errorOf(resolver.createAlgSet(ctx(db, ME), {name: 'B', visibility: 'friends'}));
		expect(err.extensions.i18nKey).toBe('alg_set_errors.visibility_invalid');
	});

	it('refuses an empty name and the 101st set', async () => {
		const db = makeDb();
		expect((await errorOf(resolver.createAlgSet(ctx(db, ME), {name: ' ​ '}))).extensions.i18nKey).toBe(
			'alg_set_errors.name_empty'
		);
		for (let i = 0; i < 100; i++) db.sets.push({id: `s${i}`, user_id: 'me'});
		expect((await errorOf(resolver.createAlgSet(ctx(db, ME), {name: 'X'}))).extensions.i18nKey).toBe(
			'alg_set_errors.limit_sets'
		);
	});

	it('refuses writes when Redis is down', async () => {
		const db = makeDb();
		redisUp = false;
		const err = await errorOf(resolver.createAlgSet(ctx(db, ME), {name: 'X'}));
		expect(err.extensions.code).toBe('RATE_LIMITED');
	});
});

describe('addAlgSetItems', () => {
	async function newSet(db: any) {
		return resolver.createAlgSet(ctx(db, ME), {name: 'S'});
	}

	it('stores the library text, subset and puzzle, and recounts', async () => {
		const db = makeDb();
		const set = await newSet(db);
		await resolver.addAlgSetItems(ctx(db, ME), set.id, [
			{category: 'PLL', case_name: 'Aa perm', algorithm: AA.algorithm.replace(/'/g, '’')},
			{category: 'PLL', case_name: 'Aa perm', algorithm: 'R'},
		]);
		expect(db.items).toHaveLength(1);
		expect(db.items[0]).toMatchObject({category: 'PLL', case_name: 'Aa perm', subset: 'Adj corners', puzzle: '333', algorithm: AA.algorithm, position: 0});
		expect(db.sets[0]).toMatchObject({item_count: 1, categories: ',PLL,', puzzles: ',333,'});
	});

	it('rejects the whole request and names the cases', async () => {
		const db = makeDb();
		const set = await newSet(db);
		const err = await errorOf(
			resolver.addAlgSetItems(ctx(db, ME), set.id, [
				{category: 'PLL', case_name: 'Aa perm', algorithm: AA.algorithm},
				{category: 'PLL', case_name: 'Ja perm', algorithm: "R U R' U'"},
			])
		);
		expect(err.message).toBe('ALG_SET_UNKNOWN_ALGORITHM');
		expect(err.extensions.i18nKey).toBe('alg_set_errors.unknown_algorithm');
		expect(err.extensions.rejected).toEqual(['PLL::Ja perm']);
		expect(db.items).toHaveLength(0);
	});

	it('accepts a pool alternative that is a move sequence, refuses one that is not', async () => {
		const db = makeDb();
		const set = await newSet(db);
		const mine = "R U R' F' R U R' U' R' F R2 U' R'";
		db.pool.push({category: 'PLL', case_name: 'Ja perm', algorithm: mine, original_input: mine});
		db.pool.push({category: 'PLL', case_name: 'Jb perm', algorithm: 'buy now', original_input: 'buy now'});
		await resolver.addAlgSetItems(ctx(db, ME), set.id, [{category: 'PLL', case_name: 'Ja perm', algorithm: mine}]);
		expect(db.items[0].algorithm).toBe(mine);
		const err = await errorOf(
			resolver.addAlgSetItems(ctx(db, ME), set.id, [{category: 'PLL', case_name: 'Jb perm', algorithm: 'buy now'}])
		);
		expect(err.extensions.rejected).toEqual(['PLL::Jb perm']);
	});

	it('appends after the last position and skips cases already in the set', async () => {
		const db = makeDb();
		const set = await newSet(db);
		await resolver.addAlgSetItems(ctx(db, ME), set.id, [{category: 'PLL', case_name: 'Aa perm', algorithm: AA.algorithm}]);
		await resolver.addAlgSetItems(ctx(db, ME), set.id, [
			{category: 'PLL', case_name: 'Aa perm', algorithm: AA.algorithm},
			{category: 'PLL', case_name: 'Ja perm', algorithm: JA.algorithm},
		]);
		expect(db.items.map((i: any) => [i.case_name, i.position])).toEqual([
			['Aa perm', 0],
			['Ja perm', 1],
		]);
	});

	it('answers NOT_FOUND for someone else’s set', async () => {
		const db = makeDb();
		const set = await newSet(db);
		const err = await errorOf(
			resolver.addAlgSetItems(ctx(db, OTHER), set.id, [{category: 'PLL', case_name: 'Aa perm', algorithm: AA.algorithm}])
		);
		expect(err.extensions.code).toBe('NOT_FOUND');
	});
});

describe('algSet read rules', () => {
	function seed(db: any, extra: any = {}) {
		db.sets.push({
			id: 'set-1',
			code: 'AbCdEfGhIj',
			user_id: 'owner',
			name: 'N',
			description: null,
			visibility: 'private',
			item_count: 0,
			save_count: 0,
			categories: '',
			puzzles: '',
			published_at: null,
			hidden_at: null,
			hidden_reason: null,
			created_at: NOW,
			updated_at: NOW,
			...extra,
		});
	}

	it('hides a private set from others and shows a link set', async () => {
		const db = makeDb();
		seed(db);
		expect((await errorOf(resolver.algSet(ctx(db, OTHER), 'AbCdEfGhIj'))).extensions.code).toBe('NOT_FOUND');
		db.sets[0].visibility = 'link';
		const set = await resolver.algSet(ctx(db, null), 'AbCdEfGhIj');
		expect(set.name).toBe('N');
		expect(set.is_owner).toBe(false);
		expect(set.is_saved).toBe(false);
	});

	it('locks an anonymous IP after 20 NOT_FOUND, valid codes included', async () => {
		const db = makeDb();
		seed(db, {visibility: 'public'});
		for (let i = 0; i < 21; i++) await errorOf(resolver.algSet(ctx(db, null), 'ZZZZZZZZZZ'));
		const err = await errorOf(resolver.algSet(ctx(db, null), 'AbCdEfGhIj'));
		expect(err.extensions.code).toBe('NOT_FOUND');
		// Another IP and a signed-in user are not affected.
		expect((await resolver.algSet(ctx(db, null, {headers: {'cf-connecting-ip': '8.8.8.8'}}), 'AbCdEfGhIj')).name).toBe('N');
		expect((await resolver.algSet(ctx(db, OTHER), 'AbCdEfGhIj')).name).toBe('N');
	});

	it('does not count or lock the server’s own SSR request', async () => {
		const db = makeDb();
		seed(db, {visibility: 'public'});
		const loopback = {headers: {}, socket: {remoteAddress: '::ffff:127.0.0.1'}};
		for (let i = 0; i < 200; i++) await errorOf(resolver.algSet(ctx(db, null, loopback), 'ZZZZZZZZZZ'));
		expect((await resolver.algSet(ctx(db, null, loopback), 'AbCdEfGhIj')).name).toBe('N');
		expect(Object.keys(redisStore)).toEqual([]);
	});

	it('keeps reads working when Redis is down', async () => {
		const db = makeDb();
		seed(db, {visibility: 'public'});
		redisUp = false;
		expect((await resolver.algSet(ctx(db, null), 'AbCdEfGhIj')).name).toBe('N');
		expect((await resolver.algSet(ctx(db, OTHER), 'AbCdEfGhIj')).name).toBe('N');
	});
});

describe('communityAlgSets', () => {
	it('lists only public, visible, non empty sets of owners who are not banned', async () => {
		const db = makeDb();
		await resolver.communityAlgSets(ctx(db, null));
		const where = db.prisma.algSet.findMany.mock.calls[0][0].where;
		expect(where).toMatchObject({visibility: 'public', hidden_at: null, item_count: {gt: 0}});
		expect(where.user).toMatchObject({banned_forever: false});
	});
});

describe('isLoopbackRequest', () => {
	it('is true only for a local socket without proxy headers', () => {
		expect(isLoopbackRequest({headers: {}, socket: {remoteAddress: '127.0.0.1'}})).toBe(true);
		expect(isLoopbackRequest({headers: {}, socket: {remoteAddress: '::1'}})).toBe(true);
		expect(isLoopbackRequest({headers: {'x-forwarded-for': '1.2.3.4'}, socket: {remoteAddress: '127.0.0.1'}})).toBe(false);
		expect(isLoopbackRequest({headers: {'cf-connecting-ip': '127.0.0.1'}, socket: {remoteAddress: '127.0.0.1'}})).toBe(false);
		expect(isLoopbackRequest({headers: {}, socket: {remoteAddress: '172.17.0.1'}})).toBe(false);
		expect(isLoopbackRequest(undefined)).toBe(false);
	});
});

describe('saveAlgSet and reportAlgSet', () => {
	function seedShared(db: any) {
		db.sets.push({
			id: 'set-1',
			code: 'AbCdEfGhIj',
			user_id: 'owner',
			name: 'N',
			visibility: 'link',
			item_count: 0,
			save_count: 0,
			categories: '',
			puzzles: '',
			hidden_at: null,
			created_at: NOW,
			updated_at: NOW,
		});
	}

	it('saves once, recounts and refuses the owner', async () => {
		const db = makeDb();
		seedShared(db);
		expect(await resolver.saveAlgSet(ctx(db, ME), 'set-1')).toBe(true);
		expect(await resolver.saveAlgSet(ctx(db, ME), 'set-1')).toBe(true);
		expect(db.saves).toHaveLength(1);
		expect(db.sets[0].save_count).toBe(1);
		const err = await errorOf(resolver.saveAlgSet(ctx(db, {id: 'owner'}), 'set-1'));
		expect(err.extensions.i18nKey).toBe('alg_set_errors.own_set_save');
	});

	it('keeps updated_at when the save count changes (a save is not an edit)', async () => {
		const db = makeDb();
		seedShared(db);
		await resolver.saveAlgSet(ctx(db, ME), 'set-1');
		const write = db.prisma.algSet.updateMany.mock.calls.find((c: any[]) => 'save_count' in c[0].data);
		expect(write[0].data).toEqual({save_count: 1, updated_at: NOW});
		expect(db.sets[0].updated_at).toBe(NOW);
	});

	it('cannot save a private set, even as admin', async () => {
		const db = makeDb();
		seedShared(db);
		db.sets[0].visibility = 'private';
		const err = await errorOf(resolver.saveAlgSet(ctx(db, {id: 'admin', admin: true}), 'set-1'));
		expect(err.extensions.code).toBe('NOT_FOUND');
	});

	it('hides the set after three qualifying reporters, not after unverified ones', async () => {
		const db = makeDb();
		seedShared(db);
		const old = new Date('2026-01-01');
		db.users.a = {email_verified: true, created_at: old};
		db.users.b = {email_verified: true, created_at: old};
		db.users.c = {email_verified: false, created_at: old};
		db.users.d = {email_verified: true, created_at: new Date()};
		db.users.e = {email_verified: true, created_at: old};
		for (const id of ['a', 'b', 'c', 'd']) await resolver.reportAlgSet(ctx(db, {id}), 'set-1', 'spam');
		expect(db.sets[0].hidden_at).toBeNull();
		await resolver.reportAlgSet(ctx(db, {id: 'e'}), 'set-1', 'other', 'note');
		expect(db.sets[0].hidden_at).toBeInstanceOf(Date);
		expect(db.sets[0].hidden_reason).toBe('auto_reports');
		expect(db.reports[0]).toMatchObject({reason: 'alg_set:spam', reported_user_id: 'owner', alg_set_id: 'set-1'});
		expect(db.reports[4].reason).toBe('alg_set:other: note');
	});

	it('refuses a second open report and an unknown reason', async () => {
		const db = makeDb();
		seedShared(db);
		await resolver.reportAlgSet(ctx(db, ME), 'set-1', 'spam');
		expect((await errorOf(resolver.reportAlgSet(ctx(db, ME), 'set-1', 'spam'))).extensions.i18nKey).toBe(
			'alg_set_errors.already_reported'
		);
		expect((await errorOf(resolver.reportAlgSet(ctx(db, ME), 'set-1', 'boring'))).extensions.i18nKey).toBe(
			'alg_set_errors.report_reason_invalid'
		);
	});
});
