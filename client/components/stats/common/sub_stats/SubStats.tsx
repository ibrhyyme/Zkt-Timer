import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './SubStats.scss';
import {
	WarningOctagon,
	Warning,
	NumberSquareOne,
	Calculator,
	Hash,
	CaretDoubleRight,
	CaretDoubleUp,
	Eye,
} from 'phosphor-react';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import NumberBlock from '../number_block/NumberBlock';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getSolveStreak} from '../../../../db/solves/stats/streak';
import {getSubStats} from '../../../../db/solves/stats/sub_stats';
import dayjs from 'dayjs';

const b = block('sub-stats');

const NEUTRAL = '#6D7D90';
const MINT = '#23C586';
const BLUE = '#54ACE4';
const ROSE = '#EF4358';
const AMBER = '#F59E0B';

interface Props {
}

export default function SubStats(props: Props) {
	const { t } = useTranslation();

	const context = useContext(StatsContext);
	const {filterOptions, stats} = context;

	const solveUpdate = useSolveDb();

	const streak = useMemo(() => {
		return getSolveStreak(filterOptions);
	}, [filterOptions, solveUpdate]);

	const subStats = useMemo(() => {
		return getSubStats(filterOptions);
	}, [filterOptions, solveUpdate]);

	let firstSolveTime = '-';
	if (subStats.firstSolve) {
		firstSolveTime = dayjs(subStats.firstSolve?.started_at).format('MM/DD/YY');
	}

	let avgSolvesPerSession = '-';
	if (streak.avgSolvesPerSession >= 0) {
		avgSolvesPerSession = String(streak.avgSolvesPerSession);
	}

	return (
		<div className={b()}>
			<NumberBlock
				small
				center
				icon={<CaretDoubleRight weight="bold" />}
				title={t('stats_page.solve_streak')}
				value={`${streak.currentStreak} ${t('stats_page.days')}`}
				color={streak.currentStreak > 0 ? MINT : NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<CaretDoubleUp weight="bold" />}
				title={t('stats_page.highest_streak')}
				value={`${streak.highestStreak} ${t('stats_page.days')}`}
				color={BLUE}
			/>
			<NumberBlock
				small
				center
				icon={<WarningOctagon weight="bold" />}
				title="DNFs"
				value={`${subStats.dnfCount} (${subStats.dnfPercent}%)`}
				color={subStats.dnfCount > 0 ? ROSE : NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<Warning weight="bold" />}
				title="+2s"
				value={`${subStats.plusTwoCount} (${subStats.plusTwoPercent}%)`}
				color={subStats.plusTwoCount > 0 ? AMBER : NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<Calculator weight="bold" />}
				title={t('stats_page.avg_solves_per_session')}
				value={avgSolvesPerSession}
				color={NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<NumberSquareOne weight="bold" />}
				title={t('stats_page.first_solve')}
				value={firstSolveTime}
				color={NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<Eye weight="bold" />}
				title="Solve Views"
				value={stats.solve_views || 0}
				color={NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<Eye weight="bold" />}
				title="Profile Views"
				value={stats.profile_views || 0}
				color={NEUTRAL}
			/>
		</div>
	);
}
