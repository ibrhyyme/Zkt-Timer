import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useCompetitionData} from './CompetitionLoader';
import {useWcaLiveOverview} from './useLiveResults';
import {I18N_LOCALE_MAP} from './shared';
// The programme is drawn by the ZKT competition timeline, so this view pulls in
// that stylesheet too — it is not loaded by the WCA-view page otherwise.
import '../zkt_competitions/ZktCompetitions.scss';
import ZktScheduleTimeline from '../zkt_competitions/ZktScheduleTimeline';
import {
	ScheduleRow,
	groupRowsByDay,
	formatRowTime,
	collectRooms,
	rowDurationMinutes,
	isRowNow,
} from '../zkt_competitions/scheduleUtils';
import {b as zktB} from '../zkt_competitions/shared';

/**
 * The competition's whole programme, on the WCA-shaped competition page.
 *
 * The rounds and the organizer's own items (check-in, lunch, the ceremony) come
 * from the live overview's schedule — the same block the WCA Live welcome
 * screen reads — rather than from `detail.schedule`, which holds only the
 * viewer's own assignments.
 */
export default function CompetitionSchedule() {
	const {t, i18n} = useTranslation();
	const {detail} = useCompetitionData();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;
	const {data: overview, loading} = useWcaLiveOverview(
		detail?.competitionId || '',
		!!detail?.wcaLiveCompId
	);

	// Clock only after mount: a server-rendered "now" would hydrate against a
	// different minute.
	const [now, setNow] = useState<number | null>(null);
	useEffect(() => {
		setNow(Date.now());
		const id = window.setInterval(() => setNow(Date.now()), 30000);
		return () => window.clearInterval(id);
	}, []);

	const rows: ScheduleRow[] = useMemo(() => {
		const out: ScheduleRow[] = [];
		for (const venue of overview?.schedule || []) {
			for (const room of venue?.rooms || []) {
				for (const activity of room?.activities || []) {
					if (!activity?.startTime) continue;
					// An activity code means it is an event round; the organizer's own
					// items carry none and are drawn as plain blocks.
					const code: string = activity.activityCode || '';
					const eventId = code ? code.split('-')[0] : undefined;
					out.push({
						id: String(activity.activityId),
						title: activity.name,
						start: activity.startTime,
						end: activity.endTime || null,
						isRound: !!code,
						eventId,
						dayLabel: activity.dayLabel ?? null,
						dayName: activity.dayLabel ?? null,
						roomName: room.name ?? null,
						roomColor: room.color ?? null,
					});
				}
			}
		}
		return out.sort((a, c) => String(a.start).localeCompare(String(c.start)));
	}, [overview?.schedule]);

	const rooms = collectRooms(rows);
	const showRooms = rooms.length > 1;
	// The venue's own zone is not published on this payload, so times read in the
	// viewer's zone — correct for everyone standing at the venue.
	const days = groupRowsByDay(rows, locale);

	if (loading && rows.length === 0) {
		return <div className={zktB('empty')}>{t('my_schedule.loading')}</div>;
	}
	if (rows.length === 0) {
		return <div className={zktB('empty')}>{t('zkt_comp.no_schedule_yet')}</div>;
	}

	return (
		<div className={zktB('schedule-tab')}>
			{showRooms && (
				<div className={zktB('schedule-legend')}>
					{rooms.map((room) => (
						<span key={room.name} className={zktB('schedule-legend-item')}>
							<i
								className={zktB('schedule-legend-dot')}
								style={room.color ? {background: room.color} : undefined}
							/>
							{room.name}
						</span>
					))}
				</div>
			)}

			<ZktScheduleTimeline
				rows={rows}
				locale={locale}
				labels={{now: t('zkt_comp.schedule_now')}}
			/>

			{/* Blocks with no time cannot be placed on the grid; listed here so
			    they are not simply dropped. */}
			<div className={zktB('schedule-loose')}>
				{days
					.filter(({day}) => !day)
					.map(({rows: dayRows}) => (
					<div key="untimed" className={zktB('schedule-day')}>
						<h3 className={zktB('schedule-day-title')}>
							{t('zkt_comp.schedule_untimed')}
						</h3>
						<div className={zktB('schedule-rows')}>
							{dayRows.map((row) => {
								const live = now !== null && isRowNow(row, now);
								const minutes = rowDurationMinutes(row);
								return (
									<div
										key={row.id}
										className={zktB('schedule-item', {round: row.isRound, live})}
										style={
											showRooms && row.roomColor
												? {borderLeftColor: row.roomColor}
												: undefined
										}
									>
										<div className={zktB('schedule-item-head')}>
											<span className={zktB('schedule-item-time')}>
												{formatRowTime(row, locale) || '—'}
											</span>
											{live && (
												<span className={zktB('schedule-item-now')}>
													{t('zkt_comp.schedule_now')}
												</span>
											)}
											{minutes > 0 && (
												<span className={zktB('schedule-item-duration')}>
													{t('zkt_comp.schedule_minutes', {count: minutes})}
												</span>
											)}
										</div>
										<div className={zktB('schedule-item-body')}>
											<span className={zktB('schedule-item-title')}>
												{row.eventId && (
													<span
														className={`cubing-icon event-${row.eventId}`}
														style={{marginRight: 6}}
													/>
												)}
												{row.title}
											</span>
											{showRooms && row.roomName && (
												<span
													className={zktB('schedule-item-room')}
													style={
														row.roomColor
															? {borderColor: row.roomColor, color: row.roomColor}
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
