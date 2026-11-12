// What a Pro gift does to a member's account, decided from the account row alone.
// Pure on purpose, like pro_membership.ts: the competition gift and the promo
// code both go through it, and "never shorten what someone already has" is
// easier to pin in a test than in a resolver.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GiftAccount {
	is_pro: boolean;
	pro_expires_at: Date | null;
	is_premium: boolean;
	premium_expires_at: Date | null;
	iap_product_id: string | null;
}

export type GiftDecision =
	| {action: 'grant'; until: Date}
	/** A paying store subscriber: the gift waits until the subscription ends. */
	| {action: 'defer'}
	| {action: 'skip'; reason: 'lifetime' | 'premium'};

/**
 * A competition gift of `days` days.
 *
 * - Premium, or Pro that never ends: nothing to add, skipped.
 * - A store subscription: adding days would not stop the store from charging,
 *   so the gift waits and starts the day the subscription ends.
 * - Anyone else: the days go on top of the Pro they already have (a promo or an
 *   earlier gift), so nobody loses days by competing. The gift is once in a life,
 *   which is what keeps this from piling up.
 */
export function decideCompetitionGift(a: GiftAccount, days: number, now: Date = new Date()): GiftDecision {
	if (isPremiumActive(a, now)) return {action: 'skip', reason: 'premium'};
	if (a.is_pro && a.pro_expires_at === null) return {action: 'skip', reason: 'lifetime'};
	if (a.iap_product_id && isProActive(a, now)) return {action: 'defer'};
	const base = isProActive(a, now) && a.pro_expires_at ? a.pro_expires_at : now;
	return {action: 'grant', until: new Date(base.getTime() + days * DAY_MS)};
}

/**
 * The end date a promo code leaves behind: the later of what the member already
 * has and what the code gives. A code never shortens a membership, and a
 * membership that never ends stays that way. `candidate` null = the code itself
 * never ends.
 */
export function expiryAtLeast(
	currentlyActive: boolean,
	currentExpiry: Date | null,
	candidate: Date | null
): Date | null {
	if (candidate === null) return null;
	if (!currentlyActive) return candidate;
	if (currentExpiry === null) return null;
	return currentExpiry > candidate ? currentExpiry : candidate;
}

export function isProActive(
	a: Pick<GiftAccount, 'is_pro' | 'pro_expires_at'> | null | undefined,
	now: Date = new Date()
): boolean {
	if (!a) return false;
	return a.is_pro && (a.pro_expires_at === null || a.pro_expires_at > now);
}

export function isPremiumActive(
	a: Pick<GiftAccount, 'is_premium' | 'premium_expires_at'> | null | undefined,
	now: Date = new Date()
): boolean {
	if (!a) return false;
	return a.is_premium && (a.premium_expires_at === null || a.premium_expires_at > now);
}
