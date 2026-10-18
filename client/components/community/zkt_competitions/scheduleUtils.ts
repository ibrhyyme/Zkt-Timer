export interface ScheduleRow {
	id: string;
	title: string;
	start: string | null; // ISO
	end: string | null;
	isRound: boolean;
	eventId?: string;
	roundNumber?: number;
	/**
	 * Day-chain of the ROUND ("A Günü"), set only by a SEPARATE day-split event
	 * where each day runs its own chain. Shown on the row itself, since two such
	 * rounds are otherwise identical.
	 */
	dayLabel?: string | null;
	/**
	 * Day this block physically runs on. Every row of a given calendar day shares
	 * it, so it belongs in the day heading rather than repeated on each row.
	 */
	dayName?: string | null;
	/** Stage this block runs in; null when the organizer defined no rooms. */
	roomName?: string | null;
	roomColor?: string | null;
}

/** Wall-clock parts of an instant in `tz` (reader's zone when tz is absent). */
function wallParts(iso: string, tz?: string): {y: number; m: number; d: number; h: number; min: number} {
	const parts = new Intl.DateTimeFormat('en-US', {
		...(tz ? {timeZone: tz} : {}),
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	}).formatToParts(new Date(iso));
	const get = (type: string) => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
	// Midnight formats as hour 24 in some engines; 24:00 belongs to the day it
	// starts, not the next one, so it is normalised rather than rolled over.
	return {y: get('year'), m: get('month'), d: get('day'), h: get('hour') % 24, min: get('minute')};
}

/** Calendar date of an instant in `tz`, for bucketing a block by day. */
export function dateKeyInTz(iso: string, tz?: string): string {
	const p = wallParts(iso, tz);
	return `${p.y}-${p.m}-${p.d}`;
}

/** Hour of day as a float (09:30 -> 9.5), for placing a block on a grid. */
export function hourFloatInTz(iso: string, tz?: string): number {
	const p = wallParts(iso, tz);
	return p.h + p.min / 60;
}

/**
 * Group rows by calendar day in the venue's zone. Without `tz` this buckets by
 * the reader's own zone, which is what it did before zones were published.
 */
export function groupRowsByDay(
	rows: ScheduleRow[],
	locale: string,
	tz?: string
): Array<{day: string; rows: ScheduleRow[]}> {
	const byDay = new Map<string, ScheduleRow[]>();
	const UNTIMED = '__untimed__';
	for (const row of rows) {
		const key = row.start ? formatDayHeading(row.start, locale, tz) : UNTIMED;
		if (!byDay.has(key)) byDay.set(key, []);
		byDay.get(key)!.push(row);
	}
	return Array.from(byDay.entries()).map(([day, dayRows]) => ({
		day: day === UNTIMED ? '' : day,
		rows: dayRows,
	}));
}

/** "Cumartesi, 12 Temmuz" in the venue's zone. */
export function formatDayHeading(iso: string, locale: string, tz?: string): string {
	return new Date(iso).toLocaleDateString(locale, {
		...(tz ? {timeZone: tz} : {}),
		weekday: 'long',
		day: 'numeric',
		month: 'long',
	});
}

/** "09:30" in the venue's zone. */
export function formatClock(iso: string, locale: string, tz?: string): string {
	return new Date(iso).toLocaleTimeString(locale, {
		...(tz ? {timeZone: tz} : {}),
		hour: '2-digit',
		minute: '2-digit',
	});
}

export function formatRowTime(row: ScheduleRow, locale: string, tz?: string): string {
	if (!row.start) return '';
	return row.end
		? `${formatClock(row.start, locale, tz)} – ${formatClock(row.end, locale, tz)}`
		: formatClock(row.start, locale, tz);
}

/** Whole minutes a block lasts; 0 when it has no end. */
export function rowDurationMinutes(row: ScheduleRow): number {
	if (!row.start || !row.end) return 0;
	return Math.max(0, Math.round((new Date(row.end).getTime() - new Date(row.start).getTime()) / 60000));
}

/** Is `now` inside this block? Drives the "happening now" marker. */
export function isRowNow(row: ScheduleRow, now: number): boolean {
	if (!row.start) return false;
	const start = new Date(row.start).getTime();
	const end = row.end ? new Date(row.end).getTime() : start;
	return now >= start && now < end;
}

/**
 * Distinct rooms the schedule uses, in first-appearance order. Empty when the
 * competition runs in a single unnamed hall, which is the signal to draw one
 * column and no legend.
 */
export function collectRooms(rows: ScheduleRow[]): Array<{name: string; color: string}> {
	const byName = new Map<string, string>();
	for (const row of rows) {
		if (row.roomName && !byName.has(row.roomName)) {
			byName.set(row.roomName, row.roomColor || '');
		}
	}
	return [...byName.entries()].map(([name, color]) => ({name, color}));
}
