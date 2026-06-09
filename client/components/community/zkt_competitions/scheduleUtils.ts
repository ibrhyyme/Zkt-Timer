import {getEventName} from './shared';

export interface ScheduleRow {
	id: string;
	title: string;
	start: string | null; // ISO
	end: string | null;
	isRound: boolean;
	eventId?: string;
	roundNumber?: number;
}

/**
 * Merge custom schedule items with round rows derived from group times into a
 * single chronological list. Round rows span min(group start) → max(group end).
 * Rows without any time sort to the end (so untimed rounds still show up).
 */
export function buildScheduleRows(detail: any, roundLabel: (n: number) => string): ScheduleRow[] {
	const rows: ScheduleRow[] = [];

	for (const item of detail.schedule_items || []) {
		rows.push({
			id: item.id,
			title: item.title,
			start: item.start_time || null,
			end: item.end_time || null,
			isRound: false,
		});
	}

	for (const ev of detail.events || []) {
		for (const r of ev.rounds || []) {
			const timed = (r.groups || []).filter((g: any) => g.start_time);
			let start: string | null = null;
			let end: string | null = null;
			if (timed.length > 0) {
				start = timed.reduce(
					(min: string, g: any) => (g.start_time < min ? g.start_time : min),
					timed[0].start_time
				);
				end = timed.reduce((max: string | null, g: any) => {
					const e = g.end_time || g.start_time;
					return max === null || e > max ? e : max;
				}, null as string | null);
			}
			rows.push({
				id: r.id,
				title: `${getEventName(ev.event_id)} — ${roundLabel(r.round_number)}`,
				start,
				end,
				isRound: true,
				eventId: ev.event_id,
				roundNumber: r.round_number,
			});
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
