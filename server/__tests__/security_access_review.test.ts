import 'reflect-metadata';
import fs from 'fs';
import path from 'path';
import {buildSchema as buildSdlSchema, getNamedType, isInterfaceType, isObjectType} from 'graphql';

// Follow-ups from the independent review of the OAuth token leak (B-11). Each block
// pins one remaining path that let a stranger read or touch someone else's data:
//   - per-IP rate limits keyed on the client-written X-Forwarded-For entry
//   - userSearch: anonymous, unthrottled, empty query = every account, 100 a page
//   - markNotificationAsRead / deleteNotification: no owner check, row returned
//   - solve(id) / solveByShareCode: solve_views listed who opened the solve
//   - siteConfig: anonymous read of the admin's per-feature user access lists
//   - BanLog relations typed UserAccountForAdmin (email, join_ip)

const fakePrisma: any = {
	userAccount: {
		count: jest.fn(async () => 0),
		findMany: jest.fn(async () => []),
	},
	notification: {
		findUnique: jest.fn(),
		update: jest.fn(async ({where}) => ({id: where.id})),
		delete: jest.fn(async ({where}) => ({id: where.id})),
	},
	solve: {
		findUnique: jest.fn(),
		update: jest.fn(async () => ({})),
	},
};

const checkRateLimit = jest.fn(async () => ({allowed: true, count: 1, ttl: 60}));
const getSiteConfig = jest.fn();

jest.mock('../database', () => ({getPrisma: () => fakePrisma}));
jest.mock('../services/rate_limit', () => ({
	checkRateLimit: (...args: any[]) => (checkRateLimit as any)(...args),
	peekRateLimit: jest.fn(async () => 0),
}));
jest.mock('../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));
jest.mock('../util/auth', () => ({
	checkLoggedIn: (user: any) => {
		if (!user) throw new Error('not logged in');
	},
}));
jest.mock('../models/solve_view', () => ({
	createSolveView: jest.fn(async () => undefined),
	deleteSolveViewsBySolveId: jest.fn(async () => undefined),
}));
jest.mock('../models/site_config', () => ({
	getSiteConfig: (...args: any[]) => (getSiteConfig as any)(...args),
	updateSiteConfig: jest.fn(),
	// The filter under test is the real one.
	siteConfigForViewer: jest.requireActual('../models/site_config').siteConfigForViewer,
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const {extractIp} = require('../util/request');
const {
	UserSearchResolver,
	USER_SEARCH_MAX_PAGE_SIZE,
	USER_SEARCH_RATE_LIMIT,
} = require('../resolvers/UserSearch.resolver');
const notificationApi = require('../api/notification');
const solveApi = require('../api/solve');
const {SiteConfigResolver} = require('../resolvers/SiteConfig.resolver');
/* eslint-enable @typescript-eslint/no-var-requires */

beforeEach(() => {
	jest.clearAllMocks();
});

describe('extractIp does not trust the client-written X-Forwarded-For entry', () => {
	it('prefers cf-connecting-ip over a spoofed X-Forwarded-For', () => {
		const req = {headers: {'x-forwarded-for': '6.6.6.6, 198.51.100.4', 'cf-connecting-ip': '198.51.100.4'}};
		expect(extractIp(req)).toBe('198.51.100.4');
	});

	it('falls back to the trust-proxy resolved req.ip, never the first XFF entry', () => {
		const req = {headers: {'x-forwarded-for': '6.6.6.6, 198.51.100.4'}, ip: '198.51.100.4'};
		expect(extractIp(req)).toBe('198.51.100.4');
	});

	it('falls back to the socket address', () => {
		expect(extractIp({headers: {}, socket: {remoteAddress: '203.0.113.9'}})).toBe('203.0.113.9');
		expect(extractIp({headers: {}, connection: {remoteAddress: '203.0.113.10'}})).toBe('203.0.113.10');
		expect(extractIp(undefined)).toBe('');
	});
});

describe('userSearch cannot dump the user table', () => {
	const resolver = new UserSearchResolver();
	const ctx = {req: {headers: {'cf-connecting-ip': '198.51.100.4'}}};

	it('returns nothing for an empty or one-character query without touching the database', async () => {
		for (const searchQuery of ['', ' ', 'a']) {
			const res = await resolver.userSearch(ctx, {page: 0, pageSize: 100, searchQuery});
			expect(res).toEqual({items: [], total: 0, hasMore: false});
		}
		expect(fakePrisma.userAccount.findMany).not.toHaveBeenCalled();
	});

	it('caps the page size and throttles per client IP', async () => {
		await resolver.userSearch(ctx, {page: 0, pageSize: 100, searchQuery: 'ali'});

		const args = fakePrisma.userAccount.findMany.mock.calls[0][0];
		expect(args.take).toBe(USER_SEARCH_MAX_PAGE_SIZE + 1);
		expect(args.where.username.contains).toBe('ali');
		expect(checkRateLimit).toHaveBeenCalledWith(
			'user_search:ip:198.51.100.4',
			USER_SEARCH_RATE_LIMIT.max,
			USER_SEARCH_RATE_LIMIT.windowSeconds
		);
	});

	it('refuses once the per-IP budget is spent', async () => {
		checkRateLimit.mockResolvedValueOnce({allowed: false, count: 99, ttl: 30});
		await expect(resolver.userSearch(ctx, {page: 0, pageSize: 10, searchQuery: 'ali'})).rejects.toMatchObject({
			extensions: {code: 'RATE_LIMITED'},
		});
		expect(fakePrisma.userAccount.findMany).not.toHaveBeenCalled();
	});

	it('still loads users through the public include (no OAuth tokens)', async () => {
		await resolver.userSearch(ctx, {page: 0, pageSize: 10, searchQuery: 'ali'});
		const args = fakePrisma.userAccount.findMany.mock.calls[0][0];
		expect(Object.keys(args.select.integrations.select)).not.toEqual(
			expect.arrayContaining(['auth_token', 'refresh_token'])
		);
	});
});

describe('notification mutations only act on the caller\'s own rows', () => {
	const owner = {id: 'owner-1'};
	const stranger = {id: 'stranger-1'};
	const row = {id: 'n-1', user_id: 'owner-1', message: 'private'};

	it('a stranger can neither read-mark nor delete someone else\'s notification', async () => {
		fakePrisma.notification.findUnique.mockResolvedValue(row);

		const marked = await notificationApi.mutateActions.markNotificationAsRead(null, {id: 'n-1'}, {user: stranger});
		const deleted = await notificationApi.mutateActions.deleteNotification(null, {id: 'n-1'}, {user: stranger});

		expect(marked).toBeInstanceOf(Error);
		expect(deleted).toBeInstanceOf(Error);
		expect(JSON.stringify(marked)).not.toMatch(/private/);
		expect(fakePrisma.notification.update).not.toHaveBeenCalled();
		expect(fakePrisma.notification.delete).not.toHaveBeenCalled();
	});

	it('the owner still can', async () => {
		fakePrisma.notification.findUnique.mockResolvedValue(row);

		await notificationApi.mutateActions.markNotificationAsRead(null, {id: 'n-1'}, {user: owner});
		await notificationApi.mutateActions.deleteNotification(null, {id: 'n-1'}, {user: owner});

		expect(fakePrisma.notification.update).toHaveBeenCalledTimes(1);
		expect(fakePrisma.notification.delete).toHaveBeenCalledTimes(1);
	});
});

describe('public solve reads do not list who viewed the solve', () => {
	function solveRow() {
		return {
			id: 'solve-1',
			user_id: 'owner-1',
			share_code: 'ABCDEFGH',
			solve_views: [{id: 'v-1', viewer_id: 'viewer-9', user_id: 'owner-1', created_at: new Date()}],
		};
	}

	it('hides solve_views from anonymous and other users on both paths', async () => {
		fakePrisma.solve.findUnique.mockImplementation(async () => solveRow());

		const anonById = await solveApi.queryActions.solve(null, {id: 'solve-1'}, {user: null});
		const otherById = await solveApi.queryActions.solve(null, {id: 'solve-1'}, {user: {id: 'x'}});
		const anonByCode = await solveApi.queryActions.solveByShareCode(null, {shareCode: 'ABCDEFGH'}, {user: null, req: null});

		for (const s of [anonById, otherById, anonByCode]) {
			expect(s.solve_views).toEqual([]);
		}
	});

	it('keeps them for the owner', async () => {
		fakePrisma.solve.findUnique.mockImplementation(async () => solveRow());

		const own = await solveApi.queryActions.solve(null, {id: 'solve-1'}, {user: {id: 'owner-1'}});
		expect(own.solve_views).toHaveLength(1);
	});
});

describe('siteConfig hides the admin\'s feature access lists', () => {
	const config = {
		id: 'singleton',
		rooms_enabled: false,
		featureOverrides: [
			{
				feature: 'rooms_enabled',
				mode: 'ALLOWLIST',
				users: [
					{id: 'beta-1', username: 'beta_one'},
					{id: 'beta-2', username: 'beta_two'},
				],
			},
		],
	};
	const resolver = new SiteConfigResolver();

	it('anonymous gets no names, a listed user sees only themselves, admin sees all', async () => {
		getSiteConfig.mockResolvedValue(config);

		const anon = await resolver.siteConfig({user: null});
		const listed = await resolver.siteConfig({user: {id: 'beta-2'}});
		const admin = await resolver.siteConfig({user: {id: 'admin-1', admin: true}});

		expect(anon.featureOverrides[0].users).toEqual([]);
		expect(listed.featureOverrides[0].users).toEqual([{id: 'beta-2', username: 'beta_two'}]);
		expect(admin.featureOverrides[0].users).toHaveLength(2);
		// The cached singleton itself is never mutated.
		expect(config.featureOverrides[0].users).toHaveLength(2);
		expect(anon.featureOverrides[0].mode).toBe('ALLOWLIST');
	});
});

describe('private user types stay behind me and admin roots', () => {
	const PRIVATE_USER_TYPES = ['UserAccount', 'UserAccountForAdmin', 'InternalUserAccount'];
	// Every field that may return a type carrying email / join_ip / IAP ids. All are
	// `me` or @Authorized([Role.ADMIN]). A new entry here needs the same scrutiny.
	const ALLOWED = [
		'Query.me',
		'Query.getUserAccountForAdmin',
		'PaginatedUserAccountsForAdmin.items',
		'Mutation.unbanUserAccount',
		'Mutation.setVerifiedStatus',
		'Mutation.setModStatus',
		'Mutation.setProStatus',
		'Mutation.setPremiumStatus',
		'Mutation.adminDeleteUserAccount',
	];

	it('schema.graphql has no other field returning a private user type', () => {
		const sdl = fs.readFileSync(path.join(__dirname, '..', '..', 'schema.graphql'), 'utf8');
		const schema = buildSdlSchema(sdl);
		const hits: string[] = [];
		for (const type of Object.values(schema.getTypeMap())) {
			if (type.name.startsWith('__')) continue;
			if (!isObjectType(type) && !isInterfaceType(type)) continue;
			for (const [name, field] of Object.entries(type.getFields())) {
				if (PRIVATE_USER_TYPES.includes(getNamedType(field.type)?.name ?? '')) {
					hits.push(`${type.name}.${name}`);
				}
			}
		}
		expect(hits.filter((h) => !ALLOWED.includes(h))).toEqual([]);

		const banLogFields: any = (schema.getType('BanLog') as any).getFields();
		expect(String(banLogFields.created_by.type)).toBe('PublicUserAccount');
		expect(String(banLogFields.banned_user.type)).toBe('PublicUserAccount');
	});
});
