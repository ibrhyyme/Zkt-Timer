import React, {useEffect, useMemo, useState} from 'react';
import {b} from './shared';
import {ScheduleRow, hourFloatInTz, formatClock, dateKeyInTz, isRowNow} from './scheduleUtils';

// The competition programme as a WCA-style time grid: one column per day, an
// hour rail down the left, blocks placed and sized by their real times. This
// mirrors the federation site's own schedule (FullCalendar timeGrid) without
// pulling in that library — ~300KB and a second theming system for one tab, and
// its grid does not survive a phone.

/** Hour height lives in CSS so the phone can give the grid more room. */
const HOUR_VAR = 'var(--zkt-hour-h)';
const px = (hours: number) => `calc(${HOUR_VAR} * ${hours})`;
/** Placeholder span for a block whose end the organizer left open. */
const FALLBACK_DURATION_HOURS = 0.5;
/** Below this a block cannot fit title and time on separate lines. */
const COMPACT_HOURS = 0.6;

// Federation colour rule, kept identical so the two schedules read the same:
// event rounds take their room's colour (a default teal when the organizer
// defined no rooms), everything else — check-in, lunch, the ceremony — is grey.
const DEFAULT_ROUND_COLOR = '#10a3b8';
const OTHER_GREY = '#6b7280';

/** Black or white, whichever stays readable on `hex`. */
function textColorFor(hex: string): string {
	const c = hex.replace('#', '');
	if (c.length < 6) return '#fff';
	const r = parseInt(c.slice(0, 2), 16);
	const g = parseInt(c.slice(2, 4), 16);
	const bl = parseInt(c.slice(4, 6), 16);
	return (0.299 * r + 0.587 * g + 0.114 * bl) / 255 > 0.6 ? '#111' : '#fff';
}

interface PlacedRow {
	row: ScheduleRow;
	startHour: number;
	endHour: number;
	/** Lane within its day column, for blocks that overlap in time. */
	lane: number;
	laneCount: number;
}

interface TimelineDay {
	key: string;
	heading: string;
	subHeading: string | null;
	placed: PlacedRow[];
}

/**
 * Spread blocks that overlap in time across side-by-side lanes, so a day
 * running two things at once shows both instead of stacking one on the other.
 * Input must be sorted by start.
 */
function assignLanes(rows: Array<{row: ScheduleRow; startHour: number; endHour: number}>): PlacedRow[] {
	const placed: PlacedRow[] = [];
	let cluster: PlacedRow[] = [];
	let clusterEnd = -Infinity;
	const laneEnds: number[] = [];

	const flush = () => {
		if (cluster.length === 0) return;
		const count = Math.max(1, ...cluster.map((p) => p.lane + 1));
		for (const p of cluster) p.laneCount = count;
		placed.push(...cluster);
		cluster = [];
		laneEnds.length = 0;
		clusterEnd = -Infinity;
	};

	for (const item of rows) {
		if (item.startHour >= clusterEnd) flush();
		let lane = laneEnds.findIndex((end) => end <= item.startHour);
		if (lane === -1) lane = laneEnds.length;
		laneEnds[lane] = item.endHour;
		clusterEnd = Math.max(clusterEnd, item.endHour);
		cluster.push({...item, lane, laneCount: 1});
	}
	flush();
	return placed;
}

interface Props {
	rows: ScheduleRow[];
	locale: string;
	timezone?: string;
	labels: {now: string};
}

export default function ZktScheduleTimeline({rows, locale, timezone, labels}: Props) {
	const {days, minHour, maxHour} = useMemo(() => {
		const timed = rows.filter((r) => r.start);
		const byDay = new Map<string, ScheduleRow[]>();
		for (const row of timed) {
			const key = dateKeyInTz(row.start!, timezone);
			if (!byDay.has(key)) byDay.set(key, []);
			byDay.get(key)!.push(row);
		}

		// One rail for the whole grid, so a block at 10:00 sits at the same height
		// in every column — which is the entire point of putting days side by side.
		let min = 24;
		let max = 0;
		const built: TimelineDay[] = [...byDay.entries()]
			.sort((a, c) => (a[1][0].start! < c[1][0].start! ? -1 : 1))
			.map(([key, dayRows]) => {
				const items = dayRows
					.map((row) => {
						const startHour = hourFloatInTz(row.start!, timezone);
						const rawEnd = row.end
							? hourFloatInTz(row.end, timezone)
							: startHour + FALLBACK_DURATION_HOURS;
						// An end past midnight wraps to a small hour and would draw
						// upwards; keep the block on the day it started.
						const endHour =
							rawEnd > startHour ? rawEnd : Math.min(24, startHour + FALLBACK_DURATION_HOURS);
						min = Math.min(min, startHour);
						max = Math.max(max, endHour);
						return {row, startHour, endHour};
					})
					.sort((a, c) => a.startHour - c.startHour);

				const date = new Date(dayRows[0].start!);
				const opts = timezone ? {timeZone: timezone} : {};
				return {
					key,
					heading: date.toLocaleDateString(locale, {
						...opts,
						day: '2-digit',
						month: '2-digit',
					}),
					subHeading: date.toLocaleDateString(locale, {...opts, weekday: 'short'}),
					placed: assignLanes(items),
				};
			});

		return {
			days: built,
			minHour: built.length ? Math.max(0, Math.floor(min)) : 0,
			maxHour: built.length ? Math.min(24, Math.ceil(max)) : 0,
		};
	}, [rows, locale, timezone]);

	// The clock only exists after mount: a server-rendered marker would hydrate
	// against a different minute.
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 30000);
		return () => window.clearInterval(id);
	}, []);

	if (days.length === 0) return null;

	// Half-hour lines, like the federation's grid.
	const slots: number[] = [];
	for (let h = minHour; h <= maxHour; h += 0.5) slots.push(h);

	const nowKey = now !== null ? dateKeyInTz(new Date(now).toISOString(), timezone) : null;
	const nowHour = now !== null ? hourFloatInTz(new Date(now).toISOString(), timezone) : 0;
	const nowVisible = nowHour >= minHour && nowHour <= maxHour;

	return (
		<div className={b('timeline')}>
			<div className={b('timeline-scroll')}>
				<div className={b('timeline-grid')} style={{minWidth: `${120 + days.length * 150}px`}}>
					<div className={b('timeline-head')}>
						<span className={b('timeline-head-rail')} />
						{days.map((day) => (
							<span key={day.key} className={b('timeline-head-day')}>
								{day.heading}
								{day.subHeading && (
									<span className={b('timeline-head-weekday')}> {day.subHeading}</span>
								)}
							</span>
						))}
					</div>

					<div className={b('timeline-body')} style={{height: px(maxHour - minHour)}}>
						<div className={b('timeline-rail')}>
							{slots.map((h) => (
								<span
									key={h}
									className={b('timeline-rail-hour', {half: h % 1 !== 0})}
									style={{top: px(h - minHour)}}
								>
									{`${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`}
								</span>
							))}
						</div>

						<div className={b('timeline-lines')}>
							{slots.map((h) => (
								<span
									key={h}
									className={b('timeline-line', {half: h % 1 !== 0})}
									style={{top: px(h - minHour)}}
								/>
							))}
						</div>

						{days.map((day) => (
							<div key={day.key} className={b('timeline-column')}>
								{day.placed.map((placed) => {
									const {row} = placed;
									// Rounds take the room colour (teal by default); the
									// organizer's own items are grey. Same rule as the
									// federation's own schedule.
									const color = row.isRound ? row.roomColor || DEFAULT_ROUND_COLOR : OTHER_GREY;
									const fg = textColorFor(color);
									const live = now !== null && isRowNow(row, now);
									const spanHours = placed.endHour - placed.startHour;
									const widthPct = 100 / placed.laneCount;
									return (
										<article
											key={row.id}
											className={b('timeline-block', {
												live,
												compact: spanHours < COMPACT_HOURS,
											})}
											style={{
												top: px(placed.startHour - minHour),
												height: `calc(${px(spanHours)} - 3px)`,
												left: `${placed.lane * widthPct}%`,
												width: `calc(${widthPct}% - 4px)`,
												background: color,
												color: fg,
											}}
											title={row.title}
										>
											<span className={b('timeline-block-title')}>
												{row.eventId && (
													<span className={`cubing-icon event-${row.eventId}`} />
												)}
												{row.title}
												{row.dayLabel && <> · {row.dayLabel}</>}
											</span>
											<span className={b('timeline-block-time')}>
												{formatClock(row.start!, locale, timezone)}
												{row.end && ` - ${formatClock(row.end, locale, timezone)}`}
											</span>
										</article>
									);
								})}
							</div>
						))}

						{now !== null && nowVisible && days.some((d) => d.key === nowKey) && (
							<div className={b('timeline-now')} style={{top: px(nowHour - minHour)}}>
								<span className={b('timeline-now-label')}>{labels.now}</span>
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
