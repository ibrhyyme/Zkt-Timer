import axios from 'axios';
import {getPrisma} from '../../database';
import {FOLLOW_UP_MS, LINK_WINDOW_MS, runCompetitionProGiftTick, SETTLE_MS} from '../competition_pro_gift';

jest.mock('axios');
jest.mock('../../database');
jest.mock('../logger', () => ({
	logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
}));
jest.mock('../push', () => ({sendPushToUser: jest.fn()}));
jest.mock('../../models/user_account', () => ({getUserByIdWithSettings: jest.fn().mockResolvedValue(null)}));
jest.mock('../../resources/notification_types/membership_granted', () => jest.fn());

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

const NOW = new Date('2026-11-16T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function campaign(over: any = {}) {
	return {
		id: 'c1',
		zkt_competition_id: 'bursa',
		newcomer_days: 30,
		returning_days: 14,
		status: 'armed',
		processed_at: null,
		...over,
	};
}

function participants(publishedAgoMs: number | null, competitors: any[] = []) {
	return {
		data: {
			competition: {
				id: 'bursa',
				results_published_at: publishedAgoMs === null ? null : new Date(NOW.getTime() - publishedAgoMs).toISOString(),
			},
			published: publishedAgoMs !== null,
			competitors,
		},
	};
}

function stub(opts: {campaigns?: any[]; gifts?: any[]; link?: any; account?: any; claimCount?: number} = {}) {
	const tx = {
		competitionProGift: {updateMany: jest.fn().mockResolvedValue({count: opts.claimCount ?? 1})},
		userAccount: {update: jest.fn().mockResolvedValue({})},
	};
	const prisma = {
		competitionProCampaign: {
			findMany: jest.fn().mockResolvedValue(opts.campaigns ?? []),
			update: jest.fn().mockResolvedValue({}),
		},
		competitionProGift: {
			findMany: jest.fn().mockResolvedValue(opts.gifts ?? []),
			createMany: jest.fn().mockResolvedValue({count: 0}),
			updateMany: jest.fn().mockResolvedValue({count: 1}),
		},
		integration: {findFirst: jest.fn().mockResolvedValue(opts.link ?? null)},
		userAccount: {findUnique: jest.fn().mockResolvedValue(opts.account ?? null)},
		$transaction: jest.fn((fn: any) => fn(tx)),
	};
	mockedGetPrisma.mockReturnValue(prisma as any);
	return {prisma, tx};
}

const freeAccount = {is_pro: false, pro_expires_at: null, is_premium: false, premium_expires_at: null, iap_product_id: null};

beforeEach(() => {
	jest.clearAllMocks();
	process.env.ZKT_INTERNAL_API_SECRET = 'secret';
});

afterAll(() => {
	delete process.env.ZKT_INTERNAL_API_SECRET;
});

describe('campaigns', () => {
	it('hands nothing out while the results are not published', async () => {
		const {prisma} = stub({campaigns: [campaign()]});
		mockedAxios.get.mockResolvedValue(participants(null));
		await runCompetitionProGiftTick(NOW);
		expect(prisma.competitionProGift.createMany).not.toHaveBeenCalled();
		expect(prisma.competitionProCampaign.update).not.toHaveBeenCalled();
	});

	it('waits out the settle window after a publish', async () => {
		const {prisma} = stub({campaigns: [campaign()]});
		mockedAxios.get.mockResolvedValue(
			participants(SETTLE_MS - 60000, [{sub: 'u1', identity: 'u1', kind: 'newcomer', name: 'A'}])
		);
		await runCompetitionProGiftTick(NOW);
		expect(prisma.competitionProGift.createMany).not.toHaveBeenCalled();
	});

	it('records one gift per competitor with the days of their kind, skipping anyone who has one', async () => {
		const {prisma} = stub({campaigns: [campaign()]});
		mockedAxios.get.mockResolvedValue(
			participants(SETTLE_MS + 60000, [
				{sub: 'u1', identity: 'u1', kind: 'newcomer', name: 'Ayşe'},
				{sub: 'u2', identity: 'u0', kind: 'returning', name: 'Mehmet'},
			])
		);
		await runCompetitionProGiftTick(NOW);
		const arg = prisma.competitionProGift.createMany.mock.calls[0][0];
		expect(arg.skipDuplicates).toBe(true);
		expect(arg.data).toEqual([
			expect.objectContaining({zkt_user_id: 'u1', identity_sub: 'u1', kind: 'newcomer', days: 30, status: 'pending_link'}),
			expect.objectContaining({zkt_user_id: 'u2', identity_sub: 'u0', kind: 'returning', days: 14, status: 'pending_link'}),
		]);
		expect(prisma.competitionProCampaign.update).toHaveBeenCalledWith({
			where: {id: 'c1'},
			data: {status: 'processing', processed_at: NOW},
		});
	});

	it('closes a campaign once the follow-up week is over, without asking the federation', async () => {
		const {prisma} = stub({
			campaigns: [campaign({status: 'processing', processed_at: new Date(NOW.getTime() - FOLLOW_UP_MS - 1000)})],
		});
		await runCompetitionProGiftTick(NOW);
		expect(mockedAxios.get).not.toHaveBeenCalled();
		expect(prisma.competitionProCampaign.update).toHaveBeenCalledWith({where: {id: 'c1'}, data: {status: 'done'}});
	});
});

describe('gifts', () => {
	const gift = (over: any = {}) => ({
		id: 'g1',
		zkt_user_id: 'u1',
		days: 30,
		status: 'pending_link',
		created_at: new Date(NOW.getTime() - DAY),
		...over,
	});

	it('keeps waiting for a link inside the window and expires after it', async () => {
		const young = stub({gifts: [gift()]});
		await runCompetitionProGiftTick(NOW);
		expect(young.prisma.competitionProGift.updateMany).not.toHaveBeenCalled();

		const old = stub({gifts: [gift({created_at: new Date(NOW.getTime() - LINK_WINDOW_MS - 1000)})]});
		await runCompetitionProGiftTick(NOW);
		expect(old.prisma.competitionProGift.updateMany).toHaveBeenCalledWith({
			where: {id: 'g1', status: 'pending_link'},
			data: {status: 'expired'},
		});
	});

	it('grants the days from now to a linked member without Pro', async () => {
		const {tx} = stub({gifts: [gift()], link: {user_id: 'acc1'}, account: freeAccount});
		await runCompetitionProGiftTick(NOW);
		const until = new Date(NOW.getTime() + 30 * DAY);
		expect(tx.competitionProGift.updateMany).toHaveBeenCalledWith({
			where: {id: 'g1', status: 'pending_link'},
			data: {status: 'granted', user_id: 'acc1', granted_at: NOW, pro_until: until},
		});
		expect(tx.userAccount.update).toHaveBeenCalledWith({
			where: {id: 'acc1'},
			data: {is_pro: true, pro_expires_at: until},
		});
	});

	it('writes no Pro when another tick already claimed the gift', async () => {
		const {tx} = stub({gifts: [gift()], link: {user_id: 'acc1'}, account: freeAccount, claimCount: 0});
		await runCompetitionProGiftTick(NOW);
		expect(tx.userAccount.update).not.toHaveBeenCalled();
	});

	it('holds the gift for a paying store subscriber', async () => {
		const {prisma, tx} = stub({
			gifts: [gift()],
			link: {user_id: 'acc1'},
			account: {...freeAccount, is_pro: true, pro_expires_at: new Date(NOW.getTime() + 10 * DAY), iap_product_id: 'zkt_pro_monthly'},
		});
		await runCompetitionProGiftTick(NOW);
		expect(prisma.competitionProGift.updateMany).toHaveBeenCalledWith({
			where: {id: 'g1', status: 'pending_link'},
			data: {status: 'deferred_store', user_id: 'acc1'},
		});
		expect(tx.userAccount.update).not.toHaveBeenCalled();
	});

	it('skips Pro that never ends', async () => {
		const {prisma, tx} = stub({
			gifts: [gift()],
			link: {user_id: 'acc1'},
			account: {...freeAccount, is_pro: true, pro_expires_at: null, iap_product_id: 'zkt_pro_lifetime'},
		});
		await runCompetitionProGiftTick(NOW);
		expect(prisma.competitionProGift.updateMany).toHaveBeenCalledWith({
			where: {id: 'g1', status: 'pending_link'},
			data: {status: 'skipped', skip_reason: 'lifetime', user_id: 'acc1'},
		});
		expect(tx.userAccount.update).not.toHaveBeenCalled();
	});
});
