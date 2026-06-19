import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {CalendarBlank} from 'phosphor-react';
import {b, I18N_LOCALE_MAP, formatTime, formatDayHeader, parseActivityCodeParts, EventIcon} from '../shared';

interface Props {
	schedule: any[];
	competitionId: string;
}

export default function WcaLiveSchedule({schedule, competitionId}: Props) {
	const {t, i18n} = useTranslation();
	const history = useHistory();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;

	// Gather all activities, group by day (competition rounds only)
	const days = useMemo(() => {
		const dayMap = new Map<string, any[]>();
		if (!Array.isArray(schedule)) return [];
		for (const venue of schedule) {
			if (!venue) continue;
			for (const room of venue.rooms || []) {
				for (const activity of room.activities || []) {
					if (!activity.startTime) continue;
					// Show only competition rounds (filter out check-in, tutorial, lunch, etc.)
					const parsed = parseActivityCodeParts(activity.activityCode);
					if (!parsed) continue;
					const date = activity.startTime.substring(0, 10);
					if (!dayMap.has(date)) dayMap.set(date, []);
					dayMap.get(date)!.push({
						...activity,
						roomName: room.name,
						roomColor: room.color,
						eventId: parsed.eventId,
					});
				}
			}
		}
		// Sort by date
		return Array.from(dayMap.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([date, activities]) => ({
				date,
				activities: activities.sort((a, b) => a.startTime.localeCompare(b.startTime)),
			}));
	}, [schedule]);

	function handleActivityClick(activityCode: string) {
		const parsed = parseActivityCodeParts(activityCode);
		if (parsed) {
			history.push(`/competitions/${competitionId}/wca-live/${parsed.eventId}/${parsed.roundNumber}`);
		}
	}

	if (days.length === 0) return null;

	return (
		<div className={b('wca-live-schedule')}>
			<h3 className={b('wca-live-section-title')}>{t('my_schedule.wca_live_schedule')}</h3>
			{days.map((day) => (
				<div key={day.date} className={b('wca-live-schedule-day')}>
					<div className={b('wca-live-schedule-day-header')}>
						<CalendarBlank size={16} />
						<span>{formatDayHeader(day.date, locale)}</span>
					</div>
					<div className={b('wca-live-schedule-grid')}>
						{day.activities.map((a: any) => (
							<div
								key={a.activityId}
								className={b('wca-live-schedule-card', {clickable: true})}
								onClick={() => handleActivityClick(a.activityCode)}
							>
								<div className={b('wca-live-schedule-card-name')}>
									{a.eventId && <EventIcon eventId={a.eventId} size={16} />}
									<span>{a.name}</span>
								</div>
								<div className={b('wca-live-schedule-card-time')}>
									{a.roomColor && (
										<span className={b('wca-live-schedule-room-dot')} style={{backgroundColor: a.roomColor}} />
									)}
									{formatTime(a.startTime, locale)} - {formatTime(a.endTime, locale)}
								</div>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
