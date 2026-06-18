import block from '../../../styles/bem';
import {countryFlag} from '../my_schedule/shared';

export const b = block('zkt-comp');

// Re-export so competition screens pull identity helpers from one place.
export {countryFlag};

export interface CompetitorIdentity {
	username?: string | null;
	first_name?: string | null;
	last_name?: string | null;
	join_country?: string | null;
	// Present only for registered users (the ghost-person branch leaves it
	// undefined, so the UI falls back to an avatar placeholder).
	profile?: {pfp_image?: {url?: string | null} | null} | null;
}

/** Display name: "First Last" when available, else username, else empty. */
export function competitorDisplayName(user?: CompetitorIdentity | null): string {
	if (!user) return '';
	const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
	return full || user.username || '';
}

/** Country flag emoji for a competitor; empty string when no country. */
export function competitorFlag(user?: CompetitorIdentity | null): string {
	return countryFlag(user?.join_country);
}

/** Ghost person identity shape (mirror of ZktPerson scalar fields). */
export interface PersonIdentity {
	first_name?: string | null;
	last_name?: string | null;
	country_code?: string | null;
	wca_id?: string | null;
	external_id?: string | null;
}

/**
 * Resolve a competitor row (result / registration / assignment) to one identity:
 * the registered user, or the account-less person mapped to the same shape so
 * competitorDisplayName/competitorFlag work unchanged.
 */
export function competitorOf(
	row?: {user?: CompetitorIdentity | null; person?: PersonIdentity | null} | null
): CompetitorIdentity | null {
	if (!row) return null;
	if (row.user) return row.user;
	if (row.person) {
		return {
			username: null,
			first_name: row.person.first_name,
			last_name: row.person.last_name,
			join_country: row.person.country_code,
		};
	}
	return null;
}

/**
 * Semantic role colors for competition staff badges. Centralised so
 * ZktCompetitorDetail / ZktCompetitorsTab / ZktActivityDetail share one source
 * instead of each redeclaring the same hardcoded hex set.
 */
export const ZKT_ROLE_COLORS: Record<string, string> = {
	COMPETITOR: '#2dbd61',
	JUDGE: '#42a5f5',
	SCRAMBLER: '#9b59b6',
	RUNNER: '#ee6a26',
	ORGANIZER: '#246bfd',
	STAFF: '#95a5a6',
};

/** Podium medal colors (gold / silver / bronze), index 0→2 = 1st→3rd. */
export const ZKT_MEDAL_COLORS = ['#f5c518', '#c0c0c0', '#cd7f32'];

export const ZKT_WCA_EVENTS: Array<{id: string; name: string}> = [
	{id: '333', name: '3x3x3'},
	{id: '222', name: '2x2x2'},
	{id: '444', name: '4x4x4'},
	{id: '555', name: '5x5x5'},
	{id: '666', name: '6x6x6'},
	{id: '777', name: '7x7x7'},
	{id: '333bf', name: '3x3 BLD'},
	{id: '333fm', name: '3x3 FMC'},
	{id: '333oh', name: '3x3 OH'},
	{id: 'clock', name: 'Clock'},
	{id: 'minx', name: 'Megaminx'},
	{id: 'pyram', name: 'Pyraminx'},
	{id: 'skewb', name: 'Skewb'},
	{id: 'sq1', name: 'Square-1'},
	{id: '444bf', name: '4x4 BLD'},
	{id: '555bf', name: '5x5 BLD'},
	{id: '333mbf', name: '3x3 MBLD'},
];

export function getEventName(eventId: string): string {
	return ZKT_WCA_EVENTS.find((e) => e.id === eventId)?.name || eventId;
}

/**
 * "HH:mm - HH:mm" from two ISO datetime strings. If endIso is null/undefined,
 * returns only the start. Returns '' for unparseable input.
 */
export function formatTimeRange(startIso: string | null | undefined, endIso?: string | null): string {
	if (!startIso) return '';
	const fmt = (iso: string) => {
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		return d.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
	};
	const start = fmt(startIso);
	if (!endIso) return start;
	const end = fmt(endIso);
	return end ? `${start} - ${end}` : start;
}

export function formatCs(cs: number | null | undefined): string {
	if (cs === null || cs === undefined) return '';
	if (cs === -1) return 'DNF';
	if (cs === -2) return 'DNS';
	if (cs <= 0) return '';

	const totalSeconds = Math.floor(cs / 100);
	const centis = cs % 100;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	const centisStr = centis.toString().padStart(2, '0');
	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${centisStr}`;
	}
	return `${seconds}.${centisStr}`;
}

export function formatDateRange(start: string | Date, end: string | Date, locale: string = 'tr-TR'): string {
	const s = typeof start === 'string' ? new Date(start) : start;
	const e = typeof end === 'string' ? new Date(end) : end;
	const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(locale, opts);

	if (s.toDateString() === e.toDateString()) {
		return fmt(s, {day: 'numeric', month: 'short', year: 'numeric'});
	}
	if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
		return `${fmt(s, {day: 'numeric'})} - ${fmt(e, {day: 'numeric', month: 'short', year: 'numeric'})}`;
	}
	return `${fmt(s, {day: 'numeric', month: 'short'})} - ${fmt(e, {day: 'numeric', month: 'short', year: 'numeric'})}`;
}

export function getFormatAttempts(format: string): number {
	switch (format) {
		case 'BO1':
			return 1;
		case 'BO2':
			return 2;
		case 'BO3':
		case 'MO3':
			return 3;
		case 'AO5':
			return 5;
		default:
			return 5;
	}
}

export function formatHasAverage(format: string): boolean {
	return format === 'MO3' || format === 'AO5';
}

/**
 * Format N attempts (centiseconds) to display strings (DNF/DNS aware), padding
 * missing attempts with "-". Mirrors the WCA my_schedule formatAttempts so the
 * live table + result modal render attempts identically to a WCA competition.
 */
export function formatAttempts(
	attempts: Array<number | null | undefined>,
	count: number
): string[] {
	const out: string[] = [];
	for (let i = 0; i < count; i++) {
		out.push(formatCs(attempts[i]) || '-');
	}
	return out;
}

export function formatName(format: string): string {
	switch (format) {
		case 'BO1':
			return 'Bo1';
		case 'BO2':
			return 'Bo2';
		case 'BO3':
			return 'Bo3';
		case 'MO3':
			return 'Mo3';
		case 'AO5':
			return 'Ao5';
		default:
			return format;
	}
}
