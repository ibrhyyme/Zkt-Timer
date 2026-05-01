import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './AllStats.scss';
import block from '../../../styles/bem';
import StatSection from '../common/stat_section/StatSection';
import StatModule from '../common/stat_module/StatModule';
import SubStats from '../common/sub_stats/SubStats';
import AllStatsFeatured from './all_featured/AllStatsFeatured';
import PuzzleRow from './puzzle_row/PuzzleRow';
import ActivityHeatmap from './activity_heatmap/ActivityHeatmap';
import TimeFocus from './time_focus/TimeFocus';
import SolvesPerDay from '../../modules/solves_per_day/SolvesPerDay';
import {fetchSolveCount} from '../../../db/solves/query';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import {StatsContext} from '../Stats';

const b = block('overall-stats');

export default function AllStats() {
	const {t} = useTranslation();
	const solveUpdate = useSolveDb();
	const {filterOptions} = useContext(StatsContext);

	const hasSolves = useMemo(() => fetchSolveCount({from_timer: true}) > 0, [solveUpdate]);

	return (
		<div className={b()}>
			<StatSection colSpan={2} title={t('stats_page.overview')}>
				<AllStatsFeatured />
			</StatSection>
			<StatSection title={t('stats_page.more_stats')}>
				<SubStats />
			</StatSection>
			{hasSolves && (
				<>
					<StatSection colSpan={3} title={t('stats_page.puzzles')}>
						<StatModule>
							<PuzzleRow />
						</StatModule>
					</StatSection>
					<StatSection colSpan={3} title={t('stats_page.consistency')}>
						<StatModule>
							<SolvesPerDay filterOptions={filterOptions} days={30} />
						</StatModule>
					</StatSection>
					<StatSection colSpan={3} title={t('stats_page.activity')}>
						<StatModule>
							<ActivityHeatmap />
						</StatModule>
					</StatSection>
					<StatSection colSpan={3} title={t('stats_page.time_focus')}>
						<TimeFocus />
					</StatSection>
				</>
			)}
		</div>
	);
}
