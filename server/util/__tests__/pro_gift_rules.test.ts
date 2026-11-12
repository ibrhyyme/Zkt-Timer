import {decideCompetitionGift, expiryAtLeast, GiftAccount} from '../pro_gift_rules';

const NOW = new Date('2026-11-16T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(NOW.getTime() + days * DAY);

const free: GiftAccount = {
	is_pro: false,
	pro_expires_at: null,
	is_premium: false,
	premium_expires_at: null,
	iap_product_id: null,
};

describe('decideCompetitionGift', () => {
	it('gives a member without Pro the days from now', () => {
		expect(decideCompetitionGift(free, 30, NOW)).toEqual({action: 'grant', until: at(30)});
	});

	it('adds the days after a promo or gift Pro that is still running', () => {
		const promo = {...free, is_pro: true, pro_expires_at: at(10)};
		expect(decideCompetitionGift(promo, 14, NOW)).toEqual({action: 'grant', until: at(24)});
	});

	it('starts from now when an earlier Pro has already run out', () => {
		const lapsed = {...free, is_pro: true, pro_expires_at: at(-3)};
		expect(decideCompetitionGift(lapsed, 14, NOW)).toEqual({action: 'grant', until: at(14)});
	});

	it('holds the gift for a paying store subscriber', () => {
		const monthly = {...free, is_pro: true, pro_expires_at: at(20), iap_product_id: 'zkt_pro_monthly'};
		expect(decideCompetitionGift(monthly, 14, NOW)).toEqual({action: 'defer'});
	});

	it('grants once the store subscription is gone, even if the product id was left behind', () => {
		const stale = {...free, is_pro: false, pro_expires_at: null, iap_product_id: 'zkt_pro_monthly'};
		expect(decideCompetitionGift(stale, 14, NOW)).toEqual({action: 'grant', until: at(14)});
	});

	it('skips Pro that never ends and Premium', () => {
		const lifetime = {...free, is_pro: true, pro_expires_at: null, iap_product_id: 'zkt_pro_lifetime'};
		expect(decideCompetitionGift(lifetime, 30, NOW)).toEqual({action: 'skip', reason: 'lifetime'});
		const premium = {...free, is_premium: true, premium_expires_at: at(5)};
		expect(decideCompetitionGift(premium, 30, NOW)).toEqual({action: 'skip', reason: 'premium'});
	});

	it('does not skip a Premium that has already expired', () => {
		const oldPremium = {...free, is_premium: true, premium_expires_at: at(-1)};
		expect(decideCompetitionGift(oldPremium, 30, NOW)).toEqual({action: 'grant', until: at(30)});
	});
});

describe('expiryAtLeast', () => {
	it('never shortens a running membership', () => {
		expect(expiryAtLeast(true, at(300), at(7))).toEqual(at(300));
		expect(expiryAtLeast(true, at(3), at(7))).toEqual(at(7));
	});

	it('keeps a membership that never ends', () => {
		expect(expiryAtLeast(true, null, at(7))).toBeNull();
	});

	it('uses the code when nothing is running, and a forever code wins', () => {
		expect(expiryAtLeast(false, at(-5), at(7))).toEqual(at(7));
		expect(expiryAtLeast(true, at(30), null)).toBeNull();
	});
});
