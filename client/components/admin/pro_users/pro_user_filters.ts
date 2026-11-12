// Filters for the two admin Pro lists. The server returns every member already
// classified (server/util/pro_membership.ts); the client splits them into paid
// (store purchases) and granted (promo code or admin), then filters here.

export type ProPlatform = 'ios' | 'android' | 'none';

export interface ProRow {
	tier: string;
	source: string;
	status: string;
	expires_at?: string | null;
	last_event_at?: string | null;
	promo_code?: string | null;
	user: {
		id: string;
		username: string;
		email: string;
		created_at: string;
		iap_platform?: string | null;
		iap_product_id?: string | null;
		revenuecat_user_id?: string | null;
		profile?: any;
	};
}

/** Paid list only. Store purchases of an unknown product ('other') show under 'all'. */
export interface PaidFilters {
	source: 'all' | 'lifetime' | 'yearly' | 'monthly';
	platform: 'all' | 'ios' | 'android';
	query: string;
}

export type PaidFacet = 'source' | 'platform';

export type PaidFacetFilters = Omit<PaidFilters, 'query'>;

export const DEFAULT_PAID_FACETS: PaidFacetFilters = {source: 'all', platform: 'all'};

export const EXPIRING_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const STORE_SOURCES = new Set(['lifetime', 'yearly', 'monthly', 'other']);

export function isStoreSource(source: string): boolean {
	return STORE_SOURCES.has(source);
}

/** Store purchases go to the paid list, promo and admin grants to the other one. */
export function splitRows(rows: ProRow[]): {paid: ProRow[]; granted: ProRow[]} {
	const paid: ProRow[] = [];
	const granted: ProRow[] = [];
	for (const row of rows) (isStoreSource(row.source) ? paid : granted).push(row);
	return {paid, granted};
}

/** A store the purchase came through; promo and admin grants have none. */
export function rowPlatform(row: ProRow): ProPlatform {
	if (!isStoreSource(row.source)) return 'none';
	if (row.user.iap_platform === 'ios') return 'ios';
	if (row.user.iap_platform === 'android') return 'android';
	return 'none';
}

export function isExpiringSoon(row: ProRow, now: Date): boolean {
	if (!row.expires_at) return false;
	const end = new Date(row.expires_at).getTime();
	return end > now.getTime() && end - now.getTime() <= EXPIRING_DAYS * DAY_MS;
}

function matchesFacet(row: ProRow, facet: PaidFacet, value: string): boolean {
	if (value === 'all') return true;
	return facet === 'source' ? row.source === value : rowPlatform(row) === value;
}

export function matchesQuery(row: ProRow, query: string): boolean {
	const q = query.trim().toLocaleLowerCase();
	if (!q) return true;
	return (
		row.user.username?.toLocaleLowerCase().includes(q) ||
		row.user.email?.toLocaleLowerCase().includes(q) ||
		(row.promo_code || '').toLocaleLowerCase().includes(q)
	);
}

const PAID_FACETS: PaidFacet[] = ['source', 'platform'];

/** Rows passing every filter, except the one facet named in `skip`. */
export function filterPaidRows(rows: ProRow[], filters: PaidFilters, skip?: PaidFacet): ProRow[] {
	return rows.filter(
		(row) =>
			matchesQuery(row, filters.query) &&
			PAID_FACETS.every((facet) => facet === skip || matchesFacet(row, facet, filters[facet])),
	);
}

/**
 * How many rows each option of a facet would show, given the other filters. The
 * chip counts then always add up to what selecting them would list.
 */
export function paidFacetCounts(
	rows: ProRow[],
	filters: PaidFilters,
	facet: PaidFacet,
	values: string[],
): Record<string, number> {
	const base = filterPaidRows(rows, filters, facet);
	const out: Record<string, number> = {};
	for (const value of values) {
		out[value] = value === 'all' ? base.length : base.filter((row) => matchesFacet(row, facet, value)).length;
	}
	return out;
}

/** Most recent purchase or redemption first; grants with no date by join date after them. */
export function sortRows(rows: ProRow[]): ProRow[] {
	return [...rows].sort((a, b) => {
		const ae = a.last_event_at ? new Date(a.last_event_at).getTime() : null;
		const be = b.last_event_at ? new Date(b.last_event_at).getTime() : null;
		if (ae !== null && be !== null && ae !== be) return be - ae;
		if (ae !== null && be === null) return -1;
		if (ae === null && be !== null) return 1;
		return new Date(b.user.created_at).getTime() - new Date(a.user.created_at).getTime();
	});
}
