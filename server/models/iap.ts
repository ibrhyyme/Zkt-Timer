import {getPrisma} from '../database';
import {logger} from '../services/logger';
import {sendPushToUser} from '../services/push';
import {createRedisKey, keyExistsInRedis, setKeyInRedis, RedisNamespace} from '../services/redis';
import MembershipGrantedNotification from '../resources/notification_types/membership_granted';
import {UserAccount} from '../schemas/UserAccount.schema';

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 gun

/**
 * RevenueCat event id'si icin idempotency kontrolu.
 * Ayni event 2. kez gelirse true doner (skip).
 */
export async function isEventProcessed(eventId: string): Promise<boolean> {
	const key = createRedisKey(RedisNamespace.IAP_EVENTS, eventId);
	const exists = await keyExistsInRedis(key);
	return exists > 0;
}

export async function markEventProcessed(eventId: string): Promise<void> {
	const key = createRedisKey(RedisNamespace.IAP_EVENTS, eventId);
	await setKeyInRedis(key, '1', IDEMPOTENCY_TTL_SECONDS);
}

export type IapPlatform = 'ios' | 'android';

export interface IapPurchaseUpdate {
	userId: string;
	platform: IapPlatform;
	productId: string;
	originalTxId: string | null;
	expiresAt: Date | null; // null = lifetime (non-renewing purchase)
	eventAt: Date;
}

/**
 * INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, NON_RENEWING_PURCHASE (lifetime) event'lerinde cagrilir.
 * is_pro=true + pro_expires_at guncellenir.
 */
export async function applyIapPurchase(update: IapPurchaseUpdate, firePush = true): Promise<void> {
	const prisma = getPrisma();

	const targetUser = await prisma.userAccount.findUnique({where: {id: update.userId}});
	if (!targetUser) {
		logger.warn('[IAP] Kullanici bulunamadi', {userId: update.userId});
		return;
	}

	await prisma.userAccount.update({
		where: {id: update.userId},
		data: {
			is_pro: true,
			pro_expires_at: update.expiresAt,
			iap_platform: update.platform,
			iap_product_id: update.productId,
			iap_original_tx_id: update.originalTxId,
			iap_latest_event_at: update.eventAt,
			iap_cancellation_at: null, // yeni satin almada cancel state temizlenir
			iap_billing_issue_at: null,
			iap_paused_until: null,
		},
	});

	if (firePush) {
		try {
			const notification = new MembershipGrantedNotification(
				{user: targetUser as unknown as UserAccount, triggeringUser: undefined, sendEmail: false},
				'pro',
				update.expiresAt
			);
			await notification.send();
			await sendPushToUser(targetUser.id, notification.subject(), notification.inAppMessage(), {
				type: 'membership_granted',
				membershipType: 'pro',
			});
		} catch (error) {
			logger.error('[IAP] Push gonderilemedi', {error, userId: update.userId});
		}
	}
}

/**
 * EXPIRATION / REFUND event'lerinde cagrilir.
 * is_pro=false, pro_expires_at=null — aninda Pro kapatilir.
 */
export async function revokeIapPro(userId: string, reason: 'expiration' | 'refund'): Promise<void> {
	const prisma = getPrisma();
	await prisma.userAccount.update({
		where: {id: userId},
		data: {
			is_pro: false,
			pro_expires_at: null,
			iap_latest_event_at: new Date(),
			iap_cancellation_at: null,
			iap_billing_issue_at: null,
		},
	});
	logger.info('[IAP] Pro iptal edildi', {userId, reason});
}

/**
 * CANCELLATION — kullanici iptal etti ama period sonuna kadar access var.
 * is_pro DEGISMEZ, sadece iap_cancellation_at set edilir.
 */
export async function markCancellation(userId: string, cancelledAt: Date): Promise<void> {
	const prisma = getPrisma();
	await prisma.userAccount.update({
		where: {id: userId},
		data: {
			iap_cancellation_at: cancelledAt,
			iap_latest_event_at: new Date(),
		},
	});
}

/**
 * UNCANCELLATION — iptal geri alindi.
 */
export async function clearCancellation(userId: string): Promise<void> {
	const prisma = getPrisma();
	await prisma.userAccount.update({
		where: {id: userId},
		data: {
			iap_cancellation_at: null,
			iap_latest_event_at: new Date(),
		},
	});
}

/**
 * BILLING_ISSUE — kart reddedildi, grace period'da. Access devam.
 */
export async function markBillingIssue(userId: string, issueAt: Date): Promise<void> {
	const prisma = getPrisma();
	await prisma.userAccount.update({
		where: {id: userId},
		data: {
			iap_billing_issue_at: issueAt,
			iap_latest_event_at: new Date(),
		},
	});
}

/**
 * SUBSCRIPTION_PAUSED (Android only) — pause suresince is_pro=false.
 */
export async function pauseSubscription(userId: string, pausedUntil: Date): Promise<void> {
	const prisma = getPrisma();
	await prisma.userAccount.update({
		where: {id: userId},
		data: {
			is_pro: false,
			iap_paused_until: pausedUntil,
			iap_latest_event_at: new Date(),
		},
	});
}

/**
 * Kullanici RevenueCat app_user_id'sini kaydeder (login sirasinda).
 * Zaten kayitliysa no-op.
 */
export async function linkRevenueCatUserId(userId: string): Promise<void> {
	const prisma = getPrisma();
	const user = await prisma.userAccount.findUnique({where: {id: userId}, select: {revenuecat_user_id: true}});
	if (user?.revenuecat_user_id === userId) return;
	await prisma.userAccount.update({
		where: {id: userId},
		data: {revenuecat_user_id: userId},
	});
}
