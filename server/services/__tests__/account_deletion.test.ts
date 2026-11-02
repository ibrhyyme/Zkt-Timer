// Account deletion reaches outside the database: uploads on disk, WCA and ZKT grants and the
// RevenueCat customer. The order is the point: rows are read before they cascade away, and
// nothing outside the database is touched for good until the delete has gone through.

const calls: string[] = [];

const prisma = {
	image: {findMany: jest.fn()},
	timerBackground: {findUnique: jest.fn()},
	supportTicketAttachment: {findMany: jest.fn()},
	integration: {findMany: jest.fn()},
	userAccount: {findUnique: jest.fn()},
};
jest.mock('../../database', () => ({getPrisma: () => prisma}));

const logger = {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()};
jest.mock('../logger', () => ({logger}));

const revokeIntegration = jest.fn();
jest.mock('../../integrations/oauth', () => ({
	revokeIntegration: (...a: any[]) => revokeIntegration(...a),
}));

const deleteRevenueCatCustomer = jest.fn();
jest.mock('../../models/iap', () => ({
	deleteRevenueCatCustomer: (...a: any[]) => deleteRevenueCatCustomer(...a),
}));

const deleteUserAccount = jest.fn();
jest.mock('../../models/user_account', () => ({
	deleteUserAccount: (...a: any[]) => deleteUserAccount(...a),
}));

const deleteObject = jest.fn();
jest.mock('../storage', () => ({deleteObject: (...a: any[]) => deleteObject(...a)}));

import {deleteAccountCompletely} from '../account_deletion';

const user = {id: 'user-1'} as any;

beforeEach(() => {
	jest.clearAllMocks();
	calls.length = 0;

	prisma.image.findMany.mockResolvedValue([
		{storage_path: 'images/pfp.jpg'},
		{storage_path: 'images/header.jpg'},
		{storage_path: null},
	]);
	prisma.timerBackground.findUnique.mockResolvedValue({
		storage_path: 'timer_backgrounds/desktop.png',
		mobile_storage_path: 'timer_backgrounds/mobile.png',
	});
	prisma.supportTicketAttachment.findMany.mockResolvedValue([
		{storage_path: 'support_ticket_attachments/clip.mp4'},
	]);
	prisma.integration.findMany.mockResolvedValue([{service_name: 'wca'}, {service_name: 'zkt'}]);
	prisma.userAccount.findUnique.mockResolvedValue({revenuecat_user_id: 'rc-1'});

	revokeIntegration.mockImplementation(async (service: string) => {
		calls.push(`revoke:${service}`);
	});
	deleteUserAccount.mockImplementation(async () => {
		calls.push('db');
	});
	deleteObject.mockImplementation(async (path: string) => {
		calls.push(`file:${path}`);
	});
	deleteRevenueCatCustomer.mockImplementation(async () => {
		calls.push('revenuecat');
	});
});

describe('deleteAccountCompletely', () => {
	it('removes every uploaded file, ends both grants and deletes the RevenueCat customer', async () => {
		await deleteAccountCompletely(user);

		expect(deleteObject.mock.calls.map((c) => c[0]).sort()).toEqual([
			'images/header.jpg',
			'images/pfp.jpg',
			'support_ticket_attachments/clip.mp4',
			'timer_backgrounds/desktop.png',
			'timer_backgrounds/mobile.png',
		]);
		expect(revokeIntegration).toHaveBeenCalledWith('wca', user);
		expect(revokeIntegration).toHaveBeenCalledWith('zkt', user);
		expect(deleteRevenueCatCustomer).toHaveBeenCalledWith('rc-1');
	});

	it('covers attachments on the user\'s own tickets and ones they sent to others', async () => {
		await deleteAccountCompletely(user);

		expect(prisma.supportTicketAttachment.findMany.mock.calls[0][0].where).toEqual({
			message: {OR: [{sender_id: 'user-1'}, {ticket: {created_by_id: 'user-1'}}]},
		});
	});

	it('revokes before the delete, because the tokens live in rows the delete removes', async () => {
		await deleteAccountCompletely(user);

		expect(calls.indexOf('revoke:wca')).toBeLessThan(calls.indexOf('db'));
		expect(calls.indexOf('revoke:zkt')).toBeLessThan(calls.indexOf('db'));
	});

	it('removes files and the customer only after the delete went through', async () => {
		await deleteAccountCompletely(user);

		const db = calls.indexOf('db');
		expect(calls.indexOf('file:images/pfp.jpg')).toBeGreaterThan(db);
		expect(calls.indexOf('revenuecat')).toBeGreaterThan(db);
	});

	it('leaves the grants alone when the account could not be read', async () => {
		prisma.image.findMany.mockRejectedValue(new Error('database down'));

		await expect(deleteAccountCompletely(user)).rejects.toThrow('database down');

		expect(revokeIntegration).not.toHaveBeenCalled();
		expect(deleteUserAccount).not.toHaveBeenCalled();
	});

	it('leaves files and the customer alone when the delete fails', async () => {
		deleteUserAccount.mockRejectedValue(new Error('transaction failed'));

		await expect(deleteAccountCompletely(user)).rejects.toThrow('transaction failed');

		expect(deleteObject).not.toHaveBeenCalled();
		expect(deleteRevenueCatCustomer).not.toHaveBeenCalled();
	});

	it('writes a shared desktop and mobile background off once', async () => {
		prisma.timerBackground.findUnique.mockResolvedValue({
			storage_path: 'timer_backgrounds/same.png',
			mobile_storage_path: 'timer_backgrounds/same.png',
		});

		await deleteAccountCompletely(user);

		expect(deleteObject.mock.calls.filter((c) => c[0] === 'timer_backgrounds/same.png')).toHaveLength(1);
	});

	it('copes with a user who never uploaded or linked anything', async () => {
		prisma.image.findMany.mockResolvedValue([]);
		prisma.timerBackground.findUnique.mockResolvedValue(null);
		prisma.supportTicketAttachment.findMany.mockResolvedValue([]);
		prisma.integration.findMany.mockResolvedValue([]);
		prisma.userAccount.findUnique.mockResolvedValue({revenuecat_user_id: null});

		await deleteAccountCompletely(user);

		expect(deleteUserAccount).toHaveBeenCalledWith(user);
		expect(deleteObject).not.toHaveBeenCalled();
		expect(revokeIntegration).not.toHaveBeenCalled();
		expect(deleteRevenueCatCustomer).not.toHaveBeenCalled();
	});

	it('still deletes the account when a provider refuses the revoke', async () => {
		revokeIntegration.mockRejectedValue(new Error('provider down'));

		await deleteAccountCompletely(user);

		expect(deleteUserAccount).toHaveBeenCalledWith(user);
		expect(deleteObject).toHaveBeenCalled();
		expect(logger.warn).toHaveBeenCalledWith(
			'[AccountDeletion] grant revoke failed',
			expect.objectContaining({service: 'wca'})
		);
	});

	it('still deletes the account when a provider never answers', async () => {
		const wait = jest.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void) => {
			fn();
			return 0;
		}) as any);
		try {
			revokeIntegration.mockImplementation(() => new Promise(() => {}));

			await deleteAccountCompletely(user);

			expect(wait.mock.calls[0][1]).toBe(10000);
			expect(deleteUserAccount).toHaveBeenCalledWith(user);
		} finally {
			wait.mockRestore();
		}
	});

	it('finishes the remaining files when one delete throws', async () => {
		deleteObject.mockRejectedValueOnce(new Error('EPERM'));

		await deleteAccountCompletely(user);

		expect(deleteObject).toHaveBeenCalledTimes(5);
		expect(deleteRevenueCatCustomer).toHaveBeenCalledWith('rc-1');
	});

	it('does not fail the request when RevenueCat refuses', async () => {
		deleteRevenueCatCustomer.mockRejectedValue(new Error('RevenueCat API error 500'));

		await expect(deleteAccountCompletely(user)).resolves.toBeUndefined();
	});
});
