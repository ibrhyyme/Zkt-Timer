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
}

/** Local calendar date of an ISO instant, for bucketing a round by day. */
function dateKeyOf(iso: string): string {
	const d = new Date(iso);
	return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
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

	for (const item of detail.schedule || []) {
		rows.push({
			id: item.id,
			title: item.title,
			start: item.startTime || null,
			end: item.endTime || null,
			isRound: false,
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
			const byDay = new Map<string, {start: string; end: string | null; dayLabel: string | null}>();
			for (const g of timed) {
				const key = dateKeyOf(g.startTime);
				const end = g.endTime || g.startTime;
				const cur = byDay.get(key);
				if (!cur) {
					byDay.set(key, {start: g.startTime, end, dayLabel: g.dayLabel ?? null});
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

			if (byDay.size === 0) {
				rows.push({
					id: r.roundId,
					title: name,
					start: null,
					end: null,
					isRound: true,
					eventId: ev.eventId,
					roundNumber: r.roundNumber,
					dayLabel: r.dayLabel ?? null,
					dayName: r.dayLabel ?? null,
				});
				continue;
			}
			for (const [key, d] of byDay) {
				rows.push({
					id: byDay.size > 1 ? `${r.roundId}-${key}` : r.roundId,
					title: name,
					start: d.start,
					end: d.end,
					isRound: true,
					eventId: ev.eventId,
					roundNumber: r.roundNumber,
					dayLabel: r.dayLabel ?? null,
					dayName: d.dayLabel ?? r.dayLabel ?? null,
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

/** Group rows by calendar day (local date string key, original order kept). */
export function groupRowsByDay(rows: ScheduleRow[], locale: string): Array<{day: string; rows: ScheduleRow[]}> {
	const byDay = new Map<string, ScheduleRow[]>();
	const UNTIMED = '__untimed__';
	for (const row of rows) {
		const key = row.start
			? new Date(row.start).toLocaleDateString(locale, {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
			  })
			: UNTIMED;
		if (!byDay.has(key)) byDay.set(key, []);
		byDay.get(key)!.push(row);
	}
	return Array.from(byDay.entries()).map(([day, dayRows]) => ({
		day: day === UNTIMED ? '' : day,
		rows: dayRows,
	}));
}

export function formatRowTime(row: ScheduleRow, locale: string): string {
	if (!row.start) return '';
	const fmt = (iso: string) =>
		new Date(iso).toLocaleTimeString(locale, {hour: '2-digit', minute: '2-digit'});
	return row.end ? `${fmt(row.start)} – ${fmt(row.end)}` : fmt(row.start);
}
