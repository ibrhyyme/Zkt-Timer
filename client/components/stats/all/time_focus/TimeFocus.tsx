import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import dayjs from 'dayjs';
import './TimeFocus.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getTotalSolveTime} from '../../../../db/solves/stats/count';
import {getSolveCountByHour} from '../../../../db/solves/stats/hourly';
import {getSessionCount, getBestDayOfWeek} from '../../../../db/solves/stats/extras';
import {getTimeString} from '../../../../util/time';

const b = block('time-focus');

export default function TimeFocus() {
	const {t} = useTranslation();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const totalTime = useMemo(() => getTotalSolveTime(filterOptions), [filterOptions, solveUpdate]);
	const hourly = useMemo(() => getSolveCountByHour(filterOptions), [filterOptions, solveUpdate]);
	const sessions = useMemo(() => getSessionCount(filterOptions), [filterOptions, solveUpdate]);
	const bestDow = useMemo(() => getBestDayOfWeek(filterOptions), [filterOptions, solveUpdate]);

	const peakHourLabel = hourly.peakCount > 0
		? `${String(hourly.peakHour).padStart(2, '0')}:00–${String((hourly.peakHour + 1) % 24).padStart(2, '0')}:00`
		: null;

	const bestDayLabel = bestDow.bestDayIdx != null
		? dayjs().day(bestDow.bestDayIdx).format('dddd')
		: null;

	const avgSolvesPerSession = sessions > 0 && hourly.total > 0
		? Math.round(hourly.total / sessions)
		: 0;

	return (
		<div className={b()}>
			<div className={b('cell')}>
				<span className={b('label')}>{t('stats.focus.total_time')}</span>
				<span className={b('value')}>{getTimeString(totalTime)}</span>
				<span className={b('sub')}>{t('stats.focus.total_solves_count', {value: hourly.total.toLocaleString()})}</span>
			</div>
			<div className={b('cell')}>
				<span className={b('label')}>{t('stats.focus.peak_hour')}</span>
				<span className={b('value', {accent: !!peakHourLabel})}>
					{peakHourLabel || '—'}
				</span>
				<span className={b('sub')}>
					{peakHourLabel
						? t('stats.focus.peak_hour_sub', {value: hourly.peakCount.toLocaleString()})
						: t('stats.focus.peak_hour_empty')}
				</span>
			</div>
			<div className={b('cell')}>
				<span className={b('label')}>{t('stats.focus.best_day')}</span>
				<span className={b('value', {accent: !!bestDayLabel})}>
					{bestDayLabel || '—'}
				</span>
				<span className={b('sub')}>
					{bestDow.bestAvg != null
						? t('stats.focus.best_day_sub', {time: getTimeString(bestDow.bestAvg)})
						: t('stats.focus.best_day_empty')}
				</span>
			</div>
			<div className={b('cell')}>
				<span className={b('label')}>{t('stats.focus.sessions')}</span>
				<span className={b('value')}>{sessions.toLocaleString()}</span>
				<span className={b('sub')}>
					{avgSolvesPerSession > 0
						? t('stats.focus.sessions_sub', {avg: avgSolvesPerSession})
						: '—'}
				</span>
			</div>
		</div>
	);
}
