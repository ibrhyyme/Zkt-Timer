import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {b} from '../shared';
import {
	buildScheduleRows,
	groupRowsByDay,
	formatRowTime,
	compTimezone,
	collectRooms,
	rowDurationMinutes,
	isRowNow,
} from '../scheduleUtils';
import ZktScheduleTimeline from '../ZktScheduleTimeline';

export default function ZktScheduleTab({detail}: {detail: any}) {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;
	const tz = compTimezone(detail);

	// Both views are rendered and CSS picks one. Deciding in JS would need the
	// viewport, which the server does not have, and the schedule would flip
	// layout after hydration on every phone.
	const rows = buildScheduleRows(detail, (n) => t('round_n', {n}), t('round_final'));
	const days = groupRowsByDay(rows, locale, tz);
	const rooms = collectRooms(rows);
	// One hall (or none named) means the room says nothing: no legend, no badge.
	const showRooms = rooms.length > 1;
	// Untimed blocks cannot be placed on a grid; the list below covers them.
	const hasTimedRows = rows.some((r) => r.start);

	// The clock only exists after mount, for the same hydration reason.
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 30000);
		return () => window.clearInterval(id);
	}, []);

	// Day-split competition: every competitor attends exactly one of these days,
	// so the schedule is read differently and has to say so before it is read.
	// Which of these days is the viewer's own is answered on "my competitions",
	// where the federation returns the viewer's accepted day; the public detail
	// payload has no viewer identity to match on.
	const compDays: Array<{position: number; label: string; date?: string; named?: boolean}> =
		detail.days || [];
	// A day the organizer did not name is called by its own date, and every day
	// heading here already IS that date. Appending it would read "3 Temmuz
	// Perşembe · 3 Tem Per".
	const daysAreNamed = compDays.some((d) => d.named);

	if (rows.length === 0) {
		return <div className={b('empty')}>{t('no_schedule_yet')}</div>;
	}

	const dayNameOf = (dayRows: any[]) => {
		if (!daysAreNamed) return null;
		return dayRows.find((r) => r.dayName)?.dayName ?? null;
	};

	return (
		<div className={b('schedule-tab')}>
			{compDays.length >= 2 && (
				<div className={b('day-split-note')}>
					<strong>{t('day_split_title', {count: compDays.length})}</strong>
					<div className={b('day-split-days')}>
						{compDays.map((d) => (
							<span key={d.position} className={b('day-split-day')}>
								{d.label}
								{d.date && d.named
									? `: ${new Date(d.date).toLocaleDateString(locale, {
											day: 'numeric',
											month: 'long',
										})}`
									: ''}
							</span>
						))}
					</div>
					<p className={b('day-split-text')}>{t('day_split_note')}</p>
				</div>
			)}

			{/* Room colours mean nothing on their own, and a printout or a greyscale
			    screen loses them entirely; the legend names them once. */}
			{showRooms && (
				<div className={b('schedule-legend')}>
					{rooms.map((room) => (
						<span key={room.name} className={b('schedule-legend-item')}>
							<i
								className={b('schedule-legend-dot')}
								style={room.color ? {background: room.color} : undefined}
							/>
							{room.name}
						</span>
					))}
				</div>
			)}

			{/* The grid is the programme on every screen, phone included — the
			    federation's own schedule reads that way and this has to match it. */}
			<ZktScheduleTimeline
				rows={rows}
				locale={locale}
				timezone={tz}
				labels={{now: t('schedule_now')}}
			/>

			{/* A block with no time cannot be placed on the grid, so it is listed
			    underneath rather than dropped. Empty on a finished schedule. */}
			<div className={b('schedule-loose')}>
				{days
					.filter(({day}) => !day)
					.map(({day, rows: dayRows}) => (
					<div key="untimed" className={b('schedule-day')}>
						<h3 className={b('schedule-day-title')}>{t('schedule_untimed')}</h3>
						<div className={b('schedule-rows')}>
							{dayRows.map((row) => {
								const live = now !== null && isRowNow(row, now);
								const minutes = rowDurationMinutes(row);
								return (
									<div
										key={row.id}
										className={b('schedule-item', {round: row.isRound, live})}
										style={
											showRooms && row.roomColor
												? {borderLeftColor: row.roomColor}
												: undefined
										}
									>
										<div className={b('schedule-item-head')}>
											<span className={b('schedule-item-time')}>
												{formatRowTime(row, locale, tz) || '—'}
											</span>
											{live && <span className={b('schedule-item-now')}>{t('schedule_now')}</span>}
											{minutes > 0 && (
												<span className={b('schedule-item-duration')}>
													{t('schedule_minutes', {count: minutes})}
												</span>
											)}
										</div>
										<div className={b('schedule-item-body')}>
											<span className={b('schedule-item-title')}>
												{row.eventId && (
													<span
														className={`cubing-icon event-${row.eventId}`}
														style={{marginRight: 6}}
													/>
												)}
												{row.title}
												{row.dayLabel && (
													<span className={b('schedule-item-day')}> · {row.dayLabel}</span>
												)}
											</span>
											{showRooms && row.roomName && (
												<span
													className={b('schedule-item-room')}
													style={
														row.roomColor
															? {
																	borderColor: row.roomColor,
																	color: row.roomColor,
																}
															: undefined
													}
												>
													{row.roomName}
												</span>
											)}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
