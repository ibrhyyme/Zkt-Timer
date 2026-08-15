import {getEventName} from './shared';

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

/**
 * The venue's zone, which is what every time in the schedule has to be read in.
 * Undefined when the federation has not published one (older deployment), in
 * which case every helper below falls back to the reader's own zone — the
 * behaviour this file had before rooms and zones existed.
 */
export function compTimezone(detail: any): string | undefined {
	return typeof detail?.timezone === 'string' && detail.timezone ? detail.timezone : undefined;
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
 * Merge custom schedule items with round rows derived from group times into a
 * single chronological list. Round rows span min(group start) → max(group end).
 * Rows without any time sort to the end (so untimed rounds still show up).
 */
export function buildScheduleRows(
	detail: any,
	roundLabel: (n: number) => string,
	/** Name of a chain's last round; without it a final reads as "Tur 3". */
	finalLabel?: string
): ScheduleRow[] {
	const rows: ScheduleRow[] = [];
	const tz = compTimezone(detail);
	// Rooms are only present once the organizer defined stages; every lookup
	// below degrades to null, which reads as "one hall" everywhere downstream.
	const roomById = new Map<string, {name: string; color: string}>(
		(detail.rooms || []).map((r: any) => [r.id, {name: r.name, color: r.color}])
	);
	const room = (id?: string | null) => (id ? roomById.get(id) ?? null : null);

	for (const item of detail.schedule || []) {
		const rm = room(item.roomId);
		rows.push({
			id: item.id,
			title: item.title,
			start: item.startTime || null,
			end: item.endTime || null,
			isRound: false,
			roomName: rm?.name ?? null,
			roomColor: rm?.color ?? null,
		});
	}

	for (const ev of detail.events || []) {
		for (const r of ev.rounds || []) {
			const timed = (r.groups || []).filter((g: any) => g.startTime);
			// A round of a day-split competition runs on BOTH days: its groups sit on
			// different dates. Collapsing them into one min→max row produced a block
			// spanning "Saturday 09:00 – Sunday 11:00", a session that never happens.
			// One row per calendar day instead, exactly like the federation's own
			// schedule builder.
			//
			// The room is part of the bucket key too, which the federation's builder
			// does not do: a round run on two stages at once has groups in both, and
			// keying by day alone collapses them into one block labelled with
			// whichever room happened to come first. A single-hall competition has
			// one room (or none) and buckets exactly as it did before.
			const byDayRoom = new Map<
				string,
				{start: string; end: string | null; dayLabel: string | null; roomId: string | null}
			>();
			for (const g of timed) {
				const roomId = g.roomId ?? null;
				const key = `${dateKeyInTz(g.startTime, tz)}|${roomId ?? ''}`;
				const end = g.endTime || g.startTime;
				const cur = byDayRoom.get(key);
				if (!cur) {
					byDayRoom.set(key, {start: g.startTime, end, dayLabel: g.dayLabel ?? null, roomId});
				} else {
					if (g.startTime < cur.start) cur.start = g.startTime;
					if (cur.end === null || end > cur.end) cur.end = end;
				}
			}

			// A chain's last round is a final wherever it runs; the day comes from the
			// round for a SEPARATE chain and from the group block otherwise.
			const name = `${getEventName(ev.eventId)} — ${
				r.isFinal && finalLabel ? finalLabel : roundLabel(r.roundNumber)
			}`;

			if (byDayRoom.size === 0) {
				// No timed groups. The organizer may still have placed the ROUND on
				// the calendar — that is how the second day of a day-split event is
				// usually laid out, since groups only get times once assignments are
				// made. Reading only the groups made those rounds vanish.
				const rm = room(r.roomId);
				rows.push({
					id: r.roundId,
					title: name,
					start: r.startTime || null,
					end: r.endTime || null,
					isRound: true,
					eventId: ev.eventId,
					roundNumber: r.roundNumber,
					dayLabel: r.dayLabel ?? null,
					dayName: r.dayLabel ?? null,
					roomName: rm?.name ?? null,
					roomColor: rm?.color ?? null,
				});
				continue;
			}
			for (const [key, d] of byDayRoom) {
				const rm = room(d.roomId);
				rows.push({
					id: byDayRoom.size > 1 ? `${r.roundId}-${key}` : r.roundId,
					title: name,
					start: d.start,
					end: d.end,
					isRound: true,
					eventId: ev.eventId,
					roundNumber: r.roundNumber,
					dayLabel: r.dayLabel ?? null,
					dayName: d.dayLabel ?? r.dayLabel ?? null,
					roomName: rm?.name ?? null,
					roomColor: rm?.color ?? null,
				});
			}
		}
	}

	return rows.sort((a, b) => {
		if (a.start === null && b.start === null) return 0;
		if (a.start === null) return 1;
		if (b.start === null) return -1;
		return a.start.localeCompare(b.start);
	});
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
