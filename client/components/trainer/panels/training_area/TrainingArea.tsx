import React from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {useLLPatternsReady} from '../../../../util/trainer/ll_patterns';
import CubeViewer from './CubeViewer';
import AlgDisplay from './AlgDisplay';
import TrainerTimer from './TrainerTimer';
import {useTranslation} from 'react-i18next';

const b = block('trainer');

export default function TrainingArea() {
	const {t} = useTranslation();
	const {state} = useTrainerContext();
	useLLPatternsReady(); // Pattern yüklendiğinde CubeViewer'ı yeniden render et
	const {currentAlgorithm, options} = state;

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
			{options.showAlgName && (
				<div className={b('training-alg-name')}>{currentAlgorithm.name}</div>
			)}

			<div className={b('training-cube')}>
				<CubeViewer
					algorithm={currentAlgorithm.algorithm}
					category={currentAlgorithm.category}
					topFace={options.topFace}
					frontFace={options.frontFace}
				/>
			</div>

			<AlgDisplay />
			<TrainerTimer />
		</div>
	);
}
