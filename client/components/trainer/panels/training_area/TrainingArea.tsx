import React, {useState, useEffect} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {isLLCategory, getDefaultFrontFace, expandNotation, getPuzzleType} from '../../../../util/trainer/algorithm_engine';
import {fetchDefaultAlgs} from '../../hooks/useAlgorithmData';
import CubeViewer from './CubeViewer';
import TrainerTimer from './TrainerTimer';
import TrainerSmartCube from './TrainerSmartCube';
import {useTranslation} from 'react-i18next';

const b = block('trainer');

export default function TrainingArea() {
	const {t} = useTranslation();
	const {state} = useTrainerContext();
	useLLPatternsReady(); // Pattern yüklendiğinde CubeViewer'ı yeniden render et
	const {currentAlgorithm, options} = state;

	const [alternatives, setAlternatives] = useState<string[]>([]);
	const [setupAlg, setSetupAlg] = useState<string | null>(null);

	useEffect(() => {
		if (!currentAlgorithm) {
			setAlternatives([]);
			setSetupAlg(null);
			return;
		}

		fetchDefaultAlgs().then((defaults) => {
			const subsets = defaults[currentAlgorithm.category];
			if (!subsets) {
				setAlternatives([]);
				setSetupAlg(null);
				return;
			}

			const expandedCurrent = expandNotation(currentAlgorithm.algorithm);
			for (const sub of subsets) {
				for (const alg of sub.algorithms) {
					if (expandNotation(alg.algorithm) === expandedCurrent) {
						setAlternatives(alg.alternatives?.length ? alg.alternatives : []);
						setSetupAlg(alg.setup || null);
						return;
					}
				}
			}
			setAlternatives([]);
			setSetupAlg(null);
		});
	}, [currentAlgorithm]);

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
			<div className={b('training-header')}>
				<div className={b('training-alg-name-row')}>
					{useSmartCube && (
						<div className={b('smart-pattern-preview')}>
							<CubeViewer
								algorithm={currentAlgorithm.algorithm}
								category={currentAlgorithm.category}
								topFace={options.topFace}
								frontFace={isLLCategory(currentAlgorithm.category) ? getDefaultFrontFace(options.topFace) : options.frontFace}
							/>
						</div>
					)}
					<div className={b('training-alg-name')}>{currentAlgorithm.name}</div>
				</div>
				{setupAlg && !state.isMoveMasked && !useSmartCube && (
					<div className={b('training-setup')}>
						<code>Setup: {setupAlg}</code>
					</div>
				)}
			</div>

			<div className={b('training-cube')}>
				{useSmartCube ? (
					<TrainerSmartCube />
				) : (
					<CubeViewer
						algorithm={currentAlgorithm.algorithm}
						category={currentAlgorithm.category}
						topFace={options.topFace}
						frontFace={isLLCategory(currentAlgorithm.category) ? getDefaultFrontFace(options.topFace) : options.frontFace}
					/>
				)}
			</div>

			<TrainerTimer />

			{!useSmartCube && !state.isMoveMasked && (
				<>
					<div className={b('training-main-alg')}>
						<code>{currentAlgorithm.algorithm}</code>
					</div>
					{alternatives.length > 0 && (
						<div className={b('training-alternatives')}>
							{alternatives.map((alt, i) => (
								<code key={i} className={b('training-alt-alg')}>{alt}</code>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}
