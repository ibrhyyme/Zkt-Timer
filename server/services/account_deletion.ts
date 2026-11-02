import {getPrisma} from '../database';
import {revokeIntegration} from '../integrations/oauth';
import {deleteRevenueCatCustomer} from '../models/iap';
import {deleteUserAccount} from '../models/user_account';
import {UserAccount} from '../schemas/UserAccount.schema';
import {IntegrationType} from '../../shared/integration';
import {logger} from './logger';
import {deleteObject} from './storage';

/**
 * Deleting an account has to reach further than the database.
 *
 * `deleteUserAccount` removes the rows, but uploads stay on disk, the provider grants stay
 * valid and RevenueCat keeps its customer record. The privacy page promises permanent
 * deletion, so every entry point (the user's own request, an admin's) comes through here.
 *
 * Everything outside the database is best-effort. A provider that is down must not leave
 * someone stuck with an account they asked to remove, so failures are logged and passed over.
 */

const REMOTE_CALL_TIMEOUT_MS = 10000;

/** Every file the account's rows point at. Those rows cascade away, so this runs first. */
async function collectStoragePaths(userId: string): Promise<string[]> {
	const prisma = getPrisma();
	const [images, background, attachments] = await Promise.all([
		prisma.image.findMany({where: {user_id: userId}, select: {storage_path: true}}),
		prisma.timerBackground.findUnique({
			where: {user_id: userId},
			select: {storage_path: true, mobile_storage_path: true},
		}),
		// Ticket messages cascade from both sides: the ticket's owner and the sender.
		prisma.supportTicketAttachment.findMany({
			where: {message: {OR: [{sender_id: userId}, {ticket: {created_by_id: userId}}]}},
			select: {storage_path: true},
		}),
	]);

	const paths = [
		...images.map((image) => image.storage_path),
		background?.storage_path,
		background?.mobile_storage_path,
		...attachments.map((attachment) => attachment.storage_path),
	];

	return [...new Set(paths.filter(Boolean))];
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
	let timer: ReturnType<typeof setTimeout>;
	const timeout = new Promise<never>((_, reject) => {
		timer = setTimeout(() => reject(new Error('timed out')), REMOTE_CALL_TIMEOUT_MS);
	});
	return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Ends the WCA and ZKT grants. Runs before the delete because `revokeIntegration` reads
 * the stored token, and refreshes it first when it has expired.
 */
async function revokeProviderGrants(user: UserAccount): Promise<void> {
	const integrations = await getPrisma().integration.findMany({
		where: {user_id: user.id},
		select: {service_name: true},
	});

	await Promise.all(
		integrations.map(async ({service_name}) => {
			try {
				await withTimeout(revokeIntegration(service_name as IntegrationType, user));
			} catch (err: any) {
				logger.warn('[AccountDeletion] grant revoke failed', {
					userId: user.id,
					service: service_name,
					error: err?.message,
				});
			}
		})
	);
}

async function removeFiles(userId: string, storagePaths: string[]): Promise<void> {
	for (const storagePath of storagePaths) {
		try {
			await deleteObject(storagePath);
		} catch (err: any) {
			logger.warn('[AccountDeletion] file delete failed', {userId, storagePath, error: err?.message});
		}
	}
}

async function removeRevenueCatCustomer(userId: string, revenueCatUserId?: string | null): Promise<void> {
	// Only native logins ever reach RevenueCat, and those always store the id.
	if (!revenueCatUserId) return;
	try {
		await withTimeout(deleteRevenueCatCustomer(revenueCatUserId));
	} catch (err: any) {
		logger.warn('[AccountDeletion] RevenueCat delete failed', {userId, error: err?.message});
	}
}

export async function deleteAccountCompletely(user: UserAccount): Promise<void> {
	const [storagePaths, account] = await Promise.all([
		collectStoragePaths(user.id),
		getPrisma().userAccount.findUnique({where: {id: user.id}, select: {revenuecat_user_id: true}}),
	]);

	// Only after the reads: a failed read must not cost a surviving account its grants.
	await revokeProviderGrants(user);

	// Throws when the transaction fails, which leaves the files and the customer record
	// in place for an account that still exists.
	await deleteUserAccount(user);

	await removeFiles(user.id, storagePaths);
	await removeRevenueCatCustomer(user.id, account?.revenuecat_user_id);
}
