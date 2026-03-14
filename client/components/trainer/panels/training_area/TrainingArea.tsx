import React, {useState, useEffect, useMemo} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {isLLCategory, getDefaultFrontFace, getPuzzleType, algToId} from '../../../../util/trainer/algorithm_engine';
import {fetchDefaultAlgs, getLastTimes} from '../../hooks/useAlgorithmData';
import {useTrainerDb} from '../../../../util/hooks/useTrainerDb';
import CubeViewer from './CubeViewer';
import TrainerTimer from './TrainerTimer';
import TrainerSmartCube from './TrainerSmartCube';
import AlternativesPicker from '../stats_panel/AlternativesPicker';
import TrainerTimeChart from '../stats_panel/TrainerTimeChart';
import {useTranslation} from 'react-i18next';

const b = block('trainer');

export default function TrainingArea() {
	const {t} = useTranslation();
	const {state} = useTrainerContext();
	useLLPatternsReady();
	const {currentAlgorithm, options} = state;
	const dbVersion = useTrainerDb();

	const [setupAlg, setSetupAlg] = useState<string | null>(null);

	useEffect(() => {
		if (!currentAlgorithm) {
			setSetupAlg(null);
			return;
		}

		fetchDefaultAlgs().then((defaults) => {
			const subsets = defaults[currentAlgorithm.category];
			if (!subsets) {
				setSetupAlg(null);
				return;
			}

			for (const sub of subsets) {
				const entry = sub.algorithms.find((a: any) => a.name === currentAlgorithm.name);
				if (entry) {
					setSetupAlg(entry.setup || null);
					return;
				}
			}
			setSetupAlg(null);
		});
	}, [currentAlgorithm?.name, currentAlgorithm?.category]);

	const chartTimes = useMemo(() => {
		if (!currentAlgorithm) return [];
		return getLastTimes(algToId(currentAlgorithm.algorithm));
	}, [currentAlgorithm, dbVersion]);

	if (!currentAlgorithm) {
		return (
			<div className={b('training-area')}>
				<div className={b('training-empty')}>
					<p>{t('trainer.select_algorithms_hint')}</p>
				</div>
			</div>
		);
	}

	const is3x3 = getPuzzleType(currentAlgorithm.category) === '3x3x3';
	const useSmartCube = state.smartConnected && is3x3;

	return (
		<div className={b('training-area')}>
			{/* Sol ust info panel: pattern + isim + alternatifler */}
			<div className={b('training-info-panel')}>
				<div className={b('training-info-header')}>
					<div className={b('smart-pattern-preview')}>
						<CubeViewer
							algorithm={currentAlgorithm.algorithm}
							category={currentAlgorithm.category}
							topFace={options.topFace}
							frontFace={isLLCategory(currentAlgorithm.category) ? getDefaultFrontFace(options.topFace) : options.frontFace}
						/>
					</div>
					<div className={b('training-info-meta')}>
						<div className={b('training-alg-name')}>{currentAlgorithm.name}</div>
					</div>
				</div>
				<AlternativesPicker />
			</div>

			{/* Ana icerik: kup + hamleler + timer + grafik */}
			<div className={b('training-main')}>
				{useSmartCube ? (
					<TrainerSmartCube />
				) : (
					<>
						{setupAlg && !useSmartCube && (
							<div className={b('training-setup')}>
								<code>Setup: {setupAlg}</code>
							</div>
						)}
						<div className={b('training-cube')}>
							<CubeViewer
								algorithm={currentAlgorithm.algorithm}
								category={currentAlgorithm.category}
								topFace={options.topFace}
								frontFace={isLLCategory(currentAlgorithm.category) ? getDefaultFrontFace(options.topFace) : options.frontFace}
							/>
						</div>
						{!state.isMoveMasked && (
							<div className={b('training-main-alg')}>
								<code>{currentAlgorithm.algorithm}</code>
							</div>
						)}
					</>
				)}

				<TrainerTimer />

				{chartTimes.length >= 3 && (
					<div className={b('training-chart-row')}>
						<div className={b('training-chart')}>
							<TrainerTimeChart times={chartTimes} />
						</div>
						<div className={b('training-chart-legend')}>
							<div className={b('training-chart-legend-item')}>
								<span className={b('training-chart-dot', {single: true})} />
								<span>Single</span>
							</div>
							<div className={b('training-chart-legend-item')}>
								<span className={b('training-chart-dot', {ao5: true})} />
								<span>Ao5</span>
							</div>
							<div className={b('training-chart-legend-item')}>
								<span className={b('training-chart-dot', {ao12: true})} />
								<span>Ao12</span>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
