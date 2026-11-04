import {DEFAULT_FACETS, ProFilters, ProRow, facetCounts, filterRows, isExpiringSoon, rowPlatform, sortRows} from '../pro_user_filters';

const NOW = new Date('2026-11-04T12:00:00Z');

function row(id: string, over: Partial<ProRow> = {}, user: Partial<ProRow['user']> = {}): ProRow {
	return {
		tier: 'pro',
		source: 'admin',
		status: 'active',
		expires_at: null,
		last_event_at: null,
		promo_code: null,
		...over,
		user: {id, username: id, email: `${id}@x.com`, created_at: '2026-01-01T00:00:00Z', ...user},
	};
}

const ROWS: ProRow[] = [
	row('ios_year', {source: 'yearly', last_event_at: '2026-10-01T00:00:00Z'}, {iap_platform: 'ios'}),
	row('and_month', {source: 'monthly', status: 'cancelled', expires_at: '2026-11-08T00:00:00Z'}, {iap_platform: 'android'}),
	row('and_life', {source: 'lifetime'}, {iap_platform: 'android'}),
	row('promo', {source: 'promo', promo_code: 'SUMMER', expires_at: '2026-12-30T00:00:00Z'}),
	row('premium', {tier: 'premium', source: 'admin'}),
	// A promo member with a stale store platform left on the account: no store here.
	row('promo_stale', {source: 'promo', promo_code: 'X'}, {iap_platform: 'ios'}),
];

const filters = (over: Partial<ProFilters> = {}): ProFilters => ({...DEFAULT_FACETS, query: '', ...over});

describe('pro user filters', () => {
	it('platform is the store only for a store purchase', () => {
		expect(ROWS.map(rowPlatform)).toEqual(['ios', 'android', 'android', 'none', 'none', 'none']);
	});

	it('expiring means an end date inside 7 days', () => {
		expect(ROWS.filter((r) => isExpiringSoon(r, NOW)).map((r) => r.user.id)).toEqual(['and_month']);
	});

	it('filters combine', () => {
		const ids = (f: ProFilters) => filterRows(ROWS, f, NOW).map((r) => r.user.id);
		expect(ids(filters({platform: 'android'}))).toEqual(['and_month', 'and_life']);
		expect(ids(filters({platform: 'android', source: 'lifetime'}))).toEqual(['and_life']);
		expect(ids(filters({tier: 'premium'}))).toEqual(['premium']);
		expect(ids(filters({status: 'expiring'}))).toEqual(['and_month']);
		expect(ids(filters({query: 'summer'}))).toEqual(['promo']);
	});

	it('facet counts ignore their own facet and respect the others', () => {
		const counts = facetCounts(ROWS, filters({source: 'yearly', platform: 'android'}), 'source', ['all', 'yearly', 'monthly', 'lifetime', 'promo'], NOW);
		expect(counts).toEqual({all: 2, yearly: 0, monthly: 1, lifetime: 1, promo: 0});
	});

	it('sorts recent events first, then by join date', () => {
		const sorted = sortRows([
			row('old', {}, {created_at: '2025-01-01T00:00:00Z'}),
			row('event', {last_event_at: '2026-01-01T00:00:00Z'}),
			row('new', {}, {created_at: '2026-06-01T00:00:00Z'}),
			row('latest', {last_event_at: '2026-10-01T00:00:00Z'}),
		]);
		expect(sorted.map((r) => r.user.id)).toEqual(['latest', 'event', 'new', 'old']);
	});
});
