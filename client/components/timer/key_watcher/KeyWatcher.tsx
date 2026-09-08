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
import { virtualCubeOwnsKeyboard, virtualCubeSelected } from '../helpers/virtual_cube';
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
import { classifyTouchTarget } from '../helpers/touch_target';
import { isCancelSwipe } from '../helpers/touch_gesture';

const timerClass = block('timer');

// Hoisted so the identity is stable. useElementListener keys its registration effect on
// the options object, so a fresh literal per render detaches and re-attaches all three
// touch listeners on every render — and inspection re-renders ten times a second.
const PASSIVE_FALSE: AddEventListenerOptions = { passive: false };

// Width of the left/right notch strips the EdgeDrawer owns. A press that lands here is
// reaching for the menu, not the timer — but only where starting is concerned.
const EDGE_DEAD_ZONE_PX = 20;

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
	const mobileMode = useGeneral('mobile_mode');
	// Mirrors the branch Timer uses to pick its body, so the touch rules always match
	// the DOM that is actually on screen.
	const mobileLayout = (context.forceMobileLayout ?? mobileMode) && !inModal;
	const timerType = useSettings('timer_type');
	// StackMat and QYtoys are one input now (shared audio path, vendor/stackmat.js).
	const stackMatOn = timerType === 'stackmat';
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
	useWindowListener('touchstart', touchStart, [], PASSIVE_FALSE);
	useWindowListener('touchend', touchEnd, [], PASSIVE_FALSE);

	useEffect(() => {
		configureHotkeys();
		setTimerParam('startEnabled', true);
	}, []);

	const touchStartX = React.useRef<number | null>(null);
	const touchStartY = React.useRef<number | null>(null);

	// Set when a hold is dropped mid-gesture (moved too far, or the OS cancelled it), so
	// the release that follows can't still start a solve.
	const touchPrimingCancelledRef = React.useRef(false);

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
	useWindowListener('touchmove', touchMove, [], PASSIVE_FALSE);
	useWindowListener('touchcancel', touchCancel);

	/** Within a notch strip reserved for the left/right EdgeDrawer swipe. */
	function inEdgeDeadZone(touch: { clientX: number } | undefined): boolean {
		if (!touch) return false;
		return touch.clientX < EDGE_DEAD_ZONE_PX || window.innerWidth - touch.clientX < EDGE_DEAD_ZONE_PX;
	}

	function touchStart(e) {
		// The edge dead zones reserve the EdgeDrawer notches so a swipe for the menu can
		// never start a solve. They must not apply to a running solve: stopping is
		// permissive by design, and a stop the timer refuses to take costs a real time.
		if (!getTimerStore('timeStartedAt') && inEdgeDeadZone(e.touches?.[0])) {
			return;
		}

		// Capture touch event timestamp BEFORE DOM traversal — for mobile timing accuracy
		// Touch event timestamp: use earlier of two sources (for iOS WKWebView IPC delay)
		const eventTs = Math.round(Math.min(performance.timeOrigin + e.timeStamp, Date.now()));

		if (!touchDrivesTimer(e.target)) {
			return;
		}

		touchPrimingCancelledRef.current = false;

		if (e.touches && e.touches[0]) {
			touchStartX.current = e.touches[0].clientX;
			touchStartY.current = e.touches[0].clientY;
		}
		keydownSpace(e, true, eventTs);
	}

	/**
	 * Whether a touch on this element may drive the timer.
	 *
	 * Stopping stays permissive: while a solve runs, any touch inside the timer ends it.
	 * Starting one is restricted to the timer's own surface on the desktop layout, where
	 * the footer modules, the scramble and the 3D cube live in the same subtree — that
	 * shared subtree is what made tablets start solves on a stats tap. Gesture islands
	 * (scramble, 3D cube) never prime in either layout: dragging a cube around is never
	 * an intent to start a solve.
	 */
	function touchDrivesTimer(target: any): boolean {
		// The virtual cube is turned by gestures on its own canvas and armed by a tap
		// outside it, so the generic touch-to-start path must not also fire.
		if (virtualCubeSelected(context)) {
			return false;
		}

		const { blocked, insideTimer, onStartSurface, inNonStartIsland } = classifyTouchTarget(target);

		if (blocked || !insideTimer) {
			return false;
		}

		// Redux, not the render closure: a release can land before React delivered the
		// state the press produced, and a stale `timeStartedAt` would misclassify it.
		if (!getTimerStore('timeStartedAt') && (inNonStartIsland || (!mobileLayout && !onStartSurface))) {
			return false;
		}

		return true;
	}

	function touchEnd(e) {
		// A finger is still down — this is the first thumb of a two-thumb start lifting,
		// so the hold stays armed and the LAST release is the one that counts. The bails
		// below are the opposite case: no finger left, so they must disarm. Leaving them
		// armed used to strand the timer green with nothing on screen, unable to start
		// until the user pressed a second time.
		if (e.touches && e.touches.length > 0) return;

		// Same rule as touchStart: the notch zones only guard against starting.
		if (!getTimerStore('timeStartedAt') && inEdgeDeadZone(e.changedTouches?.[0])) {
			return abandonTouch();
		}

		// Touch event timestamp: use earlier of two sources (for iOS WKWebView IPC delay)
		const eventTs = Math.round(Math.min(performance.timeOrigin + e.timeStamp, Date.now()));

		touchStartX.current = null;
		touchStartY.current = null;

		// The hold was already dropped mid-gesture — this release is not a start
		const primingCancelled = touchPrimingCancelledRef.current;
		touchPrimingCancelledRef.current = false;
		if (primingCancelled) {
			return;
		}

		if (!touchDrivesTimer(e.target)) {
			return abandonTouch();
		}

		keyupSpace(e, true, eventTs);
	}

	/**
	 * Gives up on a touch without starting anything, leaving no armed state behind.
	 * Used by every `touchEnd` bail: the finger is gone, so a hold that was priming the
	 * timer must not survive it.
	 */
	function abandonTouch() {
		touchStartX.current = null;
		touchStartY.current = null;
		touchPrimingCancelledRef.current = false;
		disarmPriming();
	}

	function touchMove(e) {
		if (touchStartX.current === null || touchStartY.current === null) return;
		if (!getTimerStore('spaceTimerStarted') && !getTimerStore('inInspection')) return;

		const touch = e.touches[0];
		if (!touch) return;

		const diffX = touch.clientX - touchStartX.current;
		const diffY = touch.clientY - touchStartY.current;

		// Sliding the finger UP is how a cuber says "not this one after all". Movement in
		// any other direction is just the hand settling or lifting, and must never cost
		// the solve. Surfaces that own their gestures (scramble, 3D cube, dashboard) are
		// kept out of priming by classifyTouchTarget, so distance alone is not needed as
		// a second line of defence here.
		if (isCancelSwipe(diffX, diffY)) {
			cancelPriming();

			touchStartX.current = null;
			touchStartY.current = null;
		}
	}

	/**
	 * Drops a hold that was priming the timer. The press itself is over as far as the
	 * timer is concerned, so the release that follows starts nothing.
	 */
	function cancelPriming() {
		// Only swallow the coming release if there was actually a hold to drop, otherwise
		// an idle drag across the screen would eat the next legitimate start.
		if (!disarmPriming()) {
			return;
		}

		// The release lands in the same gesture, possibly before a re-render delivered
		// the cleared state, so the ref is what keyupSpace's caller trusts.
		touchPrimingCancelledRef.current = true;
	}

	/**
	 * Clears the primed state and its pending green light. Returns whether anything was
	 * actually armed. Reads Redux rather than the captured closure, because a press and
	 * its release can share a frame.
	 */
	function disarmPriming(): boolean {
		if (!getTimerStore('spaceTimerStarted')) {
			return false;
		}

		setTimerParams({
			spaceTimerStarted: 0,
			canStart: false,
		});

		if (getTimer(START_TIMEOUT)) {
			stopTimer(START_TIMEOUT);
		}

		return true;
	}

	/**
	 * The OS can swallow a touch mid-hold (system gesture, incoming call, palm
	 * rejection). Without this the priming state would stay armed with no finger on
	 * screen, leaving the timer green until some unrelated release started a solve.
	 */
	function touchCancel() {
		cancelPriming();

		touchStartX.current = null;
		touchStartY.current = null;
	}

	/**
	 * Records a mid-solve phase split. Returns true when the press was consumed as a
	 * split, meaning the timer must keep running.
	 */
	function recordPhaseSplit(eventTimestamp?: number): boolean {
		// Store, not context — keydownSpace decided a solve was running from the store,
		// so this has to agree with it or a split press falls through and stops the solve.
		const timeStartedAt = getTimerStore('timeStartedAt');
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

		// Timer state comes from the store, not the render closure. A press and its
		// release can both land before React has re-rendered KeyWatcher and swapped the
		// listener's saved handler (useListener does that in a passive effect), which is
		// why the values destructured at the top of this component can be a gesture
		// behind. That is invisible while freeze_time forces a long hold, and constant
		// with freeze_time at 0 where the whole press lasts a few milliseconds.
		const timeStartedAt = getTimerStore('timeStartedAt');
		const spaceTimerStarted = getTimerStore('spaceTimerStarted');
		const inInspection = getTimerStore('inInspection');

		if (e.key === 'Escape') return;

		// OS auto-repeat while a key stays held down — never a new user intent
		if (e.repeat) return;

		const solveOpen = modals.length > 1 || (!inModal && modals.length);

		// Checking for various conditions where we don't want to start the timer
		// The virtual cube handles Space itself, in both the idle and the armed case:
		// there it applies the scramble and arms rather than priming a hold, and it
		// never stops the timer. So this handler must never see it.
		if (ganTimerOn || stackMatOn || solveOpen || !startEnabled || timerDisabled || disabled || editScramble || virtualCubeSelected(context) || (smartCubeSelected(context) && !useSpaceWithSmartCube)) {
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

		// Read through the store for the same reason keydownSpace does — this is the
		// half that actually starts the solve, so a stale `spaceTimerStarted` here means
		// a press that primed the timer, turned it green, and then started nothing.
		const spaceTimerStarted = getTimerStore('spaceTimerStarted');
		const inInspection = getTimerStore('inInspection');

		// Any key release ends the "stopped the timer with this press" block
		stopKeyHeldRef.current = false;

		// Don't trigger if user is typing in an input
		const target = e.target as HTMLElement;
		if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
			// The release is gone but the hold is not: disarm, or the timer sits green
			// with nothing pressed and refuses to start on the next press.
			disarmPriming();
			return;
		}

		// Modes where this handler can never start a solve: a hold left over from before
		// the mode changed has to be cleared, not left glowing.
		if (ganTimerOn || stackMatOn || manualEntry || virtualCubeSelected(context)) {
			disarmPriming();
			return;
		}

		// Releasing some other key while space is held is not the end of the hold, so this
		// one must stay a plain bail.
		if ((e.keyCode !== 32 && !touch) || !spaceTimerStarted) return;

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
			if (inInspection && getTimerStore('dnfTime')) {
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

		// The virtual cube's Escape has to record a DNF with the elapsed time, which
		// this handler would silently discard by resetting the timer instead.
		if (virtualCubeSelected(context)) {
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

		// While the virtual cube is armed these are moves, not shortcuts: `d` is L,
		// `2` is E, and Backspace would delete the previous solve. They all fire on
		// `timeStartedAt === null`, which is the whole armed window.
		if (virtualCubeOwnsKeyboard()) return;

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
