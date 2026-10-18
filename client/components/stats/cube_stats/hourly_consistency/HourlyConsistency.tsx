import React, {useContext, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './HourlyConsistency.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getSolveCountByHour, getStandardDeviation} from '../../../../db/solves/stats/hourly';
import {getTimeString} from '../../../../util/time';
import {formatInteger} from '../../../../util/locale_format';
import {labelStride} from '../../../../util/chart_axis';

const b = block('hourly-consistency');

const AXIS_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 23];

export default function HourlyConsistency() {
	const {t, i18n} = useTranslation();
	const language = i18n.language;
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const {hours, peakHour, peakCount, avgPerActiveHour, total} = useMemo(
		() => getSolveCountByHour(filterOptions),
		[filterOptions, solveUpdate]
	);

	// Width of the bar area, for the label stride below. 0 until measured (and on the server),
	// which labels every bar as before. Re-armed when the chart appears after the empty state.
	const hasChart = total > 0;
	const chartRef = useRef<HTMLDivElement>(null);
	const [chartWidth, setChartWidth] = useState(0);
	useEffect(() => {
		const el = chartRef.current;
		if (!el || typeof ResizeObserver === 'undefined') return;
		const ro = new ResizeObserver(() => setChartWidth(el.clientWidth));
		ro.observe(el);
		setChartWidth(el.clientWidth);
		return () => ro.disconnect();
	}, [hasChart]);

	const stdDev = useMemo(() => getStandardDeviation(filterOptions, 100), [filterOptions, solveUpdate]);

	const max = Math.max(...hours, 1);

	// 24 counts over a phone-wide chart ran into each other: label every n-th bar, the rule the
	// distribution chart uses (2.7-f). The mono font at 0.65rem is about 6 px a character.
	const numLabels = hours.map((h) => formatInteger(h, language));
	const stride = labelStride(numLabels, chartWidth / 24, 6, 4);

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
						value: formatInteger(peakCount, language),
					})}
					{/* The mean sits here, in the dashed line's colour, not on the line: at the
					    right end of the chart it covered the last bars' counts */}
					<span className={b('mean')}>
						· {t('stats.hourly.avg_per_hour', {value: formatInteger(avgPerActiveHour, language)})}
					</span>
				</span>
			</div>
			<div ref={chartRef} className={b('chart')}>
				<div
					className={b('mean-line')}
					style={{bottom: `${(avgPerActiveHour / max) * 100}%`}}
				/>
				{hours.map((h, i) => (
					<div
						key={i}
						className={b('bar', {peak: i === peakHour && h > 0})}
						style={{height: `${Math.max(2, (h / max) * 100)}%`}}
						title={`${String(i).padStart(2, '0')}:00 · ${h}`}
					>
						{h > 0 && i % stride === 0 && <span className={b('num')}>{numLabels[i]}</span>}
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
