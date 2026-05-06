import {getPrisma} from '../database';
import {getUserByIdWithSettings} from './user_account';
import {logger} from '../services/logger';
import {sendPushToUser} from '../services/push';
import {createRedisKey, keyExistsInRedis, setKeyInRedis, RedisNamespace} from '../services/redis';
import MembershipGrantedNotification from '../resources/notification_types/membership_granted';
import {UserAccount} from '../schemas/UserAccount.schema';
import {createI18nInstance} from '../i18n_server';

const SUPPORTED_LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

export type IapPushKind = 'initial' | 'change' | 'silent';

interface ProductPlan {
	tier: 'monthly' | 'yearly' | 'lifetime' | 'unknown';
}

function planFromProductId(productId: string | null | undefined): ProductPlan {
	if (!productId) return {tier: 'unknown'};
	if (productId.endsWith('lifetime')) return {tier: 'lifetime'};
	if (productId.endsWith('yearly')) return {tier: 'yearly'};
	if (productId.endsWith('monthly')) return {tier: 'monthly'};
	return {tier: 'unknown'};
}

const PLAN_RANK: Record<string, number> = {monthly: 1, yearly: 2, lifetime: 3, unknown: 0};

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
 *
 * pushKind:
 *   'initial' — yeni satin alma, "Pro hosgeldin" notification + push
 *   'change'  — plan degisikligi (upgrade/downgrade), "yukseltildi/dusuruldu" push (sadece push, DB notification yok)
 *   'silent'  — RENEWAL gibi sessiz update, hicbir bildirim
 */
export async function applyIapPurchase(
	update: IapPurchaseUpdate,
	pushKind: IapPushKind = 'initial'
): Promise<void> {
	const prisma = getPrisma();

	const targetUser = await getUserByIdWithSettings(update.userId);
	if (!targetUser) {
		logger.warn('[IAP] Kullanici bulunamadi', {userId: update.userId});
		return;
	}

	// pro_expires_at icin max(mevcut, yeni) — admin/promo Pro'nun suresi IAP'tan uzunsa korunur.
	// Senaryo: kullanicida 6 ayligina admin Pro var, 1 aylik IAP aldi -> 6 ay korunmali.
	// Lifetime (expiresAt=null) her zaman kazanir.
	//
	// KRITIK: pro_expires_at=null tek basina "lifetime" anlamina gelmez — admin Pro'yu kaldirdiysa
	// is_pro=false + pro_expires_at=null olur. Sadece is_pro=true VE pro_expires_at=null durumunda
	// kullanici gercek Lifetime sahibidir.
	const currentIsPro = (targetUser as any).is_pro === true;
	const currentExpiry = (targetUser as any).pro_expires_at as Date | null | undefined;
	let newExpiry: Date | null;
	if (update.expiresAt === null) {
		// Yeni IAP lifetime — sonsuz, her zaman kazanir
		newExpiry = null;
	} else if (currentIsPro && currentExpiry === null) {
		// Kullanici zaten gercek Lifetime sahibi — IAP suresi gelse bile sonsuz korunur
		newExpiry = null;
	} else if (currentIsPro && currentExpiry && currentExpiry > update.expiresAt) {
		// Mevcut Pro suresi daha uzak — koru (admin/promo IAP'tan uzun olabilir)
		newExpiry = currentExpiry;
	} else {
		// Pro yok ya da mevcut sure yeni IAP'tan kisa — RC'den gelen tarihi kullan
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
			iap_cancellation_at: null, // yeni satin almada cancel state temizlenir
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
			logger.error('[IAP] Initial push gonderilemedi', {error, userId: update.userId});
		}
	} else if (pushKind === 'change') {
		try {
			const oldPlan = planFromProductId((targetUser as any).iap_product_id);
			const newPlan = planFromProductId(update.productId);
			await sendSubscriptionChangedPush(targetUser, oldPlan, newPlan);
		} catch (error) {
			logger.error('[IAP] Change push gonderilemedi', {error, userId: update.userId});
		}
	}
}

/**
 * PRODUCT_CHANGE event'inde kullaniciya plan degisikligi bildirimi gonderir.
 * Sadece push (DB notification yok) — kullanici zaten degisiklik yaptigini biliyor,
 * bu sadece confirmation. Direction: upgrade vs downgrade i18n key'ine gore mesaj.
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
 * EXPIRATION / REFUND event'lerinde cagrilir.
 * Sadece IAP-kaynakli Pro'yu iptal eder. Admin/promo ile verilmis Pro KORUNUR — iap_product_id
 * null ise hicbir sey yapilmaz (kullanici IAP almamis ama admin Pro vermis senaryosu).
 *
 * Senaryo: kullanici IAP Pro almis, sen sonra promo ile suresi uzatmissin. IAP iptal edilince
 * Apple EXPIRATION yollar — eskiden hepsini siliyordu, simdi sadece IAP product_id'yi temizleyip
 * pro_expires_at'i admin tarafinin kontrolune birakir. Ama IAP onerildiginde admin suresi de
 * sifirlanmali mi? Hayir — admin Pro'nun pro_expires_at'i max() ile zaten korunmus oluyor.
 */
export async function revokeIapPro(userId: string, reason: 'expiration' | 'refund'): Promise<void> {
	const prisma = getPrisma();
	const user = await prisma.userAccount.findUnique({
		where: {id: userId},
		select: {iap_product_id: true, pro_expires_at: true},
	});

	if (!user) {
		logger.warn('[IAP] revokeIapPro: kullanici bulunamadi', {userId});
		return;
	}

	if (!user.iap_product_id) {
		// IAP-kaynakli degil (admin/promo Pro). Pro'ya dokunma.
		logger.info('[IAP] revokeIapPro skipped: not IAP-sourced Pro', {userId, reason});
		return;
	}

	// IAP-kaynakli Pro: iptal et. is_pro=false yalnizca admin suresi de gecmisteyse anlamli;
	// admin Pro hala aktifse onun pro_expires_at'i bizi koruyor — ama IAP product_id'yi temizleyip
	// is_pro flag'ini DB'deki pro_expires_at'a uygun set etmeliyiz.
	const now = new Date();
	const adminProActive = user.pro_expires_at && user.pro_expires_at > now;
	// Admin pro_expires_at IAP'in expires_at'inden uzunsa, max() koymustuk —
	// o yuzden IAP iptal edilse bile pro_expires_at admin sayesinde gelecekte kalmis olabilir.

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
	logger.info('[IAP] Pro iptal edildi', {userId, reason, adminProActive});
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

/**
 * RevenueCat REST API'den entitlement durumunu cek + applyIapPurchase ile DB'yi guncelle.
 * Restore, manuel sync, TRANSFER webhook event'i ve identify race fallback'lerinde cagrilir.
 *
 * revenuecat_user_id DB'de bos ise userId fallback — Purchases.logIn(userId) aliasladiysa
 * RC subscriber kaydini userId ile bulabilir.
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
		logger.error('[IAP-Sync] REVENUECAT_SECRET_KEY env var eksik');
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
			logger.warn('[IAP-Sync] RevenueCat API hatasi', {status: response.status, userId});
			return {synced: false, isPro: false};
		}
		rcData = await response.json();
	} catch (err) {
		logger.error('[IAP-Sync] RevenueCat API istegi basarisiz', {err, userId});
		return {synced: false, isPro: false};
	}

	const proEnt = rcData?.subscriber?.entitlements?.pro;
	const now = new Date();
	const isActive = !!proEnt && (proEnt.expires_date === null || new Date(proEnt.expires_date) > now);

	if (!isActive) {
		return {synced: true, isPro: false};
	}

	const productId: string = proEnt.product_identifier || '';

	// `store` field'i entitlement'ta DEGIL — subscriptions[productId].store veya
	// non_subscriptions[productId][last].store icindedir (RC REST API formati).
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
		// Son care: user'in mevcut iap_platform field'i varsa onu fallback olarak kullan
		const existing = await prisma.userAccount.findUnique({
			where: {id: userId},
			select: {iap_platform: true},
		});
		if (existing?.iap_platform === 'ios' || existing?.iap_platform === 'android') {
			platform = existing.iap_platform;
		} else {
			logger.warn('[IAP-Sync] Bilinmeyen store, atlandi', {userId, storeRaw, productId});
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

	logger.info('[IAP-Sync] Pro senkronize edildi', {userId, platform, productId});
	return {synced: true, isPro: true};
}
