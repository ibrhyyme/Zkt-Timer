import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './HourlyConsistency.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getSolveCountByHour, getStandardDeviation} from '../../../../db/solves/stats/hourly';
import {getTimeString} from '../../../../util/time';

const b = block('hourly-consistency');

const AXIS_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 23];

export default function HourlyConsistency() {
	const {t} = useTranslation();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const {hours, peakHour, peakCount, avgPerActiveHour, total} = useMemo(
		() => getSolveCountByHour(filterOptions),
		[filterOptions, solveUpdate]
	);

	const stdDev = useMemo(() => getStandardDeviation(filterOptions, 100), [filterOptions, solveUpdate]);

	const max = Math.max(...hours, 1);

	if (total === 0) {
		return <div className={b('empty')}>{t('stats.hourly.empty')}</div>;
	}

	return (
		<div className={b()}>
			<div className={b('band')}>
				{stdDev != null && (
					<>
						<strong className={b('std')}>±{getTimeString(stdDev)}</strong>
						<span className={b('label')}>{t('stats.hourly.std_dev')}</span>
					</>
				)}
				<span className={b('peak')}>
					{t('stats.hourly.peak', {
						hour: String(peakHour).padStart(2, '0') + ':00',
						value: peakCount,
					})}
				</span>
			</div>
			<div className={b('chart')}>
				<div
					className={b('mean-line')}
					style={{bottom: `${(avgPerActiveHour / max) * 100}%`}}
				>
					<span className={b('mean-label')}>
						{t('stats.hourly.avg_per_hour', {value: avgPerActiveHour})}
					</span>
				</div>
				{hours.map((h, i) => (
					<div
						key={i}
						className={b('bar', {peak: i === peakHour && h > 0})}
						style={{height: `${Math.max(2, (h / max) * 100)}%`}}
						title={`${String(i).padStart(2, '0')}:00 · ${h}`}
					>
						{h > 0 && <span className={b('num')}>{h}</span>}
					</div>
				))}
			</div>
			<div className={b('axis')}>
				{AXIS_HOURS.map((h) => (
					<span key={h} className={b('axis-tick')}>
						{String(h).padStart(2, '0')}
					</span>
				))}
			</div>
		</div>
	);
}
