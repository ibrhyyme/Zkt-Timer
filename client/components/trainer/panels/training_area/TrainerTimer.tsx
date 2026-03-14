import React, {useEffect, useRef, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {addTime} from '../../hooks/useAlgorithmData';
import {algToId, getPuzzleType} from '../../../../util/trainer/algorithm_engine';
import {useTranslation} from 'react-i18next';

const b = block('trainer');

export default function TrainerTimer() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const {timerState, currentTimerValue, currentAlgorithm} = state;

	const is3x3 = getPuzzleType(currentAlgorithm?.category || '') === '3x3x3';
	const isSmartMode = state.smartConnected && is3x3;

	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const startTimeRef = useRef<number>(0);

	const formatTime = (ms: number): string => {
		if (ms <= 0) return '0.000';
		const totalSeconds = Math.floor(ms / 1000);
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		const millis = Math.floor(ms % 1000);

		if (minutes > 0) {
			return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
		}
		return `${seconds}.${millis.toString().padStart(3, '0')}`;
	};

	const stopTimer = useCallback(() => {
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
		const finalTime = Date.now() - startTimeRef.current;
		dispatch({type: 'SET_TIMER_VALUE', payload: finalTime});
		dispatch({type: 'SET_TIMER_STATE', payload: 'STOPPED'});

		if (currentAlgorithm) {
			const algId = algToId(currentAlgorithm.algorithm);
			addTime(algId, finalTime);
		}
	}, [currentAlgorithm, dispatch]);

	const startTimer = useCallback(() => {
		startTimeRef.current = Date.now();
		dispatch({type: 'SET_TIMER_STATE', payload: 'RUNNING'});
		dispatch({type: 'SET_TIMER_VALUE', payload: 0});

		intervalRef.current = setInterval(() => {
			dispatch({type: 'SET_TIMER_VALUE', payload: Date.now() - startTimeRef.current});
		}, 30);
	}, [dispatch]);

	const handleAdvance = useCallback(() => {
		dispatch({type: 'ADVANCE_ALGORITHM'});
	}, [dispatch]);

	// Keyboard and touch controls
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.code !== 'Space' || e.repeat) return;
			e.preventDefault();

			if (isSmartMode) {
				if (timerState === 'STOPPED') {
					handleAdvance();
				} else if (state.smartPhase === 'solving') {
					// Manuel durdurma — kullanici kupu sezgisel cozduyse
					dispatch({type: 'SET_TIMER_STATE', payload: 'STOPPED'});
					dispatch({type: 'SMART_SET_PHASE', payload: 'completed'});
					if (currentAlgorithm) {
						addTime(algToId(currentAlgorithm.algorithm), currentTimerValue);
					}
					setTimeout(() => dispatch({type: 'ADVANCE_ALGORITHM'}), 150);
				}
				return;
			}

			if (timerState === 'RUNNING') {
				stopTimer();
			} else if (timerState === 'STOPPED') {
				handleAdvance(); // ADVANCE_ALGORITHM reducer IDLE'a set eder
			} else if (timerState === 'IDLE') {
				dispatch({type: 'SET_TIMER_STATE', payload: 'READY'});
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			if (e.code !== 'Space') return;
			e.preventDefault();

			if (isSmartMode) return;

			if (timerState === 'READY') {
				startTimer();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
		};
	}, [timerState, isSmartMode, stopTimer, startTimer, handleAdvance, dispatch, state.smartPhase, currentTimerValue, currentAlgorithm]);

	// Cleanup interval on unmount
	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, []);

	const handleTouch = useCallback(() => {
		if (isSmartMode) {
			if (timerState === 'STOPPED') {
				handleAdvance();
			} else if (state.smartPhase === 'solving') {
				dispatch({type: 'SET_TIMER_STATE', payload: 'STOPPED'});
				dispatch({type: 'SMART_SET_PHASE', payload: 'completed'});
				if (currentAlgorithm) {
					addTime(algToId(currentAlgorithm.algorithm), currentTimerValue);
				}
				setTimeout(() => dispatch({type: 'ADVANCE_ALGORITHM'}), 150);
			}
			return;
		}
		if (timerState === 'RUNNING') {
			stopTimer();
		} else if (timerState === 'STOPPED') {
			handleAdvance();
		} else {
			startTimer();
		}
	}, [timerState, isSmartMode, stopTimer, startTimer, handleAdvance, state.smartPhase, currentTimerValue, currentAlgorithm, dispatch]);

	return (
		<div
			className={b('timer', {
				ready: timerState === 'READY',
				running: timerState === 'RUNNING',
				stopped: timerState === 'STOPPED',
			})}
			onClick={handleTouch}
		>
			<div className={b('timer-value')}>{formatTime(currentTimerValue)}</div>
			{timerState === 'IDLE' && currentAlgorithm && !isSmartMode && (
				<div className={b('timer-hint')}>Space</div>
			)}
			{isSmartMode && state.smartPhase === 'ready' && (
				<div className={b('timer-hint')}>{t('trainer.ble_make_first_move')}</div>
			)}
		</div>
	);
}
