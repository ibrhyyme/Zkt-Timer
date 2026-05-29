import {getPrisma} from '../database';
import {getUserByIdWithSettings} from './user_account';
import {logger} from '../services/logger';
import {sendPushToUser} from '../services/push';
import {createRedisKey, keyExistsInRedis, setKeyInRedis, RedisNamespace} from '../services/redis';
import MembershipGrantedNotification from '../resources/notification_types/membership_granted';
import {UserAccount, InternalUserAccount} from '../schemas/UserAccount.schema';
import {createI18nInstance} from '../i18n_server';
import {notifyAdminsOfProPurchase} from '../services/admin_notification';

const SUPPORTED_LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

export type IapPushKind = 'initial' | 'change' | 'silent';

interface ProductPlan {
	tier: 'monthly' | 'yearly' | 'lifetime' | 'unknown';
}

export function planFromProductId(productId: string | null | undefined): ProductPlan {
	if (!productId) return {tier: 'unknown'};
	if (productId.endsWith('lifetime')) return {tier: 'lifetime'};
	if (productId.endsWith('yearly')) return {tier: 'yearly'};
	if (productId.endsWith('monthly')) return {tier: 'monthly'};
	return {tier: 'unknown'};
}

const PLAN_RANK: Record<string, number> = {monthly: 1, yearly: 2, lifetime: 3, unknown: 0};

const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Idempotency check for RevenueCat event ID.
 * Returns true if the same event arrives a second time (skip).
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
 * Called on INITIAL_PURCHASE, RENEWAL, PRODUCT_CHANGE, NON_RENEWING_PURCHASE (lifetime) events.
 * Updates is_pro=true + pro_expires_at.
 *
 * pushKind:
 *   'initial' — new purchase, "Pro welcome" notification + push
 *   'change'  — plan change (upgrade/downgrade), "upgraded/downgraded" push (push only, no DB notification)
 *   'silent'  — silent update like RENEWAL, no notification
 */
export async function applyIapPurchase(
	update: IapPurchaseUpdate,
	pushKind: IapPushKind = 'initial'
): Promise<void> {
	const prisma = getPrisma();

	const targetUser = await getUserByIdWithSettings(update.userId);
	if (!targetUser) {
		logger.warn('[IAP] User not found', {userId: update.userId});
		return;
	}

	// For pro_expires_at: max(current, new) — admin/promo Pro's duration is preserved if longer than IAP.
	// Scenario: user has admin Pro for 6 months, buys 1 month IAP -> 6 months should be preserved.
	// Lifetime (expiresAt=null) always wins.
	//
	// CRITICAL: pro_expires_at=null alone does NOT mean "lifetime" — if admin Pro was removed,
	// is_pro=false + pro_expires_at=null. User is truly Lifetime only when is_pro=true AND pro_expires_at=null.
	const currentIsPro = (targetUser as any).is_pro === true;
	const currentExpiry = (targetUser as any).pro_expires_at as Date | null | undefined;
	let newExpiry: Date | null;
	if (update.expiresAt === null) {
		// New IAP lifetime — infinite, always wins
		newExpiry = null;
	} else if (currentIsPro && currentExpiry === null) {
		// User already has true Lifetime — IAP duration is preserved even if it expires
		newExpiry = null;
	} else if (currentIsPro && currentExpiry && currentExpiry > update.expiresAt) {
		// Current Pro duration is longer — preserve it (admin/promo may be longer than IAP)
		newExpiry = currentExpiry;
	} else {
		// No Pro or current duration shorter than new IAP — use RC date
		newExpiry = update.expiresAt;
	}

	await prisma.userAccount.update({
		where: {id: update.userId},
		data: {
			is_pro: true,
			pro_expires_at: newExpiry,
			iap_platform: update.platform,
			iap_product_id: update.productId,
			iap_original_tx_id: update.originalTxId,
			iap_latest_event_at: update.eventAt,
			iap_cancellation_at: null, // clear cancel state on new purchase
			iap_billing_issue_at: null,
			iap_paused_until: null,
		},
	});

	if (pushKind === 'initial') {
		try {
			const notification = new MembershipGrantedNotification(
				{user: targetUser as unknown as UserAccount, triggeringUser: undefined, sendEmail: false},
				'pro',
				newExpiry
			);
			await notification.send();
			await sendPushToUser(targetUser.id, notification.subject(), notification.inAppMessage(), {
				type: 'membership_granted',
				membershipType: 'pro',
			});
		} catch (error) {
			logger.error('[IAP] Failed to send initial push', {error, userId: update.userId});
		}

		try {
			await notifyAdminsOfProPurchase(
				targetUser as unknown as InternalUserAccount,
				planFromProductId(update.productId).tier,
				update.platform
			);
		} catch (error) {
			logger.error('[IAP] Failed to send admin Pro purchase notification', {error, userId: update.userId});
		}
	} else if (pushKind === 'change') {
		try {
			const oldPlan = planFromProductId((targetUser as any).iap_product_id);
			const newPlan = planFromProductId(update.productId);
			await sendSubscriptionChangedPush(targetUser, oldPlan, newPlan);
		} catch (error) {
			logger.error('[IAP] Failed to send change push', {error, userId: update.userId});
		}
	}
}

/**
 * Sends plan change notification on PRODUCT_CHANGE event.
 * Push only (no DB notification) — user already knows they made the change,
 * this is just confirmation. Direction: upgrade vs downgrade determines i18n key.
 */
async function sendSubscriptionChangedPush(
	targetUser: any,
	oldPlan: ProductPlan,
	newPlan: ProductPlan
): Promise<void> {
	const userLocale = (targetUser as any)?.settings?.locale;
	const locale = userLocale && SUPPORTED_LOCALES.includes(userLocale) ? userLocale : 'en';
	const i18n = createI18nInstance(locale);

	const oldRank = PLAN_RANK[oldPlan.tier] ?? 0;
	const newRank = PLAN_RANK[newPlan.tier] ?? 0;
	const direction: 'upgrade' | 'downgrade' = newRank >= oldRank ? 'upgrade' : 'downgrade';

	const titleKey = `notifications.subscription_changed.${direction}_title`;
	const bodyKey = `notifications.subscription_changed.${direction}_body`;
	const planKey = `notifications.subscription_changed.plan_${newPlan.tier}`;
	const planLabel = i18n.t(planKey) as string;

	const title = i18n.t(titleKey, {plan: planLabel}) as string;
	const body = i18n.t(bodyKey, {plan: planLabel}) as string;

	await sendPushToUser(targetUser.id, title, body, {
		type: 'subscription_changed',
		direction,
		oldPlan: oldPlan.tier,
		newPlan: newPlan.tier,
	});
}

/**
 * Called on EXPIRATION / REFUND events.
 * Revokes only IAP-sourced Pro. Admin/promo Pro is PRESERVED — if iap_product_id
 * is null, nothing happens (user never bought IAP but admin granted Pro).
 *
 * Scenario: user bought IAP Pro, then you extended duration via promo. IAP gets cancelled,
 * Apple sends EXPIRATION — previously deleted everything, now just clears IAP product_id
 * and lets admin duration take over. But when IAP is revoked, should admin duration also
 * reset? No — admin Pro's pro_expires_at is already protected via max() logic.
 */
export async function revokeIapPro(userId: string, reason: 'expiration' | 'refund'): Promise<void> {
	const prisma = getPrisma();
	const user = await prisma.userAccount.findUnique({
		where: {id: userId},
		select: {iap_product_id: true, pro_expires_at: true},
	});

	if (!user) {
		logger.warn('[IAP] revokeIapPro: user not found', {userId});
		return;
	}

	if (!user.iap_product_id) {
		// Not IAP-sourced (admin/promo Pro). Don't touch Pro.
		logger.info('[IAP] revokeIapPro skipped: not IAP-sourced Pro', {userId, reason});
		return;
	}

	// IAP-sourced Pro: revoke. is_pro=false makes sense only if admin duration also expired;
	// if admin Pro is still active, its pro_expires_at protects us — but we must clear IAP product_id
	// and set is_pro flag based on DB's pro_expires_at.
	const now = new Date();
	const adminProActive = user.pro_expires_at && user.pro_expires_at > now;
	// If admin pro_expires_at is longer than IAP's expires_at, we used max() logic —
	// so when IAP is revoked, pro_expires_at may still be in the future due to admin duration.

	await prisma.userAccount.update({
		where: {id: userId},
		data: {
			is_pro: !!adminProActive,
			pro_expires_at: adminProActive ? user.pro_expires_at : null,
			iap_product_id: null,
			iap_platform: null,
			iap_original_tx_id: null,
			iap_latest_event_at: now,
			iap_cancellation_at: null,
			iap_billing_issue_at: null,
		},
	});
	logger.info('[IAP] Pro revoked', {userId, reason, adminProActive});
}

/**
 * CANCELLATION — user cancelled but has access until period end.
 * is_pro DOES NOT CHANGE, only iap_cancellation_at is set.
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
 * UNCANCELLATION — cancellation was reverted.
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
 * BILLING_ISSUE — card declined, in grace period. Access continues.
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
 * SUBSCRIPTION_PAUSED (Android only) — while paused, is_pro=false.
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
 * Records user's RevenueCat app_user_id (during login).
 * If already recorded, no-op.
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

/**
 * Fetches entitlement status from RevenueCat REST API + updates DB via applyIapPurchase.
 * Called from restore, manual sync, TRANSFER webhook event, and identify race fallbacks.
 *
 * If revenuecat_user_id is empty in DB, fall back to userId — if Purchases.logIn(userId)
 * was aliased, RC subscriber record can be found by userId.
 */
export async function syncEntitlementFromRevenueCat(userId: string): Promise<{synced: boolean; isPro: boolean}> {
	const prisma = getPrisma();
	const user = await prisma.userAccount.findUnique({
		where: {id: userId},
		select: {revenuecat_user_id: true},
	});
	if (!user) return {synced: false, isPro: false};

	const rcUserId = user.revenuecat_user_id || userId;

	const secretKey = process.env.REVENUECAT_SECRET_KEY;
	if (!secretKey) {
		logger.error('[IAP-Sync] REVENUECAT_SECRET_KEY env var missing');
		return {synced: false, isPro: false};
	}

	let rcData: any;
	try {
		const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(rcUserId)}`, {
			headers: {
				Authorization: `Bearer ${secretKey}`,
				'Content-Type': 'application/json',
			},
		});
		if (!response.ok) {
			logger.warn('[IAP-Sync] RevenueCat API error', {status: response.status, userId});
			return {synced: false, isPro: false};
		}
		rcData = await response.json();
	} catch (err) {
		logger.error('[IAP-Sync] RevenueCat API request failed', {err, userId});
		return {synced: false, isPro: false};
	}

	const proEnt = rcData?.subscriber?.entitlements?.pro;
	const now = new Date();
	const isActive = !!proEnt && (proEnt.expires_date === null || new Date(proEnt.expires_date) > now);

	if (!isActive) {
		return {synced: true, isPro: false};
	}

	const productId: string = proEnt.product_identifier || '';

	// `store` field is NOT in entitlement — it's in subscriptions[productId].store or
	// non_subscriptions[productId][last].store (RC REST API format).
	const subscriptions = rcData?.subscriber?.subscriptions || {};
	const nonSubs = rcData?.subscriber?.non_subscriptions || {};
	const sub = productId ? subscriptions[productId] : null;
	const nonSubArr = productId ? nonSubs[productId] : null;
	const lastNonSub = Array.isArray(nonSubArr) && nonSubArr.length > 0 ? nonSubArr[nonSubArr.length - 1] : null;
	const storeRaw: string = (sub?.store || lastNonSub?.store || '').toLowerCase();

	let platform: IapPlatform | null = null;
	if (storeRaw === 'app_store' || storeRaw === 'mac_app_store') platform = 'ios';
	else if (storeRaw === 'play_store') platform = 'android';

	if (!platform) {
		// Last resort: if user has existing iap_platform field, use it as fallback
		const existing = await prisma.userAccount.findUnique({
			where: {id: userId},
			select: {iap_platform: true},
		});
		if (existing?.iap_platform === 'ios' || existing?.iap_platform === 'android') {
			platform = existing.iap_platform;
		} else {
			logger.warn('[IAP-Sync] Unknown store, skipped', {userId, storeRaw, productId});
			return {synced: true, isPro: false};
		}
	}

	if (!user.revenuecat_user_id) {
		await prisma.userAccount.update({
			where: {id: userId},
			data: {revenuecat_user_id: userId},
		});
	}

	await applyIapPurchase(
		{
			userId,
			platform,
			productId,
			originalTxId: null,
			expiresAt: proEnt.expires_date ? new Date(proEnt.expires_date) : null,
			eventAt: now,
		},
		'silent',
	);

	logger.info('[IAP-Sync] Pro synchronized', {userId, platform, productId});
	return {synced: true, isPro: true};
}
