const TZ = 'Europe/Istanbul';

const dateParts = new Intl.DateTimeFormat('en-GB', {
	timeZone: TZ,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
});

interface IstanbulParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
	weekday: number;
}

function getIstanbulParts(d: Date): IstanbulParts {
	const parts = dateParts.formatToParts(d);
	const map: Record<string, string> = {};
	for (const p of parts) {
		if (p.type !== 'literal') map[p.type] = p.value;
	}
	const year = Number(map.year);
	const month = Number(map.month);
	const day = Number(map.day);
	const hour = Number(map.hour === '24' ? '0' : map.hour);
	const minute = Number(map.minute);
	const second = Number(map.second);
	const weekday = getIstanbulWeekday(year, month, day);
	return {year, month, day, hour, minute, second, weekday};
}

function getIstanbulWeekday(year: number, month: number, day: number): number {
	const utcMs = Date.UTC(year, month - 1, day);
	const jsDay = new Date(utcMs).getUTCDay();
	return jsDay === 0 ? 7 : jsDay;
}

function utcDateForIstanbulMidnight(year: number, month: number, day: number): Date {
	const candidate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
	const istParts = getIstanbulParts(candidate);
	const istMs = Date.UTC(istParts.year, istParts.month - 1, istParts.day, istParts.hour, istParts.minute, istParts.second);
	const offsetMs = istMs - candidate.getTime();
	return new Date(candidate.getTime() - offsetMs);
}

export function todayBoundsIstanbul(now: Date = new Date()): {start: Date; end: Date} {
	const p = getIstanbulParts(now);
	const start = utcDateForIstanbulMidnight(p.year, p.month, p.day);
	const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
	return {start, end};
}

export function thisWeekBoundsIstanbul(now: Date = new Date()): {start: Date; end: Date} {
	const p = getIstanbulParts(now);
	const daysFromMonday = p.weekday - 1;
	const mondayUtcMs = Date.UTC(p.year, p.month - 1, p.day) - daysFromMonday * 24 * 60 * 60 * 1000;
	const monday = new Date(mondayUtcMs);
	const start = utcDateForIstanbulMidnight(monday.getUTCFullYear(), monday.getUTCMonth() + 1, monday.getUTCDate());
	const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
	return {start, end};
}

export function thisMonthBoundsIstanbul(now: Date = new Date()): {start: Date; end: Date} {
	const p = getIstanbulParts(now);
	return monthBoundsIstanbul(p.year, p.month);
}

export function monthBoundsIstanbul(year: number, month: number): {start: Date; end: Date} {
	const start = utcDateForIstanbulMidnight(year, month, 1);
	const nextMonth = month === 12 ? 1 : month + 1;
	const nextYear = month === 12 ? year + 1 : year;
	const end = utcDateForIstanbulMidnight(nextYear, nextMonth, 1);
	return {start, end};
}

export function parseMonthYear(s: string): {year: number; month: number} | null {
	const m = /^(\d{4})-(\d{2})$/.exec(s);
	if (!m) return null;
	const year = Number(m[1]);
	const month = Number(m[2]);
	if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
	return {year, month};
}

export function dateToMinuteBucket(d: Date): bigint {
	return BigInt(Math.floor(d.getTime() / 60000));
}
