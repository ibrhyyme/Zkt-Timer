import React, {useContext} from 'react';
import {useTranslation} from 'react-i18next';
import './CubeStats.scss';
import block from '../../../styles/bem';
import CubeStatsFeatured from './featured/CubeStatsFeatured';
import TimeChart from '../../modules/time_chart/TimeChart';
import StatSection from '../common/stat_section/StatSection';
import StatModule from '../common/stat_module/StatModule';
import CubeStatAverages from './averages/CubeStatAverages';
import {StatsContext} from '../Stats';
import SubStats from '../common/sub_stats/SubStats';
import SolvesPerDay from '../../modules/solves_per_day/SolvesPerDay';

const b = block('cube-stats');

export default function CubeStats() {
	const { t } = useTranslation();
	const context = useContext(StatsContext);
	const filter = context.filterOptions;

	const oneMonth = new Date();
	oneMonth.setDate(oneMonth.getDate() - 60);

	return (
		<div className={b()}>
			<StatSection title={t('stats_page.overview')} className={b('featured')}>
				<CubeStatsFeatured />
			</StatSection>
			<StatSection title={t('stats_page.averages')} className={b('averages')}>
				<CubeStatAverages />
			</StatSection>
			<StatSection minWidth="400px" title={t('stats_page.solve_times')} className={b('solve-times')}>
				<StatModule>
					<TimeChart filterOptions={filter} />
				</StatModule>
			</StatSection>
			<StatSection title={t('stats_page.more_stats')} className={b('sub-stats')}>
				<SubStats />
			</StatSection>
			<StatSection colSpan="all" title={t('stats_page.consistency')} className={b('consistency')}>
				<StatModule>
					<SolvesPerDay filterOptions={filter} days={60} />
				</StatModule>
			</StatSection>
		</div>
	);
}
