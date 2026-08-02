import React from 'react';
import {useTranslation} from 'react-i18next';
import {b} from '../shared';
import {buildScheduleRows, groupRowsByDay, formatRowTime} from '../scheduleUtils';

export default function ZktScheduleTab({detail}: {detail: any}) {
	const {t, i18n} = useTranslation('translation', {keyPrefix: 'zkt_comp'});
	const locale = i18n.language === 'tr' ? 'tr-TR' : i18n.language;

	const rows = buildScheduleRows(detail, (n) => t('round_n', {n}), t('round_final'));
	const days = groupRowsByDay(rows, locale);
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
			{days.map(({day, rows: dayRows}) => (
				<div key={day || 'untimed'} className={b('schedule-day')}>
					<h3 className={b('schedule-day-title')}>
						{day || t('schedule_untimed')}
						{/* Only a day with its own name adds anything here; an unnamed day
						    is labelled by the very date this heading already shows. */}
						{daysAreNamed &&
							(() => {
								const name = dayRows.find((r) => r.dayName)?.dayName;
								return name ? <span className={b('schedule-day-name')}> · {name}</span> : null;
							})()}
					</h3>
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
									{row.dayLabel && (
										<span className={b('schedule-item-day')}> · {row.dayLabel}</span>
									)}
								</span>
							</div>
						))}
					</div>
				</div>
			))}
		</div>
	);
}
