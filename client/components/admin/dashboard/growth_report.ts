// Shapes the server's sparse month/day buckets into the four report views of the
// dashboard's growth panel. Pure, so the calendar edges (a month still running, a
// year with gaps, the first month of data) are pinned by a test.

export interface GrowthBucketData {
	key: string;
	count: number;
	activated?: number | null;
	pro?: number | null;
}

export interface YearMonth {
	year: number;
	month: number;
}

export interface ReportRow {
	/** 'YYYY', 'YYYY-MM' or 'YYYY-MM-DD'. */
	key: string;
	year: number;
	month: number | null;
	day: number | null;
	count: number;
	activated: number | null;
	pro: number | null;
	/** The same period one year earlier, or null when there is no data that far back. */
	previous: number | null;
	/** The period is still running, so a comparison would mislead. */
	partial: boolean;
}

export interface ReportTotals {
	count: number;
	activated: number | null;
	pro: number | null;
	previous: number | null;
	/** Over finished periods that have a previous value, null when none. */
	change: number | null;
}

export interface MatrixRow {
	year: number;
	/** 12 entries; null = a month that has not happened yet or precedes the data. */
	cells: Array<number | null>;
	total: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function monthKey(year: number, month: number): string {
	return `${year}-${pad(month)}`;
}

export function dayKey(year: number, month: number, day: number): string {
	return `${year}-${pad(month)}-${pad(day)}`;
}

export function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function parseYm(key: string): YearMonth | null {
	const m = /^(\d{4})-(\d{2})/.exec(key);
	return m ? {year: Number(m[1]), month: Number(m[2])} : null;
}

function cmp(a: YearMonth, b: YearMonth): number {
	return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

function byKey(buckets: GrowthBucketData[]): Map<string, GrowthBucketData> {
	return new Map(buckets.map((b) => [b.key, b]));
}

/** The first month with any data, or null for an empty series. */
export function firstMonth(months: GrowthBucketData[]): YearMonth | null {
	let first: YearMonth | null = null;
	for (const b of months) {
		const ym = parseYm(b.key);
		if (ym && (!first || cmp(ym, first) < 0)) first = ym;
	}
	return first;
}

/** Every year from the first data to now, newest first, gaps included. */
export function reportYears(months: GrowthBucketData[], now: YearMonth): number[] {
	const first = firstMonth(months);
	const from = first ? Math.min(first.year, now.year) : now.year;
	const out: number[] = [];
	for (let y = now.year; y >= from; y--) out.push(y);
	return out;
}

/** The percentage change, rounded to one decimal; null when there is nothing to compare. */
export function percentChange(current: number, previous: number | null): number | null {
	if (previous === null || previous === 0) return null;
	return Math.round(((current - previous) / previous) * 1000) / 10;
}

function monthInRange(ym: YearMonth, first: YearMonth | null, now: YearMonth): boolean {
	return !!first && cmp(ym, first) >= 0 && cmp(ym, now) <= 0;
}

function rowFor(
	map: Map<string, GrowthBucketData>,
	ym: YearMonth,
	first: YearMonth | null,
	now: YearMonth,
	cohort: boolean,
	key: string,
	day: number | null,
): ReportRow {
	const b = map.get(monthKey(ym.year, ym.month));
	const prevYm = {year: ym.year - 1, month: ym.month};
	const prev = map.get(monthKey(prevYm.year, prevYm.month));
	return {
		key,
		year: ym.year,
		month: ym.month,
		day,
		count: b?.count ?? 0,
		activated: cohort ? b?.activated ?? 0 : null,
		pro: cohort ? b?.pro ?? 0 : null,
		previous: monthInRange(prevYm, first, now) ? prev?.count ?? 0 : null,
		partial: ym.year === now.year && ym.month === now.month,
	};
}

/** All years, all months: one row per year with twelve month cells. */
export function buildMatrix(months: GrowthBucketData[], now: YearMonth): MatrixRow[] {
	const map = byKey(months);
	const first = firstMonth(months);
	return reportYears(months, now).map((year) => {
		const cells: Array<number | null> = [];
		let total = 0;
		for (let month = 1; month <= 12; month++) {
			const ym = {year, month};
			if (!monthInRange(ym, first, now)) {
				cells.push(null);
				continue;
			}
			const count = map.get(monthKey(year, month))?.count ?? 0;
			cells.push(count);
			total += count;
		}
		return {year, cells, total};
	});
}

/** One year, all months: the months that have happened, January first. */
export function buildYearRows(months: GrowthBucketData[], year: number, now: YearMonth, cohort: boolean): ReportRow[] {
	const map = byKey(months);
	const first = firstMonth(months);
	const rows: ReportRow[] = [];
	for (let month = 1; month <= 12; month++) {
		const ym = {year, month};
		if (!monthInRange(ym, first, now)) continue;
		rows.push(rowFor(map, ym, first, now, cohort, monthKey(year, month), null));
	}
	return rows;
}

/** All years, one month: that month in every year it has happened, newest first. */
export function buildMonthAcrossYears(months: GrowthBucketData[], month: number, now: YearMonth, cohort: boolean): ReportRow[] {
	const map = byKey(months);
	const first = firstMonth(months);
	return reportYears(months, now)
		.filter((year) => monthInRange({year, month}, first, now))
		.map((year) => rowFor(map, {year, month}, first, now, cohort, String(year), null));
}

/** One year, one month: every day up to today. Days carry no year-ago comparison. */
export function buildDayRows(
	days: GrowthBucketData[],
	year: number,
	month: number,
	today: YearMonth & {day: number},
	cohort: boolean,
): ReportRow[] {
	const map = byKey(days);
	const isCurrent = year === today.year && month === today.month;
	if (year > today.year || (year === today.year && month > today.month)) return [];
	const last = isCurrent ? today.day : daysInMonth(year, month);
	const rows: ReportRow[] = [];
	for (let day = 1; day <= last; day++) {
		const key = dayKey(year, month, day);
		const b = map.get(key);
		rows.push({
			key,
			year,
			month,
			day,
			count: b?.count ?? 0,
			activated: cohort ? b?.activated ?? 0 : null,
			pro: cohort ? b?.pro ?? 0 : null,
			previous: null,
			partial: isCurrent && day === today.day,
		});
	}
	return rows;
}

export function sumRows(rows: ReportRow[], cohort: boolean): ReportTotals {
	let count = 0;
	let activated = 0;
	let pro = 0;
	let previous = 0;
	let hasPrevious = false;
	// The change compares finished periods only: a month still running against a whole
	// month a year ago would always read as a drop.
	let cmpCurrent = 0;
	let cmpPrevious = 0;
	for (const r of rows) {
		count += r.count;
		activated += r.activated ?? 0;
		pro += r.pro ?? 0;
		if (r.previous !== null) {
			hasPrevious = true;
			previous += r.previous;
			if (!r.partial) {
				cmpCurrent += r.count;
				cmpPrevious += r.previous;
			}
		}
	}
	return {
		count,
		activated: cohort ? activated : null,
		pro: cohort ? pro : null,
		previous: hasPrevious ? previous : null,
		change: percentChange(cmpCurrent, cmpPrevious || null),
	};
}

/** The busiest bucket, for the summary line. Ties go to the earliest. */
export function peakRow<T extends {count: number}>(rows: T[]): T | null {
	let best: T | null = null;
	for (const r of rows) if (r.count > 0 && (!best || r.count > best.count)) best = r;
	return best;
}

/** The month before the given one, and its count from the series. */
export function previousMonthCount(months: GrowthBucketData[], year: number, month: number): number | null {
	const prev = month === 1 ? {year: year - 1, month: 12} : {year, month: month - 1};
	const first = firstMonth(months);
	if (!first || cmp(prev, first) < 0) return null;
	return byKey(months).get(monthKey(prev.year, prev.month))?.count ?? 0;
}
