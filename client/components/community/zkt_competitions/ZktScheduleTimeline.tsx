import React, {useEffect, useMemo, useState} from 'react';
import {b} from './shared';
import {
	ScheduleRow,
	hourFloatInTz,
	formatClock,
	formatDayHeading,
	dateKeyInTz,
	isRowNow,
} from './scheduleUtils';

// Desktop timetable: an hour rail on the left and one column per room, blocks
// placed and sized by their real times. The federation site draws the same
// program with FullCalendar; that library is not worth ~300KB and a second
// theming system here, and its time grid is unusable on the phones most people
// read the schedule on, so the mobile view stays a list (ZktScheduleTab picks).

/** Rail height of one hour. Everything else is derived from this. */
const PX_PER_HOUR = 80;
/** Below this a block cannot show its title, so it is padded out. */
const MIN_BLOCK_PX = 26;
/** Gap left between a padded block and the one after it. */
const BLOCK_GAP_PX = 3;
/** Placeholder for an untimed block, which has no duration to draw. */
const FALLBACK_DURATION_HOURS = 0.5;

interface PlacedRow {
	row: ScheduleRow;
	startHour: number;
	endHour: number;
	/** Lane index within its room column, for blocks that overlap in time. */
	lane: number;
	laneCount: number;
	/**
	 * Start of the next block in the same lane. A run of short rounds (20 min
	 * finals back to back) is drawn shorter than MIN_BLOCK_PX, and padding each
	 * one to the minimum made it cover the next; the padding stops here instead.
	 */
	nextStartHour: number;
}

/** Locale-correct hour label, so the rail and the blocks agree on 12h vs 24h. */
function hourLabel(hour: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		timeZone: 'UTC',
		hour: '2-digit',
		minute: '2-digit',
	}).format(new Date(Date.UTC(1970, 0, 1, hour, 0)));
}

interface TimelineDay {
	key: string;
	heading: string;
	/** Column order; a single unnamed hall produces one column with no header. */
	rooms: Array<{name: string | null; color: string | null}>;
	/** Placed blocks per room column, indexed alongside `rooms`. */
	columns: PlacedRow[][];
	minHour: number;
	maxHour: number;
}

/**
 * Spread blocks that overlap in time across side-by-side lanes, so a room
 * running two things at once shows both instead of stacking one on the other.
 * Blocks are assumed sorted by start.
 */
function assignLanes(rows: Array<{row: ScheduleRow; startHour: number; endHour: number}>): PlacedRow[] {
	const placed: PlacedRow[] = [];
	// A cluster is a run of blocks connected by overlap; every block in it shares
	// the same lane count so the columns line up.
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

	// Last block placed in each lane, so it can learn where the next one starts.
	const lastInLane: Array<PlacedRow | undefined> = [];

	for (const item of rows) {
		if (item.startHour >= clusterEnd) flush();
		// First lane whose last block already ended; a new one when all are busy.
		let lane = laneEnds.findIndex((end) => end <= item.startHour);
		if (lane === -1) lane = laneEnds.length;
		laneEnds[lane] = item.endHour;
		clusterEnd = Math.max(clusterEnd, item.endHour);
		const entry: PlacedRow = {...item, lane, laneCount: 1, nextStartHour: Infinity};
		const previous = lastInLane[lane];
		if (previous) previous.nextStartHour = item.startHour;
		lastInLane[lane] = entry;
		cluster.push(entry);
	}
	flush();
	return placed;
}

function buildDays(rows: ScheduleRow[], locale: string, tz?: string): TimelineDay[] {
	const timed = rows.filter((r) => r.start);
	const byDay = new Map<string, ScheduleRow[]>();
	for (const row of timed) {
		const key = dateKeyInTz(row.start!, tz);
		if (!byDay.has(key)) byDay.set(key, []);
		byDay.get(key)!.push(row);
	}

	return [...byDay.entries()]
		.sort((a, c) => (a[1][0].start! < c[1][0].start! ? -1 : 1))
		.map(([key, dayRows]) => {
			// Room columns in first-appearance order, which is the organizer's own
			// order because the payload arrives sorted by room position.
			const roomOrder: Array<{name: string | null; color: string | null}> = [];
			const indexOfRoom = (row: ScheduleRow) => {
				const name = row.roomName ?? null;
				const found = roomOrder.findIndex((r) => r.name === name);
				if (found !== -1) return found;
				roomOrder.push({name, color: row.roomColor ?? null});
				return roomOrder.length - 1;
			};

			const buckets: Array<Array<{row: ScheduleRow; startHour: number; endHour: number}>> = [];
			let minHour = 24;
			let maxHour = 0;
			for (const row of dayRows) {
				const startHour = hourFloatInTz(row.start!, tz);
				// An end past midnight wraps to a small hour and would draw upwards;
				// clamping to the day's end keeps the block on the rail it started on.
				const rawEnd = row.end ? hourFloatInTz(row.end, tz) : startHour + FALLBACK_DURATION_HOURS;
				const endHour = rawEnd > startHour ? rawEnd : Math.min(24, startHour + FALLBACK_DURATION_HOURS);
				minHour = Math.min(minHour, startHour);
				maxHour = Math.max(maxHour, endHour);
				const idx = indexOfRoom(row);
				if (!buckets[idx]) buckets[idx] = [];
				buckets[idx].push({row, startHour, endHour});
			}

			for (const bucket of buckets) bucket.sort((a, c) => a.startHour - c.startHour);

			return {
				key,
				heading: formatDayHeading(dayRows[0].start!, locale, tz),
				rooms: roomOrder,
				columns: roomOrder.map((_, i) => assignLanes(buckets[i] ?? [])),
				// Whole hours so the rail labels land on the lines.
				minHour: Math.max(0, Math.floor(minHour)),
				maxHour: Math.min(24, Math.ceil(maxHour)),
			};
		});
}

interface Props {
	rows: ScheduleRow[];
	locale: string;
	timezone?: string;
	/** Day name of the row's own chain ("A Günü"), appended to the heading. */
	dayNameOf?: (rows: ScheduleRow[]) => string | null;
	/**
	 * False on a single-hall competition, where the room name is on every block
	 * and its colour would override the round/custom accent for no information.
	 */
	showRooms: boolean;
	labels: {now: string};
}

export default function ZktScheduleTimeline({
	rows,
	locale,
	timezone,
	dayNameOf,
	showRooms,
	labels,
}: Props) {
	const days = useMemo(() => buildDays(rows, locale, timezone), [rows, locale, timezone]);

	// Server-rendered markup cannot contain a clock: it would hydrate against a
	// different minute. The marker appears after mount and then ticks.
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 30000);
		return () => window.clearInterval(id);
	}, []);

	if (days.length === 0) return null;

	return (
		<div className={b('timeline')}>
			{days.map((day) => {
				const hours: number[] = [];
				for (let h = day.minHour; h <= day.maxHour; h++) hours.push(h);
				const bodyHeight = (day.maxHour - day.minHour) * PX_PER_HOUR;
				// With one room its name is above every block and tells nobody
				// anything; it only earns the space once there is more than one.
				const hasRoomHeaders = showRooms && day.rooms.length > 1;
				const dayName = dayNameOf
					? dayNameOf(day.columns.flatMap((c) => c.map((p) => p.row)))
					: null;

				// The marker only belongs on the day it is actually on, and only while
				// the clock sits inside the drawn window.
				const nowKey = now !== null ? dateKeyInTz(new Date(now).toISOString(), timezone) : null;
				const nowHour =
					now !== null ? hourFloatInTz(new Date(now).toISOString(), timezone) : 0;
				const showNow =
					nowKey === day.key && nowHour >= day.minHour && nowHour <= day.maxHour;

				return (
					<section key={day.key} className={b('timeline-day')}>
						<h3 className={b('timeline-day-title')}>
							{day.heading}
							{dayName && <span className={b('timeline-day-name')}> · {dayName}</span>}
						</h3>

						<div className={b('timeline-grid')}>
							{hasRoomHeaders && (
								<div className={b('timeline-head')}>
									<span className={b('timeline-head-rail')} />
									{day.rooms.map((room, i) => (
										<span
											key={room.name ?? `room-${i}`}
											className={b('timeline-head-room')}
											style={
												room.color
													? {borderBottomColor: room.color}
													: undefined
											}
										>
											{room.name}
										</span>
									))}
								</div>
							)}

							<div className={b('timeline-body')} style={{height: bodyHeight}}>
								<div className={b('timeline-rail')}>
									{hours.map((h) => (
										<span
											key={h}
											className={b('timeline-rail-hour')}
											style={{top: (h - day.minHour) * PX_PER_HOUR}}
										>
											{hourLabel(h, locale)}
										</span>
									))}
								</div>

								<div className={b('timeline-lines')}>
									{hours.map((h) => (
										<span
											key={h}
											className={b('timeline-line')}
											style={{top: (h - day.minHour) * PX_PER_HOUR}}
										/>
									))}
								</div>

								{day.columns.map((column, colIndex) => (
									<div
										key={day.rooms[colIndex]?.name ?? `col-${colIndex}`}
										className={b('timeline-column')}
									>
										{column.map((placed) => {
											const top = (placed.startHour - day.minHour) * PX_PER_HOUR;
											const natural =
												(placed.endHour - placed.startHour) * PX_PER_HOUR - BLOCK_GAP_PX;
											// Pad a too-short block up to the readable minimum, but
											// never past the block that follows it.
											const ceiling =
												placed.nextStartHour === Infinity
													? Infinity
													: (placed.nextStartHour - placed.startHour) * PX_PER_HOUR -
														BLOCK_GAP_PX;
											const height = Math.max(
												1,
												Math.max(natural, Math.min(MIN_BLOCK_PX, ceiling))
											);
											const widthPct = 100 / placed.laneCount;
											const live = now !== null && isRowNow(placed.row, now);
											// Room colour only when rooms mean something here;
											// otherwise the round/custom modifier supplies the
											// accent, which keeps every round the same colour.
											const accent = showRooms ? placed.row.roomColor || null : null;
											return (
												<article
													key={placed.row.id}
													className={b('timeline-block', {
														round: placed.row.isRound,
														live,
														// A short block cannot fit time and title
														// on separate lines.
														compact: height < 52,
													})}
													style={{
														top,
														height,
														left: `${placed.lane * widthPct}%`,
														width: `calc(${widthPct}% - 4px)`,
														...(accent ? {borderLeftColor: accent} : {}),
													}}
													title={placed.row.title}
												>
													<span className={b('timeline-block-time')}>
														{formatClock(placed.row.start!, locale, timezone)}
														{placed.row.end &&
															` – ${formatClock(placed.row.end, locale, timezone)}`}
													</span>
													<span className={b('timeline-block-title')}>
														{placed.row.eventId && (
															<span
																className={`cubing-icon event-${placed.row.eventId}`}
															/>
														)}
														{placed.row.title}
													</span>
													{placed.row.dayLabel && (
														<span className={b('timeline-block-day')}>
															{placed.row.dayLabel}
														</span>
													)}
												</article>
											);
										})}
									</div>
								))}

								{showNow && (
									<div
										className={b('timeline-now')}
										style={{top: (nowHour - day.minHour) * PX_PER_HOUR}}
									>
										<span className={b('timeline-now-label')}>{labels.now}</span>
									</div>
								)}
							</div>
						</div>
					</section>
				);
			})}
		</div>
	);
}
