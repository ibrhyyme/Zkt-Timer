import React, {useContext} from 'react';
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
	const context = useContext(StatsContext);
	const filter = context.filterOptions;

	const oneMonth = new Date();
	oneMonth.setDate(oneMonth.getDate() - 60);

	return (
		<div className={b()}>
			<StatSection title="Genel Bakış" className={b('featured')}>
				<CubeStatsFeatured />
			</StatSection>
			<StatSection title="Ortalamalar" className={b('averages')}>
				<CubeStatAverages />
			</StatSection>
			<StatSection minWidth="400px" title="Çözüm süreleri" className={b('solve-times')}>
				<StatModule>
					<TimeChart filterOptions={filter} />
				</StatModule>
			</StatSection>
			<StatSection title="Daha Fazla İstatistik" className={b('sub-stats')}>
				<SubStats />
			</StatSection>
			<StatSection colSpan="all" title="Tutarlılık" className={b('consistency')}>
				<StatModule>
					<SolvesPerDay filterOptions={filter} days={60} />
				</StatModule>
			</StatSection>
		</div>
	);
}
