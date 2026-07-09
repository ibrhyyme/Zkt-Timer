import {Capacitor} from '@capacitor/core';
import {isNative, isAndroidNative} from '../util/platform';

// RevenueCat SDK lazy-load — don't load on web during build time
let PurchasesModule: any = null;

async function loadPurchases(): Promise<any> {
	if (PurchasesModule) return PurchasesModule;
	if (!isNative()) return null;
	try {
		PurchasesModule = await import('@revenuecat/purchases-capacitor');
		return PurchasesModule;
	} catch (err) {
		console.error('[IAP] RevenueCat SDK failed to load', err);
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
 * Called at app mount. Only does real work on native platforms.
 */
export async function initRevenueCat(): Promise<void> {
	if (!isNative() || initialized) return;

	const mod = await loadPurchases();
	if (!mod) return;

	// Remote mode: keys arrive via the SSR-injected globals. Local-bundle shell has no
	// SSR script, so fall back to the build-time inlined env (esbuild define).
	const apiKey = isAndroidNative()
		? (window as any).__REVENUECAT_ANDROID_KEY__ || process.env.REVENUECAT_ANDROID_KEY || ''
		: (window as any).__REVENUECAT_IOS_KEY__ || process.env.REVENUECAT_IOS_KEY || '';

	if (!apiKey) {
		console.warn('[IAP] RevenueCat API key missing (platform=' + Capacitor.getPlatform() + ')');
		return;
	}

	try {
		await mod.Purchases.configure({apiKey});
		initialized = true;
	} catch (err) {
		console.error('[IAP] configure error', err);
	}
}

/**
 * After login, identify the user to RevenueCat.
 * logoutRevenueCat() is called on logout.
 */
export async function identifyUser(userId: string): Promise<void> {
	if (!isNative()) return;
	if (currentUserId === userId) return;
	if (!initialized) {
		// initRevenueCat may have started as fire-and-forget; wait for completion.
		await initRevenueCat();
	}
	if (!initialized) return;
	const mod = await loadPurchases();
	if (!mod) return;
	try {
		await mod.Purchases.logIn({appUserID: userId});
		currentUserId = userId;
	} catch (err) {
		console.error('[IAP] logIn error', err);
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
		// "already anonymous" error is normal, pass silently
	}
}

/**
 * Fetch default offering and gather 3 packages to show on paywall.
 */
export async function getOfferings(): Promise<OfferingsSnapshot> {
	if (!isNative() || !initialized) return {};
	const mod = await loadPurchases();
	if (!mod) return {};
	try {
		const result = await mod.Purchases.getOfferings();
		// fallback from current to all.default if current doesn't exist
		const current = result?.current || result?.all?.default || Object.values(result?.all || {})[0];
		if (!current) return {};
		return {
			monthly: current.monthly || current.availablePackages?.find((p: any) => p.packageType === 'MONTHLY'),
			yearly: current.annual || current.availablePackages?.find((p: any) => p.packageType === 'ANNUAL'),
			lifetime: current.lifetime || current.availablePackages?.find((p: any) => p.packageType === 'LIFETIME'),
		};
	} catch (err: any) {
		console.error('[IAP] getOfferings error', err);
		return {};
	}
}

/**
 * Purchase a package. Apple/Google opens their own sheet.
 * On Android, if there's an active subscription, pass googleProductChangeInfo for upgrade/downgrade.
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

	// Android-specific: old product and replacement mode for upgrade/downgrade
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
 * Called when user clicks "Restore purchases" button.
 * Also called after login for cross-device restore.
 */
export async function restorePurchases(): Promise<EntitlementSnapshot | null> {
	if (!isNative() || !initialized) return null;
	const mod = await loadPurchases();
	if (!mod) return null;
	try {
		const res = await mod.Purchases.restorePurchases();
		return extractEntitlement(res?.customerInfo);
	} catch (err) {
		console.error('[IAP] restore error', err);
		return null;
	}
}

/**
 * iOS: opens subscription management page (Settings > Subscriptions).
 * Android: opens Play Store subscription page.
 */
export async function showManageSubscriptions(): Promise<void> {
	if (!isNative() || !initialized) return;
	const mod = await loadPurchases();
	if (!mod) return;
	try {
		await mod.Purchases.showManageSubscriptions();
	} catch (err) {
		console.error('[IAP] showManageSubscriptions error', err);
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
