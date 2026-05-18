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
import SmartCubeStatsGrid from './smart_cube_grid/SmartCubeStatsGrid';
import CaseSection from './cases/CaseSection';
import SubStats from '../common/sub_stats/SubStats';
import StatsViewToggle, {StatsView} from './view_toggle/StatsViewToggle';
import {StatsContext} from '../Stats';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import {fetchSolveCount} from '../../../db/solves/query';

const b = block('cube-stats');

type View = StatsView;

export default function CubeStats() {
	const {t} = useTranslation();
	const {filterOptions, view, setView, smartLastN} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const smartCubeCount = useMemo(
		() => fetchSolveCount({...filterOptions, is_smart_cube: true}),
		[filterOptions, solveUpdate]
	);
	const totalCount = useMemo(
		() => fetchSolveCount(filterOptions),
		[filterOptions, solveUpdate]
	);
	const hasSmartCubeData = smartCubeCount > 0;

	// Smart cube solve yoksa view'i her zaman 'all' tut (toggle gosterilmiyor zaten)
	const activeView: View = hasSmartCubeData ? view : 'all';

	return (
		<div className={b()}>
			{hasSmartCubeData && (
				<div className={b('view-toggle')}>
					<StatsViewToggle
						view={activeView}
						onChange={setView}
						allCount={totalCount}
						smartCount={smartCubeCount}
					/>
				</div>
			)}

			{activeView === 'all' && (
				<div className={b('view', {all: true})}>
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
				</div>
			)}

			{activeView === 'smart' && (
				<div className={b('view', {smart: true})}>
					<StatSection title={t('stats_page.smart_cube_summary')} className={b('summary')}>
						<StatModule>
							<SmartCubeStatsGrid filterOptions={filterOptions} lastN={smartLastN} />
						</StatModule>
					</StatSection>
					<StatSection title={t('stats_page.cases')} className={b('cases')}>
						<StatModule>
							<CaseSection />
						</StatModule>
					</StatSection>
					<StatSection title={t('stats_page.phase_splits')} className={b('splits')}>
						<StatModule>
							<PhaseSplits />
						</StatModule>
					</StatSection>
					<StatSection title={t('stats_page.steps_detail')} className={b('steps-table')}>
						<StatModule>
							<SessionStepsTable
								filterOptions={filterOptions}
								lastN={smartLastN}
								title={t('stats_page.steps_detail')}
							/>
						</StatModule>
					</StatSection>
				</div>
			)}
		</div>
	);
}
