import React, {useMemo, useState, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {algToId, expandNotation} from '../../../../util/trainer/algorithm_engine';
import {
	getBestTime,
	getLastTimes,
	getEffectiveTime,
	averageOfFive,
	averageOfTwelve,
	rollingAo5,
	rollingAo12,
	resetTrainerSeason,
} from '../../hooks/useAlgorithmData';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import {useTranslation} from 'react-i18next';
import {ArrowCounterClockwise} from 'phosphor-react';
import TrainerSolveInfo from './TrainerSolveInfo';

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
	const [selectedSolveIndex, setSelectedSolveIndex] = useState<number | null>(null);

	const stats = useMemo(() => {
		if (!currentAlgorithm) return null;
		const algId = algToId(currentAlgorithm.algorithm);
		const records = getLastTimes(algId);
		const best = getBestTime(algId);
		const ao5 = averageOfFive(algId);
		const ao12 = averageOfTwelve(algId);

		// Expanded move count for TPS calculation
		const expandedCount = expandNotation(currentAlgorithm.algorithm)
			.split(/\s+/).filter(Boolean)
			.reduce((count: number, move: string) => count + (move.replace(/[()]/g, '').endsWith('2') ? 2 : 1), 0);

		// TPS from last solve time (not best, which may be corrupted)
		const lastRecord = records.length > 0 ? records[records.length - 1] : null;
		const lastEffective = lastRecord ? getEffectiveTime(lastRecord) : null;
		const tps = lastEffective && lastEffective >= 100 ? (expandedCount / (lastEffective / 1000)).toFixed(2) : null;

		return {records, best, ao5, ao12, tps, expandedCount, algId};
	}, [currentAlgorithm, dbVersion]);

	// Algoritma degistiginde secimi sifirla
	const prevAlgRef = React.useRef(currentAlgorithm?.algorithm);
	if (currentAlgorithm?.algorithm !== prevAlgRef.current) {
		prevAlgRef.current = currentAlgorithm?.algorithm;
		if (selectedSolveIndex !== null) setSelectedSolveIndex(null);
	}

	const handleReset = useCallback(() => {
		if (!stats) return;
		if (window.confirm(t('trainer.reset_season_confirm'))) {
			resetTrainerSeason(stats.algId);
			setSelectedSolveIndex(null);
		}
	}, [stats, t]);

	const handleSolveInfoClose = useCallback(() => {
		setSelectedSolveIndex(null);
	}, []);

	const handleSolveInfoDelete = useCallback(() => {
		setSelectedSolveIndex(null);
	}, []);

	if (!currentAlgorithm || !stats) {
		return (
			<div className={b('stats')}>
				<div className={b('stats-empty')}>
					<p>{t('trainer.no_stats')}</p>
				</div>
			</div>
		);
	}

	const lastFive = stats.records.slice(-5).reverse();
	const totalLen = stats.records.length;

	return (
		<div className={b('stats')}>
			<div className={b('stats-title-row')}>
				<h3 className={b('stats-title')}>{currentAlgorithm.name}</h3>
				{totalLen > 0 && (
					<button
						className={b('stats-reset-btn')}
						onClick={handleReset}
						title={t('trainer.reset_season')}
					>
						<ArrowCounterClockwise size={16} />
					</button>
				)}
			</div>

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
					<span className={b('stats-value')}>{totalLen}</span>
				</div>
				<div className={b('stats-item')}>
					<span className={b('stats-label')}>TPS</span>
					<span className={b('stats-value')}>{stats.tps || '-'}</span>
				</div>
			</div>

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
							{lastFive.map((record, i) => {
								const actualIdx = totalLen - 1 - i;
								const ao5 = rollingAo5(stats.records, actualIdx);
								const ao12 = rollingAo12(stats.records, actualIdx);
								const effTime = getEffectiveTime(record);
								const tps = effTime && effTime >= 100 ? (stats.expandedCount / (effTime / 1000)).toFixed(1) : '-';

								let timeDisplay: string;
								if (record.dnf) {
									timeDisplay = 'DNF';
								} else if (record.p2) {
									timeDisplay = formatTimeShort(effTime) + '+';
								} else {
									timeDisplay = formatTimeShort(effTime);
								}

								return (
									<tr key={actualIdx} onClick={() => setSelectedSolveIndex(actualIdx)}>
										<td>{totalLen - i}</td>
										<td>{timeDisplay}</td>
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

			{selectedSolveIndex !== null && selectedSolveIndex < stats.records.length && (
				<TrainerSolveInfo
					record={stats.records[selectedSolveIndex]}
					index={selectedSolveIndex}
					algId={stats.algId}
					category={currentAlgorithm.category}
					onClose={handleSolveInfoClose}
					onDelete={handleSolveInfoDelete}
				/>
			)}
		</div>
	);
}
