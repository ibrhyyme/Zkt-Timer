import {classifyMembership, MembershipAccount, planFromProductId} from '../pro_membership';

const NOW = new Date('2026-11-04T12:00:00Z');
const DAY_MIN = 24 * 60;

function account(over: Partial<MembershipAccount> = {}): MembershipAccount {
	return {
		is_pro: true,
		is_premium: false,
		pro_expires_at: null,
		premium_expires_at: null,
		iap_product_id: null,
		iap_cancellation_at: null,
		iap_billing_issue_at: null,
		iap_latest_event_at: null,
		redemptions: [],
		...over,
	};
}

function redemption(code: string, type: string, durationMinutes: number, redeemedAt: string) {
	return {redeemed_at: new Date(redeemedAt), promo_code: {code, membership_type: type, duration_minutes: durationMinutes}};
}

describe('planFromProductId', () => {
	it.each([
		['zkt_pro_lifetime', 'lifetime'],
		['zkt_pro_yearly', 'yearly'],
		['zkt.pro.monthly', 'monthly'],
		['something_else', 'unknown'],
		[null, 'unknown'],
	])('%s -> %s', (id, tier) => {
		expect(planFromProductId(id as any).tier).toBe(tier);
	});
});

describe('classifyMembership', () => {
	it('reads a store product as its plan, with the last store event', () => {
		const event = new Date('2026-10-01T00:00:00Z');
		const info = classifyMembership(account({iap_product_id: 'zkt_pro_yearly', iap_latest_event_at: event}), NOW);
		expect(info).toMatchObject({tier: 'pro', source: 'yearly', status: 'active', last_event_at: event, promo_code: null});
	});

	it('names an unknown product "other" rather than calling it a grant', () => {
		expect(classifyMembership(account({iap_product_id: 'beta_tester'}), NOW).source).toBe('other');
	});

	it('a billing issue outranks a cancellation in the status', () => {
		const at = new Date('2026-11-01T00:00:00Z');
		expect(
			classifyMembership(account({iap_product_id: 'x_monthly', iap_cancellation_at: at, iap_billing_issue_at: at}), NOW).status,
		).toBe('billing_issue');
		expect(classifyMembership(account({iap_product_id: 'x_monthly', iap_cancellation_at: at}), NOW).status).toBe('cancelled');
	});

	it('a running promo redemption makes it promo, newest code first', () => {
		const info = classifyMembership(
			account({
				redemptions: [
					redemption('OLD', 'pro', 30 * DAY_MIN, '2026-10-20T00:00:00Z'),
					redemption('NEW', 'pro', 30 * DAY_MIN, '2026-11-01T00:00:00Z'),
				],
			}),
			NOW,
		);
		expect(info).toMatchObject({source: 'promo', promo_code: 'NEW', status: 'active'});
		expect(info.last_event_at).toEqual(new Date('2026-11-01T00:00:00Z'));
	});

	it('a never-ending promo stays promo however old it is', () => {
		const info = classifyMembership(account({redemptions: [redemption('FOREVER', 'pro', -1, '2024-01-01T00:00:00Z')]}), NOW);
		expect(info.source).toBe('promo');
	});

	it('an expired promo window falls back to an admin grant', () => {
		const info = classifyMembership(account({redemptions: [redemption('WEEK', 'pro', 7 * DAY_MIN, '2026-09-01T00:00:00Z')]}), NOW);
		expect(info).toMatchObject({source: 'admin', promo_code: null, last_event_at: null});
	});

	it('a promo for the other tier does not count', () => {
		const info = classifyMembership(account({redemptions: [redemption('PREM', 'premium', -1, '2026-11-01T00:00:00Z')]}), NOW);
		expect(info.source).toBe('admin');
	});

	it('Premium decides the tier and ignores a leftover Pro store product', () => {
		const expires = new Date('2027-01-01T00:00:00Z');
		const info = classifyMembership(
			account({
				is_pro: false,
				is_premium: true,
				premium_expires_at: expires,
				iap_product_id: 'zkt_pro_yearly',
				redemptions: [redemption('PREM', 'premium', 60 * DAY_MIN, '2026-11-01T00:00:00Z')],
			}),
			NOW,
		);
		expect(info).toMatchObject({tier: 'premium', source: 'promo', promo_code: 'PREM', expires_at: expires});
	});

	it('takes the expiry of the tier it reports', () => {
		const pro = new Date('2026-12-01T00:00:00Z');
		expect(classifyMembership(account({pro_expires_at: pro}), NOW).expires_at).toEqual(pro);
	});
});
