import React, {useCallback} from 'react';
import {useDispatch} from 'react-redux';
import block from '../../../styles/bem';
import {useTrainerContext} from '../TrainerContext';
import {getPuzzleType} from '../../../util/trainer/algorithm_engine';
import {useTranslation} from 'react-i18next';
import {openModal} from '../../../actions/general';
import TrainerSettingsModal from '../options/TrainerSettingsModal';
import type {TrainerOptions} from '../types';
import {
	Eye,
	EyeSlash,
	ArrowLeft,
	Bluetooth,
	BluetoothSlash,
	ArrowCounterClockwise,
	Compass,
	Crosshair,
	GearSix,
} from 'phosphor-react';

const b = block('trainer');

export default function TrainerToolbar() {
	const {t} = useTranslation();
	const reduxDispatch = useDispatch();
	const {state, dispatch, connectRef} = useTrainerContext();
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
				await conn.connect(state.options.showAllBleDevices);
			} catch (e) {
				// Connect errors are handled in alertScanError callback
			}
			// On BLE_SCAN_ABORTED, connect.js calls setTimerParams directly,
			// doesn't reset trainer state. Always reset scanning/connecting in any case.
			if (!state.smartConnected) {
				dispatch({type: 'SMART_CONNECTION', payload: {scanning: false, connecting: false}});
			}
		}
	}, [connectRef, state.smartConnected, state.options.showAllBleDevices, dispatch]);

	const handleOpenSettings = useCallback(() => {
		// Modal is rendered at App root via Redux, so it stays outside TrainerProvider —
		// useTrainerContext() returns default no-op dispatch.
		// Prop drilling passes current options snapshot + onChange callback.
		const onOptionChange = <K extends keyof TrainerOptions>(key: K, value: TrainerOptions[K]) => {
			dispatch({type: 'SET_OPTIONS', payload: {[key]: value} as Partial<TrainerOptions>});
		};
		reduxDispatch(openModal(
			<TrainerSettingsModal initialOptions={state.options} onOptionChange={onOptionChange} />,
			{
				title: t('trainer.settings'),
				width: 560,
				compact: true,
				closeButtonText: t('solve_info.done'),
			}
		));
	}, [reduxDispatch, t, state.options, dispatch]);

	return (
		<>
			<div className={b('toolbar')}>
				<div className={b('toolbar-left')}>
					{state.view === 'selection' && (
						<button
							className={b('toolbar-back')}
							onClick={() => dispatch({type: 'SET_VIEW', payload: 'landing'})}
						>
							<ArrowLeft size={18} />
							{t(`trainer.landing_${state.mode}_title`)}
						</button>
					)}

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

					{is3x3Category && state.mode === 'smart' && (
						<button
							className={b('toolbar-ble', {
								connected: state.smartConnected,
								busy: state.smartScanning || state.smartConnecting,
							})}
							onClick={handleBleToggle}
							disabled={state.smartScanning || state.smartConnecting}
						>
							{state.smartConnected ? <BluetoothSlash size={18} /> : <Bluetooth size={18} />}
							<span className={b('toolbar-ble-label')}>
								{state.smartScanning
									? t('trainer.scanning')
									: state.smartConnecting
										? t('trainer.connecting')
										: state.smartConnected
											? t('trainer.disconnect_cube')
											: t('trainer.connect_cube')}
							</span>
							{(state.smartScanning || state.smartConnecting) && (
								<span className={b('toolbar-spinner')} />
							)}
						</button>
					)}

					{(state.view === 'training' || state.view === 'selection') && (
						<button
							className={b('toolbar-btn')}
							onClick={handleOpenSettings}
							title={t('trainer.settings')}
						>
							<GearSix size={20} />
						</button>
					)}
					</div>
			</div>
		</>
	);
}
