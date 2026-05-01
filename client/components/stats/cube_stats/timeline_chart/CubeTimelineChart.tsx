import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './CubeTimelineChart.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import TimeChart from '../../../modules/time_chart/TimeChart';
import {getCurrentAverage} from '../../../../db/solves/stats/solves/average/average';
import {getAveragePB} from '../../../../db/solves/stats/solves/average/average_pb';
import {getTotalSolveCount} from '../../../../db/solves/stats/count';
import {getTimeString} from '../../../../util/time';

const b = block('cube-timeline');

export default function CubeTimelineChart() {
	const {t} = useTranslation();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const currentAo12 = useMemo(() => getCurrentAverage(filterOptions, 12), [filterOptions, solveUpdate]);
	const bestAo12 = useMemo(() => getAveragePB(filterOptions, 12), [filterOptions, solveUpdate]);
	const totalCount = useMemo(() => getTotalSolveCount(filterOptions), [filterOptions, solveUpdate]);

	const trendDelta = useMemo(() => {
		if (currentAo12?.time != null && bestAo12?.time != null) {
			return currentAo12.time - bestAo12.time;
		}
		return null;
	}, [currentAo12, bestAo12]);

	return (
		<div className={b()}>
			<div className={b('head')}>
				<span className={b('label')}>{t('stats.cube_chart.eyebrow')}</span>
			</div>
			<div className={b('chart')}>
				<TimeChart filterOptions={filterOptions} />
			</div>
			<div className={b('stats')}>
				<div className={b('stat')}>
					<span className={b('stat-label')}>{t('stats.cube_chart.current_ao12')}</span>
					<span className={b('stat-val', {mint: true})}>{getTimeString(currentAo12?.time)}</span>
				</div>
				<div className={b('stat')}>
					<span className={b('stat-label')}>{t('stats.cube_chart.best_ao12')}</span>
					<span className={b('stat-val', {mint: true})}>{getTimeString(bestAo12?.time)}</span>
				</div>
				<div className={b('stat')}>
					<span className={b('stat-label')}>{t('stats.cube_chart.gap')}</span>
					<span className={b('stat-val', {rose: trendDelta != null && trendDelta > 0})}>
						{trendDelta != null && trendDelta > 0
							? `+${getTimeString(trendDelta)}`
							: trendDelta === 0
								? t('stats.cube_chart.gap_at_pb')
								: '-'}
					</span>
				</div>
				<div className={b('stat')}>
					<span className={b('stat-label')}>{t('stats.cube_chart.total')}</span>
					<span className={b('stat-val')}>{totalCount.toLocaleString()}</span>
				</div>
			</div>
		</div>
	);
}
