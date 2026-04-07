import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {CalendarBlank} from 'phosphor-react';
import {b, I18N_LOCALE_MAP, formatTime, formatDayHeader, parseActivityCodeParts} from '../shared';

interface Props {
	schedule: any[];
	competitionId: string;
}

export default function WcaLiveSchedule({schedule, competitionId}: Props) {
	const {t, i18n} = useTranslation();
	const history = useHistory();
	const locale = I18N_LOCALE_MAP[i18n.language] || i18n.language;

	// Tum activity'leri toparla, gun bazli grupla
	const days = useMemo(() => {
		const dayMap = new Map<string, any[]>();
		if (!Array.isArray(schedule)) return [];
		for (const venue of schedule) {
			if (!venue) continue;
			for (const room of venue.rooms || []) {
				for (const activity of room.activities || []) {
					if (!activity.startTime) continue;
					const date = activity.startTime.substring(0, 10);
					if (!dayMap.has(date)) dayMap.set(date, []);
					dayMap.get(date)!.push({
						...activity,
						roomName: room.name,
						roomColor: room.color,
					});
				}
			}
		}
		// Tarihe gore sirala
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
			history.push(`/community/competitions/${competitionId}/wca-live/${parsed.eventId}/${parsed.roundNumber}`);
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
								className={b('wca-live-schedule-card', {clickable: !!parseActivityCodeParts(a.activityCode)})}
								onClick={() => handleActivityClick(a.activityCode)}
							>
								<div className={b('wca-live-schedule-card-name')}>{a.name}</div>
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
