import React, {useState, useCallback} from 'react';
import block from '../../../styles/bem';
import {useTrainerContext} from '../TrainerContext';
import TrainerOptions from '../options/TrainerOptions';
import {useTranslation} from 'react-i18next';
import {
	GearSix,
	Eye,
	EyeSlash,
	ArrowLeft,
} from 'phosphor-react';

const b = block('trainer');

export default function TrainerToolbar() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const [showOptions, setShowOptions] = useState(false);

	const toggleMask = useCallback(() => {
		dispatch({type: 'SET_MOVE_MASKED', payload: !state.isMoveMasked});
	}, [state.isMoveMasked, dispatch]);

	return (
		<>
			<div className={b('toolbar')}>
				<div className={b('toolbar-left')}>
					{state.view === 'training' && (
						<button
							className={b('toolbar-back')}
							onClick={() => dispatch({type: 'SET_VIEW', payload: 'selection'})}
						>
							<ArrowLeft size={18} />
							{t('trainer.back')}
						</button>
					)}

					{state.view === 'training' && state.currentAlgorithm?.category !== 'custom' && (
						<button
							className={b('toolbar-btn')}
							onClick={toggleMask}
							disabled={state.timerState === 'RUNNING'}
							title={state.isMoveMasked ? t('trainer.show_moves') : t('trainer.hide_moves')}
						>
							{state.isMoveMasked ? <EyeSlash size={20} /> : <Eye size={20} />}
						</button>
					)}
				</div>

				<div className={b('toolbar-right')}>
					{state.view === 'selection' && (
						<button
							className={b('toolbar-btn')}
							onClick={() => setShowOptions(true)}
							title={t('trainer.options')}
						>
							<GearSix size={20} />
						</button>
					)}
				</div>
			</div>

			{showOptions && <TrainerOptions onClose={() => setShowOptions(false)} />}
		</>
	);
}
