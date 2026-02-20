import React, {useContext} from 'react';
import {useTranslation} from 'react-i18next';
import './AllStats.scss';
import block from '../../../styles/bem';
import StatSection from '../common/stat_section/StatSection';
import StatModule from '../common/stat_module/StatModule';
import SubStats from '../common/sub_stats/SubStats';
import SolvesPerDay from '../../modules/solves_per_day/SolvesPerDay';
import AllStatsFeatured from './all_featured/AllStatsFeatured';
import AllStatsCommunity from './all_community/AllStatsCommunity';
import CubeDistro from '../../modules/cube_distro/CubeDistro';
import {useMe} from '../../../util/hooks/useMe';
import {StatsContext} from '../Stats';
import {isNotPro} from '../../../util/pro';

const b = block('overall-stats');

export default function AllStats() {
	const { t } = useTranslation();
	const me = useMe();
	const {filterOptions} = useContext(StatsContext);

	return (
		<div className={b()}>
			<StatSection title={t('stats_page.overview')}>
				<AllStatsFeatured />
			</StatSection>
			<StatSection rowSpan={2} title={t('stats_page.community')}>
				<AllStatsCommunity />
			</StatSection>
			<StatSection title={t('stats_page.event_distribution')}>
				<StatModule>
					<CubeDistro />
				</StatModule>
			</StatSection>
			<StatSection title={t('stats_page.consistency')}>
				<StatModule>
					<SolvesPerDay filterOptions={filterOptions} days={30} />
				</StatModule>
			</StatSection>
			<StatSection title={t('stats_page.more_stats')}>
				<SubStats />
			</StatSection>
		</div>
	);
}
