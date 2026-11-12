// Where a member's Pro or Premium comes from, decided from the account row alone.
// Pure on purpose: the IAP webhook and the admin Pro list both read it, and the
// rules (a store product wins, then a promo or competition gift still running,
// else an admin grant) are easier to pin in a test than in a resolver.

export type IapPlanTier = 'monthly' | 'yearly' | 'lifetime' | 'unknown';

export interface ProductPlan {
	tier: IapPlanTier;
}

export function planFromProductId(productId: string | null | undefined): ProductPlan {
	if (!productId) return {tier: 'unknown'};
	if (productId.endsWith('lifetime')) return {tier: 'lifetime'};
	if (productId.endsWith('yearly')) return {tier: 'yearly'};
	if (productId.endsWith('monthly')) return {tier: 'monthly'};
	return {tier: 'unknown'};
}

export type MembershipTier = 'pro' | 'premium';
/** `other` is a store product whose id names no known plan. */
export type MembershipSource = 'lifetime' | 'yearly' | 'monthly' | 'other' | 'promo' | 'competition' | 'admin';
/** Store state only; a promo or admin grant is always `active` until it expires. */
export type MembershipStatus = 'active' | 'cancelled' | 'billing_issue';

export interface MembershipRedemption {
	redeemed_at: Date;
	promo_code: {
		code: string;
		membership_type: string;
		/** -1 = never ends. */
		duration_minutes: number;
	};
}

export interface MembershipAccount {
	is_pro: boolean;
	is_premium: boolean;
	pro_expires_at: Date | null;
	premium_expires_at: Date | null;
	iap_product_id: string | null;
	iap_cancellation_at: Date | null;
	iap_billing_issue_at: Date | null;
	iap_latest_event_at: Date | null;
	redemptions: MembershipRedemption[];
	/** Competition Pro gifts handed out (services/competition_pro_gift.ts). Optional for older callers. */
	competition_gifts?: {granted_at: Date | null; pro_until: Date | null}[];
}

export interface MembershipInfo {
	tier: MembershipTier;
	source: MembershipSource;
	status: MembershipStatus;
	/** null = no end date. */
	expires_at: Date | null;
	/** The last store event, or the promo redemption. An admin grant leaves no date. */
	last_event_at: Date | null;
	promo_code: string | null;
}

const MINUTE_MS = 60 * 1000;

function promoStillRunning(r: MembershipRedemption, now: Date): boolean {
	if (r.promo_code.duration_minutes < 0) return true;
	return r.redeemed_at.getTime() + r.promo_code.duration_minutes * MINUTE_MS > now.getTime();
}

export function classifyMembership(account: MembershipAccount, now: Date = new Date()): MembershipInfo {
	// Granting Premium clears is_pro (PromoCode and setPremiumStatus both do), so the
	// Premium flag decides the tier and the Pro-only store fields are ignored under it.
	const tier: MembershipTier = account.is_premium ? 'premium' : 'pro';
	const expires_at = tier === 'premium' ? account.premium_expires_at : account.pro_expires_at;

	if (tier === 'pro' && account.iap_product_id) {
		const plan = planFromProductId(account.iap_product_id).tier;
		let status: MembershipStatus = 'active';
		if (account.iap_billing_issue_at) status = 'billing_issue';
		else if (account.iap_cancellation_at) status = 'cancelled';
		return {
			tier,
			source: plan === 'unknown' ? 'other' : plan,
			status,
			expires_at,
			last_event_at: account.iap_latest_event_at,
			promo_code: null,
		};
	}

	// No store product. A redemption for this tier whose window has not closed is the
	// grant in force; anything else was given by hand from the admin panel.
	const running = account.redemptions
		.filter((r) => r.promo_code.membership_type === tier && promoStillRunning(r, now))
		.sort((a, b) => b.redeemed_at.getTime() - a.redeemed_at.getTime());

	// A competition gift whose window is still open, Pro only. When a promo also
	// runs, the more recent of the two is the one that set the end date.
	const gift =
		tier === 'pro'
			? (account.competition_gifts ?? [])
					.filter((g) => g.granted_at && g.pro_until && g.pro_until > now)
					.sort((a, b) => (b.granted_at as Date).getTime() - (a.granted_at as Date).getTime())[0]
			: undefined;

	if (gift && (running.length === 0 || (gift.granted_at as Date) > running[0].redeemed_at)) {
		return {
			tier,
			source: 'competition',
			status: 'active',
			expires_at,
			last_event_at: gift.granted_at,
			promo_code: null,
		};
	}

	if (running.length > 0) {
		return {
			tier,
			source: 'promo',
			status: 'active',
			expires_at,
			last_event_at: running[0].redeemed_at,
			promo_code: running[0].promo_code.code,
		};
	}

	return {tier, source: 'admin', status: 'active', expires_at, last_event_at: null, promo_code: null};
}
