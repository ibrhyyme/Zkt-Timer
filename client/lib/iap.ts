import {Capacitor} from '@capacitor/core';
import {isNative, isAndroidNative} from '../util/platform';

// RevenueCat SDK lazy-load — build sirasinda web'de yuklenmesin diye
let PurchasesModule: any = null;

async function loadPurchases(): Promise<any> {
	if (PurchasesModule) return PurchasesModule;
	if (!isNative()) return null;
	try {
		PurchasesModule = await import('@revenuecat/purchases-capacitor');
		return PurchasesModule;
	} catch (err) {
		console.error('[IAP] RevenueCat SDK yuklenemedi', err);
		return null;
	}
}

export type PlanId = 'monthly' | 'yearly' | 'lifetime';

interface PurchasesPackage {
	identifier: string;
	product: {
		identifier: string;
		priceString: string;
		price: number;
		currencyCode: string;
		title?: string;
	};
}

interface OfferingsSnapshot {
	monthly?: PurchasesPackage;
	yearly?: PurchasesPackage;
	lifetime?: PurchasesPackage;
}

interface EntitlementSnapshot {
	isPro: boolean;
	expirationDate: string | null;
	productIdentifier: string | null;
	store: 'app_store' | 'play_store' | null;
	willRenew: boolean;
}

let initialized = false;
let currentUserId: string | null = null;

/**
 * App mount'ta cagrilir. Sadece native platformda gercek iş yapar.
 */
export async function initRevenueCat(): Promise<void> {
	if (!isNative() || initialized) return;

	const mod = await loadPurchases();
	if (!mod) return;

	const apiKey = isAndroidNative()
		? (window as any).__REVENUECAT_ANDROID_KEY__ || ''
		: (window as any).__REVENUECAT_IOS_KEY__ || '';

	if (!apiKey) {
		console.warn('[IAP] RevenueCat API key eksik (platform=' + Capacitor.getPlatform() + ')');
		return;
	}

	try {
		await mod.Purchases.configure({apiKey});
		initialized = true;
	} catch (err) {
		console.error('[IAP] configure hatasi', err);
	}
}

/**
 * Login sonrasinda, kullaniciyi RevenueCat'a taniti.
 * Logout'ta logoutRevenueCat() cagrilir.
 */
export async function identifyUser(userId: string): Promise<void> {
	if (!isNative() || !initialized) return;
	if (currentUserId === userId) return;
	const mod = await loadPurchases();
	if (!mod) return;
	try {
		await mod.Purchases.logIn({appUserID: userId});
		currentUserId = userId;
	} catch (err) {
		console.error('[IAP] logIn hatasi', err);
	}
}

export async function logoutRevenueCat(): Promise<void> {
	if (!isNative() || !initialized) return;
	const mod = await loadPurchases();
	if (!mod) return;
	try {
		await mod.Purchases.logOut();
		currentUserId = null;
	} catch (err) {
		// "already anonymous" hatasi normal, sessizce gec
	}
}

/**
 * Default offering'i cek, paywall'da gosterilecek 3 paketi topla.
 */
export async function getOfferings(): Promise<OfferingsSnapshot> {
	if (!isNative() || !initialized) return {};
	const mod = await loadPurchases();
	if (!mod) return {};
	try {
		const result = await mod.Purchases.getOfferings();
		// current yoksa all'dan default'a fallback
		const current = result?.current || result?.all?.default || Object.values(result?.all || {})[0];
		if (!current) return {};
		return {
			monthly: current.monthly || current.availablePackages?.find((p: any) => p.packageType === 'MONTHLY'),
			yearly: current.annual || current.availablePackages?.find((p: any) => p.packageType === 'ANNUAL'),
			lifetime: current.lifetime || current.availablePackages?.find((p: any) => p.packageType === 'LIFETIME'),
		};
	} catch (err: any) {
		console.error('[IAP] getOfferings hatasi', err);
		return {};
	}
}

/**
 * Paket satin al. Apple/Google kendi sheet'ini acar.
 * Android'de aktif abonelik varsa upgrade/downgrade icin googleProductChangeInfo geciyoruz.
 */
export async function purchasePackage(
	pkg: PurchasesPackage,
	oldProductId?: string,
	isUpgrade?: boolean
): Promise<EntitlementSnapshot | null> {
	if (!isNative() || !initialized) {
		throw new Error('IAP not initialized');
	}
	const mod = await loadPurchases();
	if (!mod) throw new Error('IAP SDK not available');

	const params: any = {aPackage: pkg};

	// Android-specific: upgrade/downgrade icin eski product ve replacement mode
	if (isAndroidNative() && oldProductId) {
		const REPLACEMENT_MODE = mod.GOOGLE_PRODUCT_CHANGE_REPLACEMENT_MODE || {};
		params.googleProductChangeInfo = {
			oldProductIdentifier: oldProductId,
			replacementMode: isUpgrade
				? REPLACEMENT_MODE.CHARGE_PRORATED_PRICE || 'CHARGE_PRORATED_PRICE'
				: REPLACEMENT_MODE.DEFERRED || 'DEFERRED',
		};
	}

	const res = await mod.Purchases.purchasePackage(params);
	return extractEntitlement(res?.customerInfo);
}

/**
 * "Satin alimlarimi geri yukle" butonunda cagrilir.
 * Cross-device restore icin de login sonrasi cagrilabilir.
 */
export async function restorePurchases(): Promise<EntitlementSnapshot | null> {
	if (!isNative() || !initialized) return null;
	const mod = await loadPurchases();
	if (!mod) return null;
	try {
		const res = await mod.Purchases.restorePurchases();
		return extractEntitlement(res?.customerInfo);
	} catch (err) {
		console.error('[IAP] restore hatasi', err);
		return null;
	}
}

/**
 * iOS: abonelik yonetim sayfasini acar (Settings > Subscriptions).
 * Android: Play Store abonelik sayfasini acar.
 */
export async function showManageSubscriptions(): Promise<void> {
	if (!isNative() || !initialized) return;
	const mod = await loadPurchases();
	if (!mod) return;
	try {
		await mod.Purchases.showManageSubscriptions();
	} catch (err) {
		console.error('[IAP] showManageSubscriptions hatasi', err);
	}
}

function extractEntitlement(customerInfo: any): EntitlementSnapshot {
	const entitlements = customerInfo?.entitlements?.active || {};
	const proEnt = entitlements['pro'];
	if (!proEnt) {
		return {isPro: false, expirationDate: null, productIdentifier: null, store: null, willRenew: false};
	}
	return {
		isPro: true,
		expirationDate: proEnt.expirationDate || null,
		productIdentifier: proEnt.productIdentifier || null,
		store: proEnt.store || null,
		willRenew: !!proEnt.willRenew,
	};
}
