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
import { hapticImpact } from '../../../util/native-plugins';
import { isMultiPhaseActive } from '../../../../shared/util/solve/multiphase';
import { useSettings } from '../../../util/hooks/useSettings';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { getSettings } from '../../../db/settings/query';
import { getTimerStore } from '../../../util/store/getTimer';
import { fetchLastSolve, buildBucketFilter } from '../../../db/solves/query';
import { deleteAllSolvesInSessionDb, deleteSolveDb } from '../../../db/solves/update';
import { toggleDnfSolveDb, togglePlusTwoSolveDb } from '../../../db/solves/operations';
import { useSlamToStop } from '../../../util/slam-stop/useSlamToStop';

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
	// stackmat + qiyiwired share common audio path (vendor/stackmat.js), keyboard interaction same
	const stackMatOn = timerType === 'stackmat' || timerType === 'qiyiwired';
	// Hardware timers (GAN Timer + QiYi Timer) disable keyboard
	const ganTimerOn = timerType === 'gantimer' || timerType === 'qiyitimer';
	const inspection = useSettings('inspection');
	const manualEntry = useSettings('manual_entry');
	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');
	const multiPhaseCount = useSettings('multi_phase_count');

	// Slam-to-stop: native-only extra stop trigger for the touch timer
	useSlamToStop(context);

	useWindowListener('keyup', keyupSpace);
	useWindowListener('keydown', keydownSpace);
	useWindowListener('keydown', handleGlobalShortcuts);
	useDocumentListener('keyup', escapePressed);
	// Touch start/move/end needs passive: false to allow e.preventDefault()
	useWindowListener('touchstart', touchStart, [], { passive: false });
	useWindowListener('touchend', touchEnd, [], { passive: false });

	useEffect(() => {
		configureHotkeys();
		setTimerParam('startEnabled', true);
	}, []);

	const touchStartX = React.useRef<number | null>(null);
	const touchStartY = React.useRef<number | null>(null);

	// True from the moment a key press stops the timer until every key is released again.
	// Without it, the same physical press that stopped the timer keeps producing keydown
	// events (OS auto-repeat, or a second key still held down), which re-primes the timer
	// and restarts it on release.
	const stopKeyHeldRef = React.useRef(false);

	// Window blur (alt-tab) swallows the keyup, so clear the flag defensively
	useWindowListener('blur', () => {
		stopKeyHeldRef.current = false;
	});

	function handleContextMenu(e) {
		let target = e.target;
		while (target && target !== document) {
			if (target.classList && target.classList.contains(timerClass())) {
				e.preventDefault();
				return;
			}
			target = target.parentNode;
		}
	}

	useWindowListener('contextmenu', handleContextMenu);
	useWindowListener('touchmove', touchMove, [], { passive: false });

	function touchStart(e) {
		// Right edge dead zone — sag notch area, timer should not trigger
		if (e.touches?.[0] && window.innerWidth - e.touches[0].clientX < 20) {
			return;
		}
		// Left edge dead zone — sol notch area (LeftSettingsDrawer)
		if (e.touches?.[0] && e.touches[0].clientX < 20) {
			return;
		}

		// Capture touch event timestamp BEFORE DOM traversal — for mobile timing accuracy
		// Touch event timestamp: use earlier of two sources (for iOS WKWebView IPC delay)
		const eventTs = Math.round(Math.min(performance.timeOrigin + e.timeStamp, Date.now()));

		let target = e.target;
		let insideTimer = false;

		while (target && target !== document) {
			if (target.nodeName === 'BUTTON' || target.nodeName === 'TEXTAREA' || target.nodeName === 'INPUT') {
				return;
			}

			if (target.classList && (
				target.classList.contains('cd-timer-controls__left') ||
				target.classList.contains('cd-timer-controls__right') ||
				target.classList.contains('cd-timer-header-control') ||
				target.classList.contains('cd-timer-dashboard') ||
				target.classList.contains('cd-stats-bar') ||
				target.classList.contains('cd-mobile-timer-scramble__text') ||
				target.classList.contains('cd-mobile-timer-scramble__smart-scramble') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded-text') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded-copy') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded-close')
			)) {
				return;
			}

			if (target.classList && target.classList.contains(timerClass())) {
				insideTimer = true;
			}

			target = target.parentNode;
		}

		if (insideTimer) {
			if (e.touches && e.touches[0]) {
				touchStartX.current = e.touches[0].clientX;
				touchStartY.current = e.touches[0].clientY;
			}
			keydownSpace(e, true, eventTs);
		}
	}

	function touchEnd(e) {
		if (e.touches && e.touches.length > 0) return;

		// Right edge dead zone — sag notch area
		if (e.changedTouches?.[0] && window.innerWidth - e.changedTouches[0].clientX < 20) {
			return;
		}
		// Left edge dead zone — sol notch area
		if (e.changedTouches?.[0] && e.changedTouches[0].clientX < 20) {
			return;
		}

		// Touch event timestamp: use earlier of two sources (for iOS WKWebView IPC delay)
		const eventTs = Math.round(Math.min(performance.timeOrigin + e.timeStamp, Date.now()));

		touchStartX.current = null;
		touchStartY.current = null;
		let target = e.target;
		let insideTimer = false;

		while (target && target !== document) {
			if (target.nodeName === 'BUTTON' || target.nodeName === 'TEXTAREA' || target.nodeName === 'INPUT') {
				return;
			}

			if (target.classList && (
				target.classList.contains('cd-timer-controls__left') ||
				target.classList.contains('cd-timer-controls__right') ||
				target.classList.contains('cd-timer-header-control') ||
				target.classList.contains('cd-timer-dashboard') ||
				target.classList.contains('cd-stats-bar') ||
				target.classList.contains('cd-mobile-timer-scramble__text') ||
				target.classList.contains('cd-mobile-timer-scramble__smart-scramble') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded-text') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded-copy') ||
				target.classList.contains('cd-mobile-timer-scramble__expanded-close')
			)) {
				return;
			}

			if (target.classList && target.classList.contains(timerClass())) {
				insideTimer = true;
			}

			target = target.parentNode;
		}

		if (insideTimer) {
			keyupSpace(e, true, eventTs);
		}
	}

	function touchMove(e) {
		if (touchStartX.current === null || touchStartY.current === null) return;
		if (!spaceTimerStarted && !inInspection) return;

		const y = e.touches[0].clientY;
		// const diffX = Math.abs(e.touches[0].clientX - touchStartX.current); // No longer needed for logic

		// Only cancel if swiping UP significantly (e.g. > 100px)
		// This allows user to jitter their finger or move side-to-side without cancelling
		if (touchStartY.current - y > 100) {
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

	/**
	 * Records a mid-solve phase split. Returns true when the press was consumed as a
	 * split, meaning the timer must keep running.
	 */
	function recordPhaseSplit(eventTimestamp?: number): boolean {
		if (!isMultiPhaseActive(multiPhaseCount) || !timeStartedAt) {
			return false;
		}

		// A smart cube derives its own breakdown from move data, which is both finer and
		// free of reaction time. Hardware timers never reach this handler at all.
		if (smartCubeSelected(context)) {
			return false;
		}

		// Never swallow the stop press in a head-to-head solve: a forgotten setting would
		// otherwise cost the user the round.
		if (context.matchMode) {
			return false;
		}

		// Read from the store rather than context: two presses can land inside a single
		// React render, and a stale array would overwrite the previous split.
		const splits = getTimerStore('phaseSplits') || [];
		if (splits.length >= multiPhaseCount - 1) {
			return false;
		}

		const now = Date.now();
		const pressedAt = (eventTimestamp && (now - eventTimestamp) < 2000) ? eventTimestamp : now;
		const previous = splits.length ? splits[splits.length - 1] : 0;
		// Splits must stay strictly ascending — the display and the duration maths both
		// assume it, and a clock adjustment mid-solve could otherwise invert two entries.
		const elapsed = Math.max(pressedAt - timeStartedAt.getTime(), previous + 1);

		setTimerParam('phaseSplits', [...splits, elapsed]);
		hapticImpact('light');
		return true;
	}

	function keydownSpace(e, touch = false, eventTimestamp?: number) {
		const freezeTime = getSettings().freeze_time;

		if (e.key === 'Escape') return;

		// OS auto-repeat while a key stays held down — never a new user intent
		if (e.repeat) return;

		const solveOpen = modals.length > 1 || (!inModal && modals.length);

		// Checking for various conditions where we don't want to start the timer
		if (ganTimerOn || stackMatOn || solveOpen || !startEnabled || timerDisabled || disabled || editScramble || (smartCubeSelected(context) && !useSpaceWithSmartCube)) {
			return;
		}

		// Don't trigger if user is typing in an input
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		const validCubeType = getCubeTypeInfoById(cubeType);

		if (!validCubeType) {
			return;
		}

		if (timeStartedAt) {
			e.preventDefault();
			// Block re-priming until the key that stopped the timer is released
			if (!touch) {
				stopKeyHeldRef.current = true;
			}

			// Multi-phase: the first count-1 presses close a phase and leave the timer
			// running. Only the last press falls through and stops the solve.
			if (recordPhaseSplit(eventTimestamp)) {
				return;
			}

			endTimer(context, undefined, undefined, eventTimestamp);

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
		if (stackMatOn) return;

		// A key from the press that just stopped the timer is still down — ignore it
		if (!touch && stopKeyHeldRef.current) return;

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
					// Priming may have been cancelled while this was pending (timer stopped,
					// escape, swipe cancel). Reading Redux instead of the captured closure keeps
					// canStart from ever going green without a live spaceTimerStarted — keyup
					// bails out on !spaceTimerStarted, so that combination is a green light
					// that can never start the timer.
					if (!getTimerStore('spaceTimerStarted')) {
						return;
					}

					setTimerParams({
						canStart: true,
					});
				}, freezeTime * 1000)
			);
		}
	}

	function keyupSpace(e, touch = false, eventTimestamp?: number) {
		const freezeTime = getSettings().freeze_time;

		// Any key release ends the "stopped the timer with this press" block
		stopKeyHeldRef.current = false;

		// Don't trigger if user is typing in an input
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			return;
		}

		if (ganTimerOn || stackMatOn || (e.keyCode !== 32 && !touch) || !spaceTimerStarted || manualEntry) return;

		if (getTimer(START_TIMEOUT)) {
			stopTimer(START_TIMEOUT);
		}

		if (inspection && !inInspection) {
			startInspection(context);
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
			if (inInspection && context.dnfTime) {
				return;
			}
			startTimer(undefined, eventTimestamp);
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
		if (e.code !== 'Escape' && e.keyCode !== 27) {
			return;
		}
		// If hardware timer (GAN/QiYi) running doesn't respond to device reset button,
		// user can cancel Zkt-Timer with Escape. Subsequently, STOPPED/record_time event
		// from device will be ignored by endTimer's `!timeStartedAt` check.

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
			return;
		}

	}

	function handleGlobalShortcuts(e) {
		if (modals.length > 0) return;

		const target = e.target;
		if (target.nodeName === 'INPUT' || target.nodeName === 'TEXTAREA' || target.isContentEditable) return;

		// Block shortcuts only during active timer/inspection (not when smart cube is idle)
		if (timeStartedAt || inInspection || spaceTimerStarted) {
			return;
		}

		const settings = getSettings();
		const sessId = settings.session_id;

		// All shortcuts operate on the current bucket's last solve (cube_type +
		// subset), not the session-global last solve — otherwise switching cube
		// type/subset would target a solve from a different bucket's view.
		const bucketFilter = buildBucketFilter({
			session_id: sessId,
			cube_type: settings.cube_type,
			scramble_subset: settings.scramble_subset,
		});

		// +2
		if (e.key === '2') {
			const lastSolve = fetchLastSolve(bucketFilter);
			if (lastSolve) togglePlusTwoSolveDb(lastSolve);
		}
		// DNF
		else if (e.key.toLowerCase() === 'd') {
			const lastSolve = fetchLastSolve(bucketFilter);
			if (lastSolve) toggleDnfSolveDb(lastSolve);
		}
		// Delete (Backspace)
		else if (e.key === 'Backspace') {
			if (e.ctrlKey) {
				deleteAllSolvesInSessionDb(sessId);
			} else {
				const lastSolve = fetchLastSolve(bucketFilter);
				if (lastSolve) deleteSolveDb(lastSolve);
			}
		}
	}

	return (
		<GlobalHotKeys handlers={HOTKEY_HANDLERS} keyMap={HOTKEY_MAP}>
			{props.children}
		</GlobalHotKeys>
	);
}
