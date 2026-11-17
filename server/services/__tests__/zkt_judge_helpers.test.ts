// "Yardımcılar" (owner, 2026-11-17): an admin picks a Zkt-Timer member as a
// helper of one ZKT competition. A linked member goes straight to the site; one
// without a ZKT link waits here as an invite, which the member's first judge
// call after linking hands to the site as the inviting admin.

jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));

const relay = {
	listHelpers: jest.fn(),
	addHelper: jest.fn(),
	removeHelper: jest.fn(),
};
jest.mock('../ZktJudgeRelay', () => {
	const actual = jest.requireActual('../ZktJudgeRelay');
	return {...actual, ZktJudgeRelay: relay};
});

// Integrations by Timer user id; invites by `${competition}|${user}`.
const links: Record<string, string | null> = {};
const invites = new Map<string, {id: string; competition_id: string; user_id: string; invited_by_id: string}>();
const users: Record<string, {id: string; username: string}> = {};
const prisma = {
	integration: {
		findFirst: jest.fn(async ({where}: any) => (links[where.user_id] ? {zkt_user_id: links[where.user_id]} : null)),
	},
	userAccount: {
		findUnique: jest.fn(async ({where}: any) => users[where.id] || null),
		findMany: jest.fn(async () =>
			Object.values(users).map((u) => ({
				...u,
				integrations: links[u.id] ? [{zkt_user_id: links[u.id], zkt_name: `ZKT ${u.username}`, zkt_id: '2026TEST01'}] : [],
			}))
		),
	},
	zktJudgeHelperInvite: {
		findMany: jest.fn(async ({where}: any) =>
			[...invites.values()]
				.filter((i) => i.competition_id === where.competition_id)
				.map((i) => ({user_id: i.user_id, created_at: new Date('2026-11-17T10:00:00Z'), user: {username: users[i.user_id].username}}))
		),
		findUnique: jest.fn(async ({where}: any) => {
			const k = where.competition_id_user_id;
			return invites.get(`${k.competition_id}|${k.user_id}`) || null;
		}),
		upsert: jest.fn(async ({create}: any) => {
			const key = `${create.competition_id}|${create.user_id}`;
			if (!invites.has(key)) invites.set(key, {id: `inv-${invites.size + 1}`, ...create});
		}),
		deleteMany: jest.fn(async ({where}: any) => {
			for (const [key, i] of invites) {
				if (where.id ? i.id === where.id : i.competition_id === where.competition_id && i.user_id === where.user_id) {
					invites.delete(key);
				}
			}
		}),
	},
};
jest.mock('../../database', () => ({getPrisma: () => prisma}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {JudgeRelayError} = require('../ZktJudgeRelay');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const helpers = require('../zkt_judge_helpers');

const COMP = 'zkt-bursa-2026';

beforeEach(() => {
	for (const k of Object.keys(links)) delete links[k];
	for (const k of Object.keys(users)) delete users[k];
	invites.clear();
	Object.values(relay).forEach((fn) => fn.mockReset().mockResolvedValue({helpers: []}));
	users.admin = {id: 'admin', username: 'ibrhyyme'};
	users.linked = {id: 'linked', username: 'yardimci'};
	users.fresh = {id: 'fresh', username: 'yeniuye'};
	links.admin = 'site-admin';
	links.linked = 'site-linked';
});

describe('adding', () => {
	it('a linked member goes straight to the site, as the admin', async () => {
		await helpers.addHelper('site-admin', 'admin', COMP, 'linked');
		expect(relay.addHelper).toHaveBeenCalledWith('site-admin', COMP, 'site-linked');
		expect(invites.size).toBe(0);
	});

	it('a member without a ZKT link waits as an invite, once the site said the admin may pick', async () => {
		const state = await helpers.addHelper('site-admin', 'admin', COMP, 'fresh');
		expect(relay.listHelpers).toHaveBeenCalledWith('site-admin', COMP);
		expect(relay.addHelper).not.toHaveBeenCalled();
		expect(state.pending).toEqual([{userId: 'fresh', username: 'yeniuye', invitedAt: '2026-11-17T10:00:00.000Z'}]);
	});

	it('no invite when the site refuses the admin', async () => {
		relay.listHelpers.mockRejectedValue(new JudgeRelayError('NO_PERMISSION', 403, 'Yardımcı atama yetkin yok.'));
		await expect(helpers.addHelper('site-x', 'x', COMP, 'fresh')).rejects.toMatchObject({code: 'NO_PERMISSION'});
		expect(invites.size).toBe(0);
	});

	it('an unknown Timer user is refused without asking the site', async () => {
		await expect(helpers.addHelper('site-admin', 'admin', COMP, 'nobody')).rejects.toMatchObject({code: 'UNKNOWN_MEMBER'});
		expect(relay.addHelper).not.toHaveBeenCalled();
	});
});

describe('the link arrives', () => {
	beforeEach(async () => {
		await helpers.addHelper('site-admin', 'admin', COMP, 'fresh');
		relay.addHelper.mockClear();
	});

	it('the first judge call hands the invite over as the inviting admin and drops it', async () => {
		await helpers.claimHelperInvite('fresh', COMP, 'site-fresh');
		expect(relay.addHelper).toHaveBeenCalledWith('site-admin', COMP, 'site-fresh');
		expect(invites.size).toBe(0);
	});

	it('the site down keeps the invite for the next call', async () => {
		relay.addHelper.mockRejectedValue(new JudgeRelayError('JUDGE_UNAVAILABLE', 0, 'x'));
		await helpers.claimHelperInvite('fresh', COMP, 'site-fresh');
		expect(invites.size).toBe(1);
		relay.addHelper.mockResolvedValue({helpers: []});
		await helpers.claimHelperInvite('fresh', COMP, 'site-fresh');
		expect(invites.size).toBe(0);
	});

	it('the online switch off keeps it too', async () => {
		relay.addHelper.mockRejectedValue(new JudgeRelayError('DISABLED', 409, 'x'));
		await helpers.claimHelperInvite('fresh', COMP, 'site-fresh');
		expect(invites.size).toBe(1);
	});

	it('an admin who lost the right drops it', async () => {
		relay.addHelper.mockRejectedValue(new JudgeRelayError('NO_PERMISSION', 403, 'x'));
		await helpers.claimHelperInvite('fresh', COMP, 'site-fresh');
		expect(invites.size).toBe(0);
	});

	it('nothing to do at another competition, and never a throw', async () => {
		await expect(helpers.claimHelperInvite('fresh', 'zkt-other-2026', 'site-fresh')).resolves.toBeUndefined();
		expect(relay.addHelper).not.toHaveBeenCalled();
		prisma.zktJudgeHelperInvite.findUnique.mockRejectedValueOnce(new Error('db down'));
		await expect(helpers.claimHelperInvite('fresh', COMP, 'site-fresh')).resolves.toBeUndefined();
	});
});

describe('search and removal', () => {
	it('marks who is already a helper or waiting', async () => {
		await helpers.addHelper('site-admin', 'admin', COMP, 'fresh');
		relay.listHelpers.mockResolvedValue({helpers: [{memberId: 'site-linked', name: 'Yardımcı'}]});
		const found = await helpers.searchHelperCandidates('site-admin', COMP, 'y');
		expect(found).toEqual([]);
		const results = await helpers.searchHelperCandidates('site-admin', COMP, 'ye');
		const byUser = Object.fromEntries(results.map((r: any) => [r.userId, r]));
		expect(byUser.linked).toMatchObject({linked: true, status: 'helper', zktId: '2026TEST01'});
		expect(byUser.fresh).toMatchObject({linked: false, status: 'pending'});
		expect(byUser.admin).toMatchObject({linked: true, status: null});
	});

	it('a site helper is removed on the site, an invite here', async () => {
		await helpers.addHelper('site-admin', 'admin', COMP, 'fresh');
		await helpers.removeHelper('site-admin', COMP, {memberId: 'site-linked'});
		expect(relay.removeHelper).toHaveBeenCalledWith('site-admin', COMP, 'site-linked');
		expect(invites.size).toBe(1);
		await helpers.removeHelper('site-admin', COMP, {userId: 'fresh'});
		expect(invites.size).toBe(0);
	});
});
