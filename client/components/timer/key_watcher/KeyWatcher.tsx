import React, { ReactNode, useContext, useEffect } from 'react';
import { HOTKEY_MAP } from '../../../util/timer/hotkeys';
import { GlobalHotKeys } from 'react-hotkeys';
import {
	clearInspectionTimers,
	getTimer,
	INSPECTION_GRACE_PERIOD_TIMEOUT,
	setTimer,
	START_TIMEOUT,
	stopTimer,
} from '../helpers/timers';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { configureHotkeys } from '../helpers/hotkeys';
import { TimerContext } from '../Timer';
import { smartCubeSelected } from '../helpers/util';
import { setTimerParam, setTimerParams } from '../helpers/params';
import block from '../../../styles/bem';
import { endTimer, resetTimerParams, startTimer, startInspection } from '../helpers/events';
import { useDocumentListener, useWindowListener } from '../../../util/hooks/useListener';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { getSettings } from '../../../db/settings/query';

const timerClass = block('timer');

interface Props {
	children: ReactNode;
}

export default function KeyWatcher(props: Props) {
	const context = useContext(TimerContext);
	const {
		cubeType,
		disabled,
		timerDisabled,
		editScramble,
		timeStartedAt,
		inModal,
		inInspection,
		spaceTimerStarted,
		startEnabled,
	} = context;

	const HOTKEY_HANDLERS = {
		RESET_INSPECTION: () => {
			clearInspectionTimers(true, true);
		},
	};

	const modals = useGeneral('modals');
	const timerType = useSettings('timer_type');
	const stackMatOn = timerType === 'stackmat';
	const ganTimerOn = timerType === 'gantimer';
	const inspection = useSettings('inspection');
	const manualEntry = useSettings('manual_entry');

	useWindowListener('keyup', keyupSpace);
	useWindowListener('keydown', keydownSpace);
	useDocumentListener('keyup', escapePressed);
	useWindowListener('touchstart', touchStart);
	useWindowListener('touchend', touchEnd);

	useEffect(() => {
		configureHotkeys();
		setTimerParam('startEnabled', true);
	}, []);

	const touchStartX = React.useRef<number | null>(null);
	const touchStartY = React.useRef<number | null>(null);

	function handleContextMenu(e) {
		let target = e.target;
		while (target.parentNode) {
			if (target.classList.contains(timerClass('main'))) {
				e.preventDefault();
				return;
			}
			target = target.parentNode;
		}
	}

	useWindowListener('contextmenu', handleContextMenu);
	useWindowListener('touchmove', touchMove);

	function touchStart(e) {
		let target = e.target;

		while (target.parentNode) {
			if (target.nodeName === 'BUTTON' || target.nodeName === 'TEXTAREA' || target.nodeName === 'INPUT') {
				return;
			}

			if (target.classList.contains(timerClass('main'))) {
				if (e.touches && e.touches[0]) {
					touchStartX.current = e.touches[0].clientX;
					touchStartY.current = e.touches[0].clientY;
				}
				keydownSpace(e, true);
				return;
			}

			target = target.parentNode;
		}
	}

	function touchEnd(e) {
		touchStartX.current = null;
		touchStartY.current = null;
		let target = e.target;

		while (target.parentNode) {
			if (target.classList.contains(timerClass('main'))) {
				keyupSpace(e, true);
				return;
			}

			target = target.parentNode;
		}
	}

	function touchMove(e) {
		if (touchStartX.current === null || touchStartY.current === null) return;
		if (!spaceTimerStarted && !inInspection) return; // Only if we are holding to start or in inspection?
		// Actually, spaceTimerStarted > 0 means we are holding down to start.
		// If we slide, we want to cancel this hold.

		const x = e.touches[0].clientX;
		const y = e.touches[0].clientY;
		const diffX = Math.abs(x - touchStartX.current);
		const diffY = Math.abs(y - touchStartY.current);

		if (diffX > 20 || diffY > 20) {
			// Cancel the timer start hold
			if (spaceTimerStarted) {
				setTimerParams({
					spaceTimerStarted: 0,
					canStart: false,
				});
				if (getTimer(START_TIMEOUT)) {
					stopTimer(START_TIMEOUT);
				}
			}
			touchStartX.current = null;
			touchStartY.current = null;
		}
	}

	function keydownSpace(e, touch = false) {
		const freezeTime = getSettings().freeze_time;

		if (e.key === 'Escape') return;

		const solveOpen = modals.length > 1 || (!inModal && modals.length);

		// Checking for various conditions where we don't want to start the timer
		if (ganTimerOn || solveOpen || !startEnabled || timerDisabled || disabled || editScramble || smartCubeSelected(context)) {
			return;
		}

		const validCubeType = getCubeTypeInfoById(cubeType);

		if (!validCubeType) {
			return;
		}

		if (timeStartedAt) {
			e.preventDefault();
			endTimer(context);

			if (inspection) {
				setTimer(
					INSPECTION_GRACE_PERIOD_TIMEOUT,
					setTimeout(() => {
						stopTimer(INSPECTION_GRACE_PERIOD_TIMEOUT);
					}, 250)
				);
			}

			return;
		}

		// 32 is for space
		if ((e.keyCode !== 32 && !touch) || manualEntry) {
			return;
		}
		if ((!inspection && stackMatOn) || (stackMatOn && inspection && inInspection)) return;

		e.preventDefault();

		if (!spaceTimerStarted) {
			const now = new Date();

			if (inspection && !inInspection) {
				if (getTimer(INSPECTION_GRACE_PERIOD_TIMEOUT)) return;

				setTimerParams({
					spaceTimerStarted: now.getTime(),
					canStart: true,
				});

				return;
			}

			setTimerParams({
				spaceTimerStarted: now.getTime(),
			});

			setTimer(
				START_TIMEOUT,
				setTimeout(() => {
					setTimerParams({
						canStart: true,
					});
				}, freezeTime * 1000)
			);
		}
	}

	function keyupSpace(e, touch = false) {
		const freezeTime = getSettings().freeze_time;

		if (ganTimerOn || (e.keyCode !== 32 && !touch) || !spaceTimerStarted || manualEntry) return;

		if (getTimer(START_TIMEOUT)) {
			stopTimer(START_TIMEOUT);
		}

		if (inspection && !inInspection) {
			startInspection();
			setTimerParams({
				spaceTimerStarted: 0,
				canStart: false,
			});
			return;
		}

		const now = new Date();
		setTimerParams({
			spaceTimerStarted: 0,
			canStart: false,
		});

		// Ignore events where space was held for less than .5s
		if (now.getTime() - spaceTimerStarted < freezeTime * 1000) return;

		if (inInspection || !inspection) {
			startTimer();
		}
	}

	/**
	 * When escape key is pressed
	 * - End timer if it has started
	 * - If in inspection countdown, stop inspection
	 * - Reset scramble
	 * - Reset timer state data (startedAt, endedAt, etc.)
	 *
	 * @param e
	 */
	function escapePressed(e) {
		if (ganTimerOn || (e.code !== 'Escape' && e.keyCode !== 27)) {
			return;
		}

		e.preventDefault();

		// Case 1: Priming (Holding space/touch to start)
		if (spaceTimerStarted) {
			if (getTimer(START_TIMEOUT)) {
				stopTimer(START_TIMEOUT);
			}
			setTimerParams({
				spaceTimerStarted: 0,
				canStart: false,
			});
			return;
		}

		// Case 2: Inspection
		if (inInspection) {
			clearInspectionTimers(true, true);
			return;
		}

		// Case 3: Timing (or Smart Cube solving)
		if (smartCubeSelected(context) || timeStartedAt) {
			resetTimerParams(context);
		}
	}

	return (
		<GlobalHotKeys handlers={HOTKEY_HANDLERS} keyMap={HOTKEY_MAP}>
			{props.children}
		</GlobalHotKeys>
	);
}
