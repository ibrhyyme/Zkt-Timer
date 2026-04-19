import block from '../../../styles/bem';

export const b = block('zkt-comp');

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
