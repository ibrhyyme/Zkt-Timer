import React, {useState, useEffect} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import {isLLCategory, getDefaultFrontFace, expandNotation} from '../../../../util/trainer/algorithm_engine';
import {fetchDefaultAlgs} from '../../hooks/useAlgorithmData';
import CubeViewer from './CubeViewer';
import TrainerTimer from './TrainerTimer';
import {useTranslation} from 'react-i18next';

const b = block('trainer');

export default function TrainingArea() {
	const {t} = useTranslation();
	const {state} = useTrainerContext();
	useLLPatternsReady(); // Pattern yüklendiğinde CubeViewer'ı yeniden render et
	const {currentAlgorithm, options} = state;

	const [alternatives, setAlternatives] = useState<string[]>([]);

	useEffect(() => {
		if (!currentAlgorithm) {
			setAlternatives([]);
			return;
		}

		fetchDefaultAlgs().then((defaults) => {
			const subsets = defaults[currentAlgorithm.category];
			if (!subsets) {
				setAlternatives([]);
				return;
			}

			const expandedCurrent = expandNotation(currentAlgorithm.algorithm);
			for (const sub of subsets) {
				for (const alg of sub.algorithms) {
					if (expandNotation(alg.algorithm) === expandedCurrent && alg.alternatives?.length) {
						setAlternatives(alg.alternatives);
						return;
					}
				}
			}
			setAlternatives([]);
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

	return (
		<div className={b('training-area')}>
			<div className={b('training-alg-name')}>{currentAlgorithm.name}</div>

			<div className={b('training-cube')}>
				<CubeViewer
					algorithm={currentAlgorithm.algorithm}
					category={currentAlgorithm.category}
					topFace={options.topFace}
					frontFace={isLLCategory(currentAlgorithm.category) ? getDefaultFrontFace(options.topFace) : options.frontFace}
				/>
			</div>

			<TrainerTimer />

			{!state.isMoveMasked && (
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
