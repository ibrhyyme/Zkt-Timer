import {
	DEFAULT_PAID_FACETS,
	PaidFilters,
	ProRow,
	filterPaidRows,
	isExpiringSoon,
	paidFacetCounts,
	rowPlatform,
	sortRows,
	splitRows,
} from '../pro_user_filters';

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
	row('ios_other', {source: 'other'}, {iap_platform: 'ios', iap_product_id: 'zkt_old'}),
	row('promo', {source: 'promo', promo_code: 'SUMMER', expires_at: '2026-12-30T00:00:00Z'}),
	row('premium', {tier: 'premium', source: 'admin'}),
	// A promo member with a stale store platform left on the account: no store here.
	row('promo_stale', {source: 'promo', promo_code: 'X'}, {iap_platform: 'ios'}),
];

const filters = (over: Partial<PaidFilters> = {}): PaidFilters => ({...DEFAULT_PAID_FACETS, query: '', ...over});
const ids = (rows: ProRow[]) => rows.map((r) => r.user.id);

describe('pro user filters', () => {
	it('splits store purchases from promo and admin grants', () => {
		const {paid, granted} = splitRows(ROWS);
		expect(ids(paid)).toEqual(['ios_year', 'and_month', 'and_life', 'ios_other']);
		expect(ids(granted)).toEqual(['promo', 'premium', 'promo_stale']);
	});

	it('platform is the store only for a store purchase', () => {
		expect(ROWS.map(rowPlatform)).toEqual(['ios', 'android', 'android', 'ios', 'none', 'none', 'none']);
	});

	it('expiring means an end date inside 7 days', () => {
		expect(ids(ROWS.filter((r) => isExpiringSoon(r, NOW)))).toEqual(['and_month']);
	});

	it('paid filters combine; an unknown product shows only under all', () => {
		const {paid} = splitRows(ROWS);
		expect(ids(filterPaidRows(paid, filters()))).toEqual(['ios_year', 'and_month', 'and_life', 'ios_other']);
		expect(ids(filterPaidRows(paid, filters({platform: 'android'})))).toEqual(['and_month', 'and_life']);
		expect(ids(filterPaidRows(paid, filters({platform: 'android', source: 'lifetime'})))).toEqual(['and_life']);
		expect(ids(filterPaidRows(paid, filters({platform: 'ios'})))).toEqual(['ios_year', 'ios_other']);
		expect(ids(filterPaidRows(paid, filters({query: 'and_m'})))).toEqual(['and_month']);
	});

	it('facet counts ignore their own facet and respect the others', () => {
		const {paid} = splitRows(ROWS);
		const values = ['all', 'lifetime', 'yearly', 'monthly'];
		expect(paidFacetCounts(paid, filters({source: 'yearly', platform: 'android'}), 'source', values)).toEqual({
			all: 2,
			lifetime: 1,
			yearly: 0,
			monthly: 1,
		});
		expect(paidFacetCounts(paid, filters(), 'platform', ['all', 'ios', 'android'])).toEqual({all: 4, ios: 2, android: 2});
	});

	it('sorts recent events first, then by join date', () => {
		const sorted = sortRows([
			row('old', {}, {created_at: '2025-01-01T00:00:00Z'}),
			row('event', {last_event_at: '2026-01-01T00:00:00Z'}),
			row('new', {}, {created_at: '2026-06-01T00:00:00Z'}),
			row('latest', {last_event_at: '2026-10-01T00:00:00Z'}),
		]);
		expect(ids(sorted)).toEqual(['latest', 'event', 'new', 'old']);
	});
});
