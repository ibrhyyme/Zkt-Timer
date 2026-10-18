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
import NumberBlock, {NEUTRAL_STAT_COLOR} from '../number_block/NumberBlock';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getSolveStreak} from '../../../../db/solves/stats/streak';
import {getSubStats} from '../../../../db/solves/stats/sub_stats';
import {getAvgSolvesPerSession} from '../../../../db/solves/stats/extras';
import {formatInteger, formatPercent, formatShortDate} from '../../../../util/locale_format';

const b = block('sub-stats');

const NEUTRAL = NEUTRAL_STAT_COLOR;
const MINT = '#23C586';
const BLUE = '#54ACE4';
const ROSE = '#EF4358';
const AMBER = '#F59E0B';

interface Props {
}

export default function SubStats(props: Props) {
	const { t, i18n } = useTranslation();
	const language = i18n.language;

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
		firstSolveTime = formatShortDate(subStats.firstSolve?.started_at, language);
	}

	// Per season, the same number as "Active sessions" under Time & Focus (it used to be per
	// run of consecutive active days)
	const avgSolvesPerSession = useMemo(() => getAvgSolvesPerSession(filterOptions), [filterOptions, solveUpdate]);

	return (
		<div className={b()}>
			<NumberBlock
				small
				center
				icon={<CaretDoubleRight weight="bold" />}
				title={t('stats_page.solve_streak')}
				value={t('stats_page.duration_days', {count: streak.currentStreak})}
				color={streak.currentStreak > 0 ? MINT : NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<CaretDoubleUp weight="bold" />}
				title={t('stats_page.highest_streak')}
				value={t('stats_page.duration_days', {count: streak.highestStreak})}
				color={BLUE}
			/>
			<NumberBlock
				small
				center
				icon={<WarningOctagon weight="bold" />}
				title={t('stats.sub_stats.dnfs')}
				value={`${formatInteger(subStats.dnfCount, language)} (${formatPercent(Number(subStats.dnfPercent), language)})`}
				color={subStats.dnfCount > 0 ? ROSE : NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<Warning weight="bold" />}
				title={t('stats.sub_stats.plus_twos')}
				value={`${formatInteger(subStats.plusTwoCount, language)} (${formatPercent(Number(subStats.plusTwoPercent), language)})`}
				color={subStats.plusTwoCount > 0 ? AMBER : NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<Calculator weight="bold" />}
				title={t('stats_page.avg_solves_per_session')}
				value={String(avgSolvesPerSession)}
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
				title={t('stats_page.solve_views')}
				value={stats.solve_views || 0}
				color={NEUTRAL}
			/>
			<NumberBlock
				small
				center
				icon={<Eye weight="bold" />}
				title={t('stats_page.profile_views')}
				value={stats.profile_views || 0}
				color={NEUTRAL}
			/>
		</div>
	);
}
