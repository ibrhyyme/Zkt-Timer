import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './CubeStats.scss';
import block from '../../../styles/bem';
import StatSection from '../common/stat_section/StatSection';
import StatModule from '../common/stat_module/StatModule';
import CubeStatsFeatured from './featured/CubeStatsFeatured';
import CubeStatAverages from './averages/CubeStatAverages';
import CubeTimelineChart from './timeline_chart/CubeTimelineChart';
import HourlyConsistency from './hourly_consistency/HourlyConsistency';
import PhaseSplits from './phase_splits/PhaseSplits';
import SessionStepsTable from '../../sessions/smart_cube_steps_table/SessionStepsTable';
import SmartCubeSummary from '../../sessions/smart_cube_summary/SmartCubeSummary';
import SubStats from '../common/sub_stats/SubStats';
import {StatsContext} from '../Stats';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import {fetchSolveCount} from '../../../db/solves/query';

const b = block('cube-stats');

export default function CubeStats() {
	const {t} = useTranslation();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const hasSmartCubeData = useMemo(
		() => fetchSolveCount({...filterOptions, is_smart_cube: true}) > 0,
		[filterOptions, solveUpdate]
	);

	return (
		<div className={b()}>
			{hasSmartCubeData && (
				<StatSection title={t('stats_page.smart_cube_summary')} className={b('summary')}>
					<StatModule>
						<SmartCubeSummary filterOptions={filterOptions} />
					</StatModule>
				</StatSection>
			)}
			<StatSection title={t('stats_page.overview')} className={b('featured')}>
				<CubeStatsFeatured />
			</StatSection>
			<StatSection title={t('stats_page.averages')} className={b('averages')}>
				<StatModule>
					<CubeStatAverages />
				</StatModule>
			</StatSection>
			<StatSection title={t('stats_page.solve_times')} className={b('chart')}>
				<StatModule>
					<CubeTimelineChart />
				</StatModule>
			</StatSection>
			<StatSection title={t('stats_page.more_stats')} className={b('substats')}>
				<SubStats />
			</StatSection>
			<StatSection title={t('stats_page.hourly_consistency')} className={b('hourly')}>
				<StatModule>
					<HourlyConsistency />
				</StatModule>
			</StatSection>
			{hasSmartCubeData && (
				<StatSection title={t('stats_page.phase_splits')} className={b('splits')}>
					<StatModule>
						<PhaseSplits />
					</StatModule>
				</StatSection>
			)}
			{hasSmartCubeData && (
				<StatSection title={t('stats_page.steps_detail')} className={b('steps-table')}>
					<StatModule>
						<SessionStepsTable
							filterOptions={filterOptions}
							title={t('stats_page.steps_detail')}
						/>
					</StatModule>
				</StatSection>
			)}
		</div>
	);
}
