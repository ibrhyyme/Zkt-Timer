// Is a competition history? The one rule every list on this page shares.
//
// Dependency-free on purpose (no React, no i18n, no styling) so it can be unit
// tested and imported from anywhere. The federation runs the same rule in
// `lib/zkt/competition-past.ts`; keep the two in step.

/** Local calendar day as "YYYY-MM-DD" — the key every date comparison here uses. */
export function localTodayStr(now: Date = new Date()): string {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Two independent signals, either one is enough.
 *
 * The calendar: a competition whose last day is behind us is over. It stays
 * current all through that last day, because results are entered that evening
 * and that is exactly when people open it.
 *
 * The federation status: ZKT marks a competition FINISHED or PUBLISHED, which
 * can land before the printed end date. WCA payloads carry no status, so there
 * only the calendar half applies.
 *
 * Every list on the competitions page is "what is still ahead" — the past
 * belongs to search alone, the one place someone is deliberately asking for it.
 * Accepts both "YYYY-MM-DD" (WCA) and full ISO (federation) dates.
 */
export function isPastCompetition(
	comp: {end_date?: string | null; status?: string | null},
	todayStr: string
): boolean {
	const status = (comp.status || '').toUpperCase();
	if (status === 'FINISHED' || status === 'PUBLISHED') return true;
	if (!comp.end_date) return false;
	return comp.end_date.slice(0, 10) < todayStr;
}

/**
 * The ZKT status a card should show. The status is set by hand on the federation
 * and an organizer does not always move it on, so the calendar corrects it: a
 * competition whose last day has passed is finished, and one that has started
 * no longer takes entries (WCA closes registration before the start date).
 * The federation applies the same rule in `lib/zkt/registration-phase.ts`.
 */
export function displayZktStatus(
	comp: {start_date?: string | null; end_date?: string | null; status?: string | null},
	todayStr: string
): string {
	const status = (comp.status || '').toUpperCase();
	const runUp = status === 'ANNOUNCED' || status === 'REGISTRATION_OPEN';
	if (isPastCompetition(comp, todayStr) && (runUp || status === 'REGISTRATION_CLOSED' || status === 'ONGOING')) {
		return 'FINISHED';
	}
	if (runUp && comp.start_date && comp.start_date.slice(0, 10) <= todayStr) return 'REGISTRATION_CLOSED';
	return status;
}
