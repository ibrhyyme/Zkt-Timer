import React, {useState, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import CubeViewer from '../training_area/CubeViewer';
import type {CheckedAlgorithm} from '../../types';
import {useTranslation} from 'react-i18next';
import {Play, Barbell} from 'phosphor-react';

const b = block('trainer');

export default function AlgorithmInput() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const [inputValue, setInputValue] = useState('');

	const handlePlay = useCallback(() => {
		const trimmed = inputValue.trim();
		dispatch({type: 'SET_CUSTOM_ALG', payload: trimmed});
	}, [inputValue, dispatch]);

	const handleTrain = useCallback(() => {
		if (!state.customAlg) return;
		const customChecked: CheckedAlgorithm = {
			algorithm: state.customAlg,
			name: 'Custom',
			bestTime: null,
			category: 'custom',
			subset: '',
		};
		dispatch({type: 'SET_CHECKED_ALGORITHMS', payload: [customChecked]});
		dispatch({type: 'SET_VIEW', payload: 'training'});
	}, [state.customAlg, dispatch]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === 'Enter') {
				handlePlay();
			}
		},
		[handlePlay]
	);

	return (
		<div className={b('alg-input-section')}>
			<div className={b('alg-input-cube')}>
				<CubeViewer
					algorithm={state.customAlg || ''}
					category="custom"
					topFace={state.options.topFace}
					frontFace={state.options.frontFace}
				/>
			</div>
			<div className={b('alg-input-row')}>
				<button
					className={b('alg-input-play')}
					onClick={handlePlay}
					title={t('trainer.play')}
				>
					<Play size={18} weight="fill" />
				</button>
				<input
					className={b('alg-input-field')}
					value={inputValue}
					onChange={(e) => setInputValue(e.target.value)}
					placeholder={t('trainer.enter_alg_placeholder')}
					onKeyDown={handleKeyDown}
				/>
				{state.customAlg && (
					<button
						className={b('alg-input-train')}
						onClick={handleTrain}
						title={t('trainer.train_this')}
					>
						<Barbell size={18} />
					</button>
				)}
			</div>
		</div>
	);
}
