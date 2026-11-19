import {getPrisma} from '../../database';
import {getSiteConfig} from '../../models/site_config';
import {insertMessage, isBlockedBetween, openAdminConversation} from '../../models/messaging';
import {deliverMessage} from '../dm_delivery';
import {maybeSendWelcomeMessage} from '../welcome_message';
import {WELCOME_MESSAGE_KIND, isAcquisitionSource, isWelcomeCandidate} from '../../../shared/welcome';

jest.mock('../../database');
jest.mock('../../models/site_config', () => ({getSiteConfig: jest.fn()}));
jest.mock('../../models/messaging', () => ({
	insertMessage: jest.fn(),
	isBlockedBetween: jest.fn(),
	openAdminConversation: jest.fn(),
}));
jest.mock('../dm_delivery', () => ({deliverMessage: jest.fn()}));
jest.mock('../logger', () => ({
	logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
}));

const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;
const mockedConfig = getSiteConfig as jest.MockedFunction<typeof getSiteConfig>;

const NEW_USER = {id: 'u1', created_at: new Date(), welcome_sent_at: null};

function stub(opts: {minutes?: number; sender?: any; claimCount?: number; locale?: string; zktLinks?: number} = {}) {
	const prisma = {
		userActivityHeartbeat: {count: jest.fn().mockResolvedValue(opts.minutes ?? 2)},
		integration: {count: jest.fn().mockResolvedValue(opts.zktLinks ?? 0)},
		userAccount: {
			findUnique: jest.fn().mockImplementation(({where}) =>
				Promise.resolve(
					where.id === 'admin1'
						? opts.sender === undefined
							? {id: 'admin1', username: 'ibrhyyme', admin: true}
							: opts.sender
						: {username: 'newcuber', settings: {locale: opts.locale ?? 'tr'}}
				)
			),
			updateMany: jest.fn().mockResolvedValue({count: opts.claimCount ?? 1}),
		},
	};
	mockedGetPrisma.mockReturnValue(prisma as any);
	return prisma;
}

beforeEach(() => {
	jest.clearAllMocks();
	mockedConfig.mockResolvedValue({
		welcome_message_enabled: true,
		welcome_sender_id: 'admin1',
		messaging_enabled: true,
	} as any);
	(isBlockedBetween as jest.Mock).mockResolvedValue(false);
	(openAdminConversation as jest.Mock).mockResolvedValue('conv1');
	(insertMessage as jest.Mock).mockImplementation((p) => Promise.resolve({id: 'm1', ...p}));
});

describe('isWelcomeCandidate', () => {
	const now = new Date('2026-11-19T12:00:00Z').getTime();

	it('takes an account from the last three days that has not had the message', () => {
		expect(isWelcomeCandidate({created_at: new Date(now - 60_000), welcome_sent_at: null}, now)).toBe(true);
	});

	it('skips older accounts and anyone who already got it', () => {
		expect(isWelcomeCandidate({created_at: new Date(now - 4 * 86_400_000), welcome_sent_at: null}, now)).toBe(false);
		expect(isWelcomeCandidate({created_at: new Date(now - 60_000), welcome_sent_at: new Date(now)}, now)).toBe(false);
	});
});

describe('isAcquisitionSource', () => {
	it('accepts only the listed answers', () => {
		expect(isAcquisitionSource('instagram')).toBe(true);
		expect(isAcquisitionSource('facebook')).toBe(false);
		expect(isAcquisitionSource(undefined)).toBe(false);
	});
});

describe('maybeSendWelcomeMessage', () => {
	it('sends once, as the admin, in the member language, marked as the welcome message', async () => {
		const prisma = stub({locale: 'tr'});

		await maybeSendWelcomeMessage(NEW_USER);

		expect(prisma.userAccount.updateMany).toHaveBeenCalledWith({
			where: {id: 'u1', welcome_sent_at: null},
			data: {welcome_sent_at: expect.any(Date)},
		});
		expect(openAdminConversation).toHaveBeenCalledWith('admin1', 'u1');
		const sent = (insertMessage as jest.Mock).mock.calls[0][0];
		expect(sent.senderId).toBe('admin1');
		expect(sent.kind).toBe(WELCOME_MESSAGE_KIND);
		expect(sent.body).toContain('Merhaba newcuber');
		expect(sent.body).toContain('Destek');
		expect(sent.body).toContain('ibrhyyme');
		expect(deliverMessage).toHaveBeenCalledWith(
			expect.objectContaining({recipients: [{id: 'u1', accepted: true}]})
		);
	});

	it('does nothing for an account that is not new, without touching the database', async () => {
		const prisma = stub();
		await maybeSendWelcomeMessage({id: 'u1', created_at: new Date('2020-01-01'), welcome_sent_at: null});
		expect(mockedConfig).not.toHaveBeenCalled();
		expect(prisma.userActivityHeartbeat.count).not.toHaveBeenCalled();
	});

	it('waits until the second active minute', async () => {
		const prisma = stub({minutes: 1});
		await maybeSendWelcomeMessage(NEW_USER);
		expect(prisma.userAccount.updateMany).not.toHaveBeenCalled();
		expect(insertMessage).not.toHaveBeenCalled();
	});

	it('skips someone who signed up with a ZKT ID', async () => {
		const prisma = stub({zktLinks: 1});
		await maybeSendWelcomeMessage(NEW_USER);
		expect(prisma.integration.count).toHaveBeenCalledWith({where: {user_id: 'u1', service_name: 'zkt'}});
		expect(prisma.userAccount.updateMany).not.toHaveBeenCalled();
		expect(insertMessage).not.toHaveBeenCalled();
	});

	it('stays quiet while the switch is off', async () => {
		stub();
		mockedConfig.mockResolvedValue({welcome_message_enabled: false, welcome_sender_id: 'admin1', messaging_enabled: true} as any);
		await maybeSendWelcomeMessage(NEW_USER);
		expect(insertMessage).not.toHaveBeenCalled();
	});

	it('refuses a sender who is no longer an admin', async () => {
		const prisma = stub({sender: {id: 'admin1', username: 'x', admin: false}});
		await maybeSendWelcomeMessage(NEW_USER);
		expect(prisma.userAccount.updateMany).not.toHaveBeenCalled();
		expect(insertMessage).not.toHaveBeenCalled();
	});

	it('lets only the heartbeat that won the claim send', async () => {
		stub({claimCount: 0});
		await maybeSendWelcomeMessage(NEW_USER);
		expect(insertMessage).not.toHaveBeenCalled();
	});

	it('respects a block between the two accounts', async () => {
		stub();
		(isBlockedBetween as jest.Mock).mockResolvedValue(true);
		await maybeSendWelcomeMessage(NEW_USER);
		expect(insertMessage).not.toHaveBeenCalled();
	});
});
