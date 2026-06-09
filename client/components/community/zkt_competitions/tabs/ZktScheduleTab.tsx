import React from 'react';
import {useTranslation} from 'react-i18next';
import {b} from '../shared';
import {buildScheduleRows, groupRowsByDay, formatRowTime} from '../scheduleUtils';

export default function ZktScheduleTab({detail}: {detail: any}) {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;

	const rows = buildScheduleRows(detail, (n) => t('round_n', {n}));
	const days = groupRowsByDay(rows, locale);

	if (rows.length === 0) {
		return <div className={b('empty')}>{t('no_schedule_yet')}</div>;
	}

	return (
		<div className={b('schedule-tab')}>
			{days.map(({day, rows: dayRows}) => (
				<div key={day || 'untimed'} className={b('schedule-day')}>
					<h3 className={b('schedule-day-title')}>{day || t('schedule_untimed')}</h3>
					<div className={b('schedule-rows')}>
						{dayRows.map((row) => (
							<div key={row.id} className={b('schedule-item', {round: row.isRound})}>
								<span className={b('schedule-item-time')}>
									{formatRowTime(row, locale) || '—'}
								</span>
								<span className={b('schedule-item-title')}>
									{row.eventId && (
										<span
											className={`cubing-icon event-${row.eventId}`}
											style={{marginRight: 6}}
										/>
									)}
									{row.title}
								</span>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
