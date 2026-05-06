import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './SmartCubeStatsGrid.scss';
import block from '../../../../styles/bem';
import { fetchSolves, FilterSolvesOptions } from '../../../../db/solves/query';
import { useSolveDb } from '../../../../util/hooks/useSolveDb';
import { getTimeString } from '../../../../util/time';
import { getSinglePB } from '../../../../db/solves/stats/solves/single/single_pb';
import { getWorstTime } from '../../../../db/solves/stats/solves/single/single_worst';
import { getAveragePB } from '../../../../db/solves/stats/solves/average/average_pb';
import { getSmartCubeAvgTimes } from '../../../../db/solves/stats/smart_cube_avg_times';
import Empty from '../../../common/empty/Empty';
import CountUp from '../../common/count_up/CountUp';

const b = block('smart-cube-stats-grid');

interface Props {
	filterOptions: FilterSolvesOptions;
}

function formatTotalDuration(totalSeconds: number, t: (k: string) => string): string {
	if (totalSeconds <= 0) return '–';
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = Math.floor(totalSeconds % 60);

	if (hours > 0) {
		return `${hours}${t('sessions.hours_short')} ${minutes}${t('sessions.minutes_short')}`;
	}
	if (minutes > 0) {
		return `${minutes}${t('sessions.minutes_short')} ${seconds}${t('sessions.seconds_short')}`;
	}
	return `${seconds}${t('sessions.seconds_short')}`;
}

interface StatCell {
	label: string;
	// Numeric value to animate. null/0 -> '–'
	value: number | null;
	// How to format the animated number for display
	formatter: (v: number) => string;
	// If value is null, show this static placeholder instead
	placeholder?: string;
	decimals?: number;
}

function renderValue(cell: StatCell): React.ReactNode {
	if (cell.value == null || !isFinite(cell.value) || cell.value <= 0) {
		return cell.placeholder ?? '–';
	}
	return (
		<CountUp
			to={cell.value}
			decimals={cell.decimals}
			separator=","
			formatFn={cell.formatter}
		/>
	);
}

export default function SmartCubeStatsGrid({ filterOptions }: Props) {
	const { t } = useTranslation();
	const solveUpdate = useSolveDb();

	const smartFilter: FilterSolvesOptions = useMemo(
		() => ({ ...filterOptions, is_smart_cube: true, dnf: false, time: {$gt: 0} }),
		[filterOptions]
	);

	const solves = useMemo(() => fetchSolves(smartFilter), [smartFilter, solveUpdate]);

	const count = solves.length;
	const totalSeconds = useMemo(
		() => solves.reduce((sum, s) => sum + (s.time || 0), 0),
		[solves]
	);
	const avgSeconds = count > 0 ? totalSeconds / count : 0;

	const totalTurns = useMemo(() => {
		let sum = 0;
		let n = 0;
		for (const s of solves) {
			if (typeof s.smart_turn_count === 'number' && s.smart_turn_count > 0) {
				sum += s.smart_turn_count;
				n++;
			}
		}
		return { sum, n };
	}, [solves]);

	const avgTurns = totalTurns.n > 0 ? totalTurns.sum / totalTurns.n : 0;
	const avgTps = avgSeconds > 0 && avgTurns > 0 ? avgTurns / avgSeconds : 0;

	const best = useMemo(() => getSinglePB(smartFilter), [smartFilter, solveUpdate]);
	const worst = useMemo(() => getWorstTime(smartFilter), [smartFilter, solveUpdate]);
	const ao5 = useMemo(() => getAveragePB(smartFilter, 5), [smartFilter, solveUpdate]);
	const ao12 = useMemo(() => getAveragePB(smartFilter, 12), [smartFilter, solveUpdate]);
	const ao100 = useMemo(() => getAveragePB(smartFilter, 100), [smartFilter, solveUpdate]);

	const avgTimes = useMemo(() => getSmartCubeAvgTimes(smartFilter), [smartFilter, solveUpdate]);

	if (count === 0) {
		return (
			<div className={b()}>
				<Empty text={t('sessions.no_smart_cube_solves')} />
			</div>
		);
	}

	const timeFormatter = (v: number) => getTimeString(v);
	const intFormatter = (v: number) => Math.round(v).toLocaleString();
	const numFormatter = (v: number) => v.toFixed(2);

	const stats: StatCell[] = [
		{ label: t('smart_cube_grid.avg_time'), value: avgSeconds, formatter: timeFormatter },
		{ label: t('smart_cube_grid.best'), value: best?.time ?? null, formatter: timeFormatter },
		{ label: t('smart_cube_grid.worst'), value: worst?.time ?? null, formatter: timeFormatter },
		{ label: t('smart_cube_grid.solve_count'), value: count, formatter: intFormatter, decimals: 0 },
		{ label: t('smart_cube_grid.avg_turns'), value: avgTurns, formatter: intFormatter, decimals: 0 },
		{ label: t('smart_cube_grid.avg_tps'), value: avgTps, formatter: numFormatter, decimals: 2 },
		{ label: t('smart_cube_grid.best_ao5'), value: ao5?.time ?? null, formatter: timeFormatter },
		{ label: t('smart_cube_grid.best_ao12'), value: ao12?.time ?? null, formatter: timeFormatter },
		{ label: t('smart_cube_grid.best_ao100'), value: ao100?.time ?? null, formatter: timeFormatter },
	];

	const detailStats: StatCell[] = [
		{
			label: t('smart_cube_grid.total_time'),
			value: totalSeconds,
			// Total duration formatlamasi animasyonu kirmaz — ham saniyeden hesaplanir
			formatter: (v) => formatTotalDuration(v, t),
		},
		{
			label: t('sessions.smart_cube_avg_inspection'),
			value: avgTimes.inspectionSampleCount > 0 ? avgTimes.avgInspection : null,
			formatter: timeFormatter,
		},
		{
			label: t('sessions.smart_cube_avg_recognition'),
			value: avgTimes.methodStepsSampleCount > 0 ? avgTimes.avgRecognition : null,
			formatter: timeFormatter,
		},
		{
			label: t('sessions.smart_cube_avg_execution'),
			value: avgTimes.methodStepsSampleCount > 0 ? avgTimes.avgExecution : null,
			formatter: timeFormatter,
		},
	];

	return (
		<div className={b()}>
			<div className={b('grid')}>
				{stats.map((s) => (
					<div key={s.label} className={b('stat')}>
						<div className={b('stat-label')}>{s.label}</div>
						<div className={b('stat-value')}>{renderValue(s)}</div>
					</div>
				))}
			</div>
			<div className={b('subtitle')}>{t('smart_cube_grid.detail_section')}</div>
			<div className={b('grid', { detail: true })}>
				{detailStats.map((s) => (
					<div key={s.label} className={b('stat')}>
						<div className={b('stat-label')}>{s.label}</div>
						<div className={b('stat-value')}>{renderValue(s)}</div>
					</div>
				))}
			</div>
		</div>
	);
}
