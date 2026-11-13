import React, {useEffect, useRef, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {addTime, resetFailCount, checkAutoLearn} from '../../hooks/useAlgorithmData';
import {algToId, getPuzzleType} from '../../../../util/trainer/algorithm_engine';
import {useTranslation} from 'react-i18next';
import LiveTime from '../../../common/live_time/LiveTime';

const b = block('trainer');

function formatTime(ms: number): string {
	if (ms <= 0) return '0.000';
	const totalSeconds = Math.floor(ms / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	const millis = Math.floor(ms % 1000);

	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
	}
	return `${seconds}.${millis.toString().padStart(3, '0')}`;
}

export default function TrainerTimer() {
	const {t} = useTranslation();
	const {state, dispatch} = useTrainerContext();
	const {timerState, currentTimerValue, timerStartedAt, currentAlgorithm} = state;

	const is3x3 = getPuzzleType(currentAlgorithm?.category || '') === '3x3x3';
	const isSmartMode = state.smartConnected && state.smartPuzzle === '333' && is3x3;

	const startTimeRef = useRef<number>(0);

	const stopTimer = useCallback(() => {
		const finalTime = Date.now() - startTimeRef.current;
		dispatch({type: 'SET_TIMER_VALUE', payload: finalTime});
		dispatch({type: 'SET_TIMER_STATE', payload: 'STOPPED'});

		if (currentAlgorithm) {
			const algId = algToId(currentAlgorithm.algorithm);
			addTime(algId, finalTime);
			// In standard mode, there is no error tracking — since manual timer is used,
			// each solve is considered clean. Fail counter is reset, auto-learn is called.
			resetFailCount(algId);
			if (state.options.autoLearnEnabled) {
				checkAutoLearn(algId, state.options.autoLearnThreshold);
			}
		}
	}, [currentAlgorithm, dispatch, state.options.autoLearnEnabled, state.options.autoLearnThreshold]);

	// The running digits are drawn by LiveTime from timerStartedAt; nothing ticks through the
	// trainer state while the solve runs, so the trainer around the timer does not re-render.
	const startTimer = useCallback(() => {
		startTimeRef.current = Date.now();
		dispatch({type: 'START_TIMER', payload: startTimeRef.current});
	}, [dispatch]);

	// Smart mode, stopped by hand: the user solved the case without the cube seeing it. The
	// time is taken now, from the start TrainerSmartCube recorded.
	const stopSmartByHand = useCallback(() => {
		const finalTime = Date.now() - timerStartedAt;
		dispatch({type: 'SET_TIMER_VALUE', payload: finalTime});
		dispatch({type: 'SET_TIMER_STATE', payload: 'STOPPED'});
		dispatch({type: 'SMART_SET_PHASE', payload: 'completed'});
		if (currentAlgorithm) {
			addTime(algToId(currentAlgorithm.algorithm), finalTime);
		}
		setTimeout(() => dispatch({type: 'ADVANCE_ALGORITHM'}), 150);
	}, [timerStartedAt, currentAlgorithm, dispatch]);

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
					// Manual stop — user intuitively solved the cube
					stopSmartByHand();
				}
				return;
			}

			if (timerState === 'RUNNING') {
				stopTimer();
			} else if (timerState === 'STOPPED') {
				handleAdvance(); // ADVANCE_ALGORITHM reducer sets to IDLE
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
	}, [timerState, isSmartMode, stopTimer, startTimer, handleAdvance, dispatch, state.smartPhase, stopSmartByHand]);

	const handleTouch = useCallback(() => {
		if (isSmartMode) {
			if (timerState === 'STOPPED') {
				handleAdvance();
			} else if (state.smartPhase === 'solving') {
				stopSmartByHand();
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
	}, [timerState, isSmartMode, stopTimer, startTimer, handleAdvance, state.smartPhase, stopSmartByHand]);

	return (
		<div
			className={b('timer', {
				ready: timerState === 'READY',
				running: timerState === 'RUNNING',
				stopped: timerState === 'STOPPED',
			})}
			onClick={handleTouch}
		>
			<LiveTime
				as="div"
				className={b('timer-value')}
				running={timerState === 'RUNNING'}
				read={() => formatTime(Date.now() - timerStartedAt)}
				text={formatTime(currentTimerValue)}
			/>
			{timerState === 'IDLE' && currentAlgorithm && !isSmartMode && (
				<div className={b('timer-hint')}>Space</div>
			)}
			{isSmartMode && state.smartPhase === 'ready' && (
				<div className={b('timer-hint')}>{t('trainer.ble_make_first_move')}</div>
			)}
			{isSmartMode && state.smartPhase === 'scrambling' && (
				<div className={b('timer-hint')}>{t('trainer.ble_scramble_first')}</div>
			)}
		</div>
	);
}
