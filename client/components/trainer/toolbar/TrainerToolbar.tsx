import React, {useState, useCallback} from 'react';
import block from '../../../styles/bem';
import {useTrainerContext} from '../TrainerContext';
import TrainerOptions from '../options/TrainerOptions';
import {getPuzzleType} from '../../../util/trainer/algorithm_engine';
import {useTranslation} from 'react-i18next';
import {
	GearSix,
	Eye,
	EyeSlash,
	ArrowLeft,
	Bluetooth,
	BluetoothSlash,
	ArrowCounterClockwise,
	Compass,
	Crosshair,
} from 'phosphor-react';

const b = block('trainer');

export default function TrainerToolbar() {
	const {t} = useTranslation();
	const {state, dispatch, connectRef} = useTrainerContext();
	const [showOptions, setShowOptions] = useState(false);

	const toggleMask = useCallback(() => {
		dispatch({type: 'SET_MOVE_MASKED', payload: !state.isMoveMasked});
	}, [state.isMoveMasked, dispatch]);

	const activeCategory = state.currentAlgorithm?.category || state.selectedCategory || '';
	const is3x3Category = activeCategory !== '' && getPuzzleType(activeCategory) === '3x3x3';

	const handleBleToggle = useCallback(async () => {
		const conn = connectRef.current;
		if (!conn) return;

		if (state.smartConnected) {
			conn.disconnect?.();
			dispatch({type: 'SMART_DISCONNECT'});
		} else {
			try {
				await conn.connect();
			} catch (e) {
				// connect hatalari alertScanError callback'inde handle ediliyor
			}
			// BLE_SCAN_ABORTED durumunda connect.js direkt setTimerParams cagirir,
			// trainer state'ini sifirlamaz. Her durumda scanning/connecting resetle.
			if (!state.smartConnected) {
				dispatch({type: 'SMART_CONNECTION', payload: {scanning: false, connecting: false}});
			}
		}
	}, [connectRef, state.smartConnected, dispatch]);

	return (
		<>
			<div className={b('toolbar')}>
				<div className={b('toolbar-left')}>
					{state.view === 'training' && (
						<button
							className={b('toolbar-back')}
							onClick={() => window.history.back()}
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
					{state.view === 'training' && state.smartConnected && (
						<>
							<button
								className={b('toolbar-btn')}
								onClick={() => window.dispatchEvent(new CustomEvent('trainer:smart-reset'))}
								title={t('trainer.smart_retry')}
							>
								<ArrowCounterClockwise size={20} />
							</button>
							<button
								className={b('toolbar-btn')}
								onClick={() => window.dispatchEvent(new CustomEvent('trainer:smart-gyro-reset'))}
								title={t('trainer.smart_reset_gyro')}
							>
								<Compass size={20} />
							</button>
							<button
								className={b('toolbar-btn', {active: state.showCameraPad})}
								onClick={() => dispatch({type: 'SET_CAMERA_PAD', payload: !state.showCameraPad})}
								title={t('trainer.smart_camera_angle')}
							>
								<Crosshair size={20} />
							</button>
						</>
					)}

					{is3x3Category && (
						<button
							className={b('toolbar-btn', {active: state.smartConnected})}
							onClick={handleBleToggle}
							disabled={state.smartScanning || state.smartConnecting}
							title={state.smartConnected ? t('trainer.ble_disconnect') : t('trainer.ble_connect')}
						>
							{state.smartConnected ? <BluetoothSlash size={20} /> : <Bluetooth size={20} />}
							{(state.smartScanning || state.smartConnecting) && (
								<span className={b('toolbar-spinner')} />
							)}
						</button>
					)}

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
