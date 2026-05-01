import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import './CubeStatAverages.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {getCurrentAverage} from '../../../../db/solves/stats/solves/average/average';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {getTimeString} from '../../../../util/time';
import {openModal} from '../../../../actions/general';
import HistoryModal from '../../../modules/history/history_modal/HistoryModal';

const b = block('cube-stat-avg');

const COUNTS = [50, 100, 500, 1000, 2000];

export default function CubeStatAverages() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const items = useMemo(() => {
		return COUNTS.map((count) => {
			const avg = getCurrentAverage(filterOptions, count);
			return {count, avg};
		});
	}, [filterOptions, solveUpdate]);

	const bestCount = useMemo(() => {
		let bestTime = Infinity;
		let best: number | null = null;
		for (const item of items) {
			if (item.avg?.time != null && item.avg.time < bestTime) {
				bestTime = item.avg.time;
				best = item.count;
			}
		}
		return best;
	}, [items]);

	function openAvg(count: number) {
		const item = items.find((i) => i.count === count);
		if (!item?.avg?.solves) return;
		dispatch(
			openModal(
				<HistoryModal
					solves={item.avg.solves}
					time={item.avg.time}
					description={`Average of ${count.toLocaleString()}`}
				/>
			)
		);
	}

	return (
		<div className={b()}>
			{items.map(({count, avg}) => {
				const isBest = bestCount === count && avg?.time != null;
				const subtitle = isBest
					? t('stats.avg.best_block')
					: t('stats.avg.subtitle', {value: count.toLocaleString()});

				return (
					<button
						key={count}
						type="button"
						className={b('item', {best: isBest, disabled: !avg?.time})}
						onClick={() => openAvg(count)}
						disabled={!avg?.solves?.length}
					>
						<div className={b('label')}>
							<strong>
								Average of <span>{count.toLocaleString()}</span>
							</strong>
							<small>{subtitle}</small>
						</div>
						<div className={b('value', {best: isBest})}>
							{getTimeString(avg?.time)}
						</div>
					</button>
				);
			})}
		</div>
	);
}
