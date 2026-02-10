import React, {useContext, useMemo} from 'react';
import './SubStats.scss';
import {
	WarningOctagon,
	Warning,
	NumberSquareOne,
	Calculator,
	Hash,
	CaretDoubleRight,
	CaretDoubleUp,
} from 'phosphor-react';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import NumberBlock from '../number_block/NumberBlock';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getSolveStreak} from '../../../../db/solves/stats/streak';
import {getSubStats} from '../../../../db/solves/stats/sub_stats';
import dayjs from 'dayjs';

const b = block('sub-stats');

const SUB_STATS_COLOR = '#6D7D90';

interface Props {
}

export default function SubStats(props: Props) {

	const context = useContext(StatsContext);
	const {filterOptions} = context;

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
				title="Çözüm Serisi"
				value={`${streak.currentStreak} gün`}
				color={SUB_STATS_COLOR}
			/>
			<NumberBlock
				small
				center
				icon={<CaretDoubleUp weight="bold" />}
				title="En Yüksek Seri"
				value={`${streak.highestStreak} gün`}
				color={SUB_STATS_COLOR}
			/>
			<NumberBlock
				small
				center
				icon={<WarningOctagon weight="bold" />}
				title="DNFs"
				value={`${subStats.dnfCount} (${subStats.dnfPercent}%)`}
				color={SUB_STATS_COLOR}
			/>
			<NumberBlock
				small
				center
				icon={<Warning weight="bold" />}
				title="+2s"
				value={`${subStats.plusTwoCount} (${subStats.plusTwoPercent}%)`}
				color={SUB_STATS_COLOR}
			/>
			<NumberBlock
				small
				center
				icon={<Calculator weight="bold" />}
				title="Ort. Çözüm / Seans"
				value={avgSolvesPerSession}
				color={SUB_STATS_COLOR}
			/>
			<NumberBlock
				small
				center
				icon={<NumberSquareOne weight="bold" />}
				title="İlk Çözüm"
				value={firstSolveTime}
				color={SUB_STATS_COLOR}
			/>
		</div>
	);
}
