import block from '../../../styles/bem';

export const b = block('zkt-admin-comp');

// WCA events supported by ZK competitions
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
 * Parse a user-entered time string into centiseconds.
 * Supports: "12.34", "1:23.45", "1:23", "DNF", "DNS"
 * Returns null for invalid input, -1 for DNF, -2 for DNS.
 */
export function parseTimeInputToCs(input: string): number | null {
	const trimmed = input.trim().toUpperCase();
	if (!trimmed) return null;
	if (trimmed === 'DNF') return -1;
	if (trimmed === 'DNS') return -2;

	// Match mm:ss.cc or ss.cc or just seconds
	const match = trimmed.match(/^(?:(\d+):)?(\d+)(?:\.(\d{1,2}))?$/);
	if (!match) return null;

	const minutes = match[1] ? parseInt(match[1], 10) : 0;
	const seconds = parseInt(match[2], 10);
	const centis = match[3] ? parseInt(match[3].padEnd(2, '0'), 10) : 0;

	const totalCs = minutes * 6000 + seconds * 100 + centis;
	if (totalCs <= 0) return null;
	return totalCs;
}

/**
 * Format centiseconds to display string.
 * -1 = DNF, -2 = DNS
 */
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

export const ZKT_ROUND_FORMATS = [
	{id: 'BO1', name: 'Bo1'},
	{id: 'BO2', name: 'Bo2'},
	{id: 'BO3', name: 'Bo3'},
	{id: 'MO3', name: 'Mo3'},
	{id: 'AO5', name: 'Ao5'},
];

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
