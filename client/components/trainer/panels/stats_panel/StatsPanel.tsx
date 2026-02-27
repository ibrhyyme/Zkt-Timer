import React, {useMemo} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {algToId, expandNotation} from '../../../../util/trainer/algorithm_engine';
import {
	getBestTime,
	getLastTimes,
	averageOfFive,
	averageOfTwelve,
	rollingAo5,
	rollingAo12,
} from '../../hooks/useAlgorithmData';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import {useTranslation} from 'react-i18next';
import TrainerBarChart from './TrainerBarChart';
import TrainerTimeChart from './TrainerTimeChart';

const b = block('trainer');

function formatTimeShort(ms: number | null): string {
	if (!ms) return '-';
	const seconds = Math.floor(ms / 1000);
	const millis = Math.floor(ms % 1000);
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export default function StatsPanel() {
	const {t} = useTranslation();
	const {state} = useTrainerContext();
	const {currentAlgorithm} = state;
	const dbVersion = useTrainerDb();

	const stats = useMemo(() => {
		if (!currentAlgorithm) return null;
		const algId = algToId(currentAlgorithm.algorithm);
		const times = getLastTimes(algId);
		const best = getBestTime(algId);
		const ao5 = averageOfFive(algId);
		const ao12 = averageOfTwelve(algId);

		// Expanded move count for TPS calculation
		const expandedCount = expandNotation(currentAlgorithm.algorithm)
			.split(/\s+/).filter(Boolean)
			.reduce((count: number, move: string) => count + (move.replace(/[()]/g, '').endsWith('2') ? 2 : 1), 0);

		// TPS from last solve time (not best, which may be corrupted)
		const lastTime = times.length > 0 ? times[times.length - 1] : null;
		const tps = lastTime && lastTime >= 100 ? (expandedCount / (lastTime / 1000)).toFixed(2) : null;

		return {times, best, ao5, ao12, tps, expandedCount};
	}, [currentAlgorithm, dbVersion]);

	if (!currentAlgorithm || !stats) {
		return (
			<div className={b('stats')}>
				<div className={b('stats-empty')}>
					<p>{t('trainer.no_stats')}</p>
				</div>
			</div>
		);
	}

	const lastFive = stats.times.slice(-5).reverse();
	const totalLen = stats.times.length;

	return (
		<div className={b('stats')}>
			<h3 className={b('stats-title')}>{currentAlgorithm.name}</h3>

			<div className={b('stats-grid')}>
				<div className={b('stats-item')}>
					<span className={b('stats-label')}>{t('trainer.best')}</span>
					<span className={b('stats-value', {best: true})}>{formatTimeShort(stats.best)}</span>
				</div>
				<div className={b('stats-item')}>
					<span className={b('stats-label')}>Ao5</span>
					<span className={b('stats-value')}>{formatTimeShort(stats.ao5)}</span>
				</div>
				<div className={b('stats-item')}>
					<span className={b('stats-label')}>Ao12</span>
					<span className={b('stats-value')}>{formatTimeShort(stats.ao12)}</span>
				</div>
				<div className={b('stats-item')}>
					<span className={b('stats-label')}>{t('trainer.total_solves')}</span>
					<span className={b('stats-value')}>{stats.times.length}</span>
				</div>
				<div className={b('stats-item')}>
					<span className={b('stats-label')}>TPS</span>
					<span className={b('stats-value')}>{stats.tps || '-'}</span>
				</div>
			</div>

			{stats.times.length >= 2 && (
			<div className={b('stats-chart')}>
				<TrainerBarChart times={stats.times.slice(-10)} bestTime={stats.best} />
			</div>
		)}

		{stats.times.length >= 5 && (
			<div className={b('stats-chart')}>
				<TrainerTimeChart times={stats.times} />
			</div>
		)}

		{lastFive.length > 0 && (
				<div className={b('stats-times')}>
					<h4 className={b('stats-subtitle')}>{t('trainer.recent_times')}</h4>
					<table className={b('stats-table')}>
						<thead>
							<tr>
								<th>#</th>
								<th>Single</th>
								<th>Ao5</th>
								<th>Ao12</th>
								<th>TPS</th>
							</tr>
						</thead>
						<tbody>
							{lastFive.map((time, i) => {
								const actualIdx = totalLen - 1 - i;
								const ao5 = rollingAo5(stats.times, actualIdx);
								const ao12 = rollingAo12(stats.times, actualIdx);
								const tps = time >= 100 ? (stats.expandedCount / (time / 1000)).toFixed(1) : '-';
								return (
									<tr key={i}>
										<td>{totalLen - i}</td>
										<td>{formatTimeShort(time)}</td>
										<td>{formatTimeShort(ao5)}</td>
										<td>{formatTimeShort(ao12)}</td>
										<td>{tps}</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
