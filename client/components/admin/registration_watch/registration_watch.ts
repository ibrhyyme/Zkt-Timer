// Formatting for the registration watch page. Times are shown in Turkey's zone
// whatever the browser's, so a moment reads the same on every device and in a
// report pasted from the page.

const ZONE = 'Europe/Istanbul';

/** "27 Eki 19:10" style. Null for a missing or broken value. */
export function formatWatchMoment(value: string | Date | null | undefined, lang: string): string | null {
	if (!value) return null;
	const d = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(d.getTime())) return null;
	return new Intl.DateTimeFormat(lang || 'tr', {
		timeZone: ZONE,
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).format(d);
}

/** A YYYY-MM-DD competition day as "31 Eki". */
export function formatWatchDay(day: string, lang: string): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
	return new Intl.DateTimeFormat(lang || 'tr', {timeZone: 'UTC', day: 'numeric', month: 'short'}).format(
		new Date(`${day}T00:00:00Z`)
	);
}

/**
 * Registration numbers up to the highest accepted one that are not accepted:
 * cancelled, waiting or pending registrations. A removed competitor's number lands here.
 */
export function missingRegistrantIds(ids: Array<number | null | undefined>): number[] {
	const present = new Set(ids.filter((id): id is number => typeof id === 'number' && id > 0));
	if (present.size === 0) return [];
	const max = Math.max(...present);
	const out: number[] = [];
	for (let i = 1; i <= max; i++) {
		if (!present.has(i)) out.push(i);
	}
	return out;
}
