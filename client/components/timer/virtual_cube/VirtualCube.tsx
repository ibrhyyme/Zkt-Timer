import React, { useContext, useEffect, useRef } from 'react';
import { X } from 'phosphor-react';
import { useTranslation } from 'react-i18next';

import {
	getVirtualStepCount,
	getVirtualStepNames,
	VirtualProgressMethod,
} from '../../../../shared/util/solve/virtual_progress';
import { serializeSmartTurnsCompact } from '../../../../shared/smart_cube/parse_turns';
import { serializePhaseSplits } from '../../../../shared/util/solve/multiphase';
import { useGeneral } from '../../../util/hooks/useGeneral';
import block from '../../../styles/bem';
import { useSettings } from '../../../util/hooks/useSettings';
import { useWindowListener } from '../../../util/hooks/useListener';
import { getTimerStore } from '../../../util/store/getTimer';
import { KEY_ESCAPE, KEY_SPACE } from '../../../util/virtual_cube/key_mapping';
import { isRotation, move2str } from '../../../util/virtual_cube/notation';
import { parseVirtualScramble } from '../../../util/virtual_cube/parse_scramble';
import { getVirtualCubeSize, isBldSubset } from '../../../util/virtual_cube/size';
import { useVirtualCubeSize } from '../../../util/virtual_cube/useVirtualCubeSize';
import type { MoveStep, VrcMove } from '../../../util/virtual_cube/types';
import { endTimer, startInspection, startTimer } from '../helpers/events';
import { clearInspectionTimers, START_TIMEOUT, stopTimer } from '../helpers/timers';
import { saveSolve } from '../helpers/save';
import { setTimerParams } from '../helpers/params';
import { classifyTouchTarget } from '../helpers/touch_target';
import { ITimerContext, TimerContext } from '../Timer';
import VirtualCubeView, { VirtualCubeViewHandle } from './VirtualCubeView';

import './VirtualCube.scss';

// Matches the block VirtualCubeView renders, so a tap can be tested for being
// inside the cube itself rather than on the timer surface around it.
const b = block('virtual-cube');

// Hoisted so the identity is stable: useElementListener keys its registration
// effect on the options object, and a fresh literal per render would detach and
// re-attach the listener on every render.
const KEY_CAPTURE: AddEventListenerOptions = { capture: true };

/**
 * The virtual cube controller: cstimer's `timer/virtual.js` state machine.
 *
 * Owns every decision; VirtualCubeView owns every pixel.
 *
 * The flow, unchanged from the reference:
 *   Space           applies the current scramble to the cube and arms it
 *   first real move starts the timer (rotations are free, so you can look around)
 *   solved          stops the timer and saves the solve
 *   Escape          records a DNF mid-solve, or just disarms while armed
 *
 * cstimer's `timer.status()` is not stored here. It is derived:
 *   -1 idle        !virtualArmed && !timeStartedAt
 *   -2 ready       virtualArmed && !inInspection && !timeStartedAt
 *   -3 inspecting  virtualArmed && inInspection && !timeStartedAt
 *   >=1 running    timeStartedAt !== null, with the remaining phase count in a ref
 */

/** One recorded move: notation plus milliseconds since the timer started. */
interface RecordedMove {
	turn: string;
	completedAt: number;
}

export default function VirtualCube() {
	const { t } = useTranslation();
	const context = useContext(TimerContext);
	const contextRef = useRef<ITimerContext>(context);
	contextRef.current = context;

	const viewRef = useRef<VirtualCubeViewHandle>(null);

	const speed = useSettings('virtual_cube_speed');
	const orientation = useSettings('virtual_cube_orientation');
	const keyboardLayout = useSettings('virtual_cube_keyboard_layout');
	const bigVisibility = useSettings('virtual_cube_big_visibility');
	const multiPhase = useSettings('virtual_cube_multi_phase') as VirtualProgressMethod;
	const inspectionEnabled = useSettings('inspection');
	const modals = useGeneral('modals');
	const mobileMode = useGeneral('mobile_mode');

	const { cubeType, scrambleSubset, scramble } = context;
	const dimension = getVirtualCubeSize(cubeType, scrambleSubset) ?? 3;
	const isBld = isBldSubset(scrambleSubset);

	// Armed or solving: the chrome is hidden and the cube owns the screen.
	const focusMode = !!context.virtualArmed || !!context.timeStartedAt;
	const effectiveSize = useVirtualCubeSize(mobileMode, focusMode);

	// Turning the cube before the scramble is applied means rearranging a solved
	// cube for no reason, and Space throws it away again a moment later. The
	// keyboard has always been gated this way; the touch grid has to match.
	const gestureEnabled = focusMode;

	// Solve-scoped state. All refs: the move listener and the key handler both run
	// outside React's render cycle and must never read a stale closure.
	const movesRef = useRef<RecordedMove[]>([]);
	const phaseSplitsRef = useRef<number[]>([]);
	const remainingRef = useRef(1);
	const moveCountRef = useRef(0);

	const modalsRef = useRef(modals);
	modalsRef.current = modals;
	const multiPhaseRef = useRef(multiPhase);
	multiPhaseRef.current = multiPhase;
	const isBldRef = useRef(isBld);
	isBldRef.current = isBld;

	function armed(): boolean {
		return !!getTimerStore('virtualArmed');
	}

	function running(): boolean {
		return !!getTimerStore('timeStartedAt');
	}

	function disarm() {
		setTimerParams({ virtualArmed: false });
	}

	/**
	 * Apply the current scramble instantly and arm.
	 * Port of `scrambleIt` (virtual.js:119-134).
	 *
	 * Instant regardless of the animation speed: the scramble is a starting
	 * position, not something the solver is meant to watch.
	 */
	function scrambleIt() {
		const view = viewRef.current;
		if (!view) return;

		view.reset();
		const moves = parseVirtualScramble(contextRef.current.scramble || '');
		view.applyMoves(moves);
		view.moveCnt(true);

		movesRef.current = [];
		phaseSplitsRef.current = [];
		moveCountRef.current = 0;
		remainingRef.current = 1;
	}

	/**
	 * Return the cube to the scrambled state without touching the timer.
	 * Used when the solve is abandoned, mirroring cstimer keeping the puzzle
	 * scrambled so the user can retry the same scramble.
	 */
	function restoreScramble() {
		const view = viewRef.current;
		if (!view) return;
		view.reset();
		view.applyMoves(parseVirtualScramble(contextRef.current.scramble || ''));
		view.moveCnt(true);
		view.toggleColorVisible(true);
		movesRef.current = [];
		phaseSplitsRef.current = [];
		moveCountRef.current = 0;
	}

	/**
	 * Record phase boundaries. Port of `updateMulPhase` (timer.js:70-77).
	 *
	 * Progress counts down, so every drop is one or more completed phases; a move
	 * that finishes two at once (cross and the first pair together) writes the same
	 * timestamp twice, which is what makes the skipped phase read as instant.
	 *
	 * The drop to 0 is deliberately not recorded: that boundary is the solve time
	 * itself, and `phase_splits` holds one fewer entry than there are phases.
	 */
	function updatePhases(progress: number, elapsed: number) {
		if (progress < remainingRef.current) {
			for (let i = remainingRef.current; i > progress; i--) {
				if (i > 1) {
					phaseSplitsRef.current.push(elapsed);
				}
			}
		}
		remainingRef.current = Math.min(progress, remainingRef.current) || 1;
	}

	/** Serialize what was recorded, for the solve overrides. */
	function buildOverrides(startedAt: number) {
		const method = multiPhaseRef.current;
		const overrides: Record<string, any> = {
			is_virtual_cube: true,
			smart_turn_count: moveCountRef.current,
		};

		if (movesRef.current.length) {
			overrides.smart_turns = serializeSmartTurnsCompact(movesRef.current, startedAt);
		}

		// Phase timing rides on the existing phase_splits column with inline labels,
		// so the solve carries its own phase names and the existing UI renders it
		// unchanged. It deliberately does not go through the manual multi-phase
		// setting, which is a different mechanism with a different meaning.
		if (method !== 'n' && phaseSplitsRef.current.length) {
			const labels = getVirtualStepNames(method).slice().reverse();
			const serialized = serializePhaseSplits(phaseSplitsRef.current, 'custom', labels);
			if (serialized) {
				overrides.phase_splits = serialized;
			}
		}

		return overrides;
	}

	/**
	 * The move listener. Port of `moveListener` (virtual.js:10-74).
	 *
	 * Called with step 0 when a move is accepted, 1 when its animation starts and 2
	 * when it is committed. Starting the timer keys off step 0 so it begins on the
	 * keypress, while solved detection keys off step 2 so it only fires on a state
	 * the cube has actually reached.
	 */
	function handleMove(move: VrcMove, step: MoveStep, ts: number) {
		if (step === 1) return;

		const view = viewRef.current;
		if (!view) return;

		const now = ts || Date.now();

		if (armed() && !running()) {
			// Rotations during inspection are free: you may look the cube over
			// without starting the clock. On blindfolded events they are not, since
			// the whole point is that you cannot look.
			if (isRotation(move, dimension) && !isBldRef.current) {
				if (step === 0) {
					movesRef.current.push({ turn: move2str(move, dimension).trim(), completedAt: 0 });
				}
				return;
			}

			// The first real move starts the solve. Any inspection penalty is already
			// on the store, set by startInspection's own interval, so it is left
			// alone rather than recomputed here.
			startTimer(now);

			// Multi-phase splitting is 3x3 only, matching virtual.js:30.
			remainingRef.current = dimension === 3 ? getVirtualStepCount(multiPhaseRef.current) : 1;
			moveCountRef.current = 0;
			phaseSplitsRef.current = [];
			// Inspection rotations stay in the log at offset 0, ahead of the solve.
			movesRef.current = movesRef.current.filter((m) => m.completedAt === 0);
		}

		if (!running()) return;

		const startedAt = (getTimerStore('timeStartedAt') as Date | null)?.getTime() ?? now;

		if (isBldRef.current && !isRotation(move, dimension)) {
			view.toggleColorVisible(view.isSolved(multiPhaseRef.current) === 0);
		}

		if (step === 0) {
			movesRef.current.push({
				turn: move2str(move, dimension).trim(),
				completedAt: Math.max(now, startedAt),
			});
			return;
		}

		// step === 2: the move is committed, so the state is real and can be judged.
		const progress = view.isSolved(multiPhaseRef.current);
		updatePhases(progress, now - startedAt);

		if (progress !== 0) return;

		moveCountRef.current += view.moveCnt();
		disarm();

		endTimer(contextRef.current, undefined, buildOverrides(startedAt), now);
	}

	/**
	 * Key handling. Port of `onkeydown` (virtual.js:136-180).
	 *
	 * Registered on the window rather than routed through KeyWatcher, which stands
	 * down for the virtual cube. Both sides consult the same store flag, so the
	 * order the listeners happen to run in does not matter.
	 */
	function onKeyDown(e: KeyboardEvent) {
		const target = e.target as HTMLElement;
		if (
			target &&
			(target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
		) {
			return;
		}
		if (e.repeat) return;
		if (modalsRef.current && modalsRef.current.length) return;
		if (e.altKey || e.ctrlKey || e.metaKey) return;

		const ctx = contextRef.current;
		if (ctx.disabled || ctx.timerDisabled) return;

		const view = viewRef.current;
		if (!view) return;

		const keyCode = e.keyCode;

		// Escape is checked before anything else and without asking whether the cube
		// is armed. It is the way out of every state, so a state this component got
		// into wrongly must not also be a state Escape cannot leave.
		if (keyCode === KEY_ESCAPE) {
			e.preventDefault();
			escapePressed();
			return;
		}

		if (!armed() && !running()) {
			if (keyCode === KEY_SPACE) {
				e.preventDefault();
				scrambleIt();
				setTimerParams({ virtualArmed: true });
				if (inspectionEnabled) {
					startInspection(ctx);
				}
			}
			return;
		}

		// Space must not scroll the page, and every bound key is consumed here.
		e.preventDefault();
		view.keydown(keyCode, { altKey: e.altKey, ctrlKey: e.ctrlKey });
	}

	/**
	 * Escape. Port of virtual.js:158-168.
	 * Mid-solve it records a DNF with the elapsed time; while merely armed it
	 * abandons the attempt and records nothing.
	 */
	function escapePressed() {
		const ctx = contextRef.current;
		const wasRunning = running();
		const now = Date.now();
		const startedAt = (getTimerStore('timeStartedAt') as Date | null)?.getTime() ?? now;

		// Tear down the app's own timers first. Clearing the store fields alone
		// leaves the inspection countdown and its 17-second DNF timeout alive, and
		// they would then fire onto an attempt the user has already abandoned.
		stopTimer(START_TIMEOUT);
		clearInspectionTimers(true, true);

		disarm();
		setTimerParams({
			timeStartedAt: null,
			solving: false,
			inInspection: false,
			inspectionTimer: 0,
			spaceTimerStarted: 0,
			canStart: false,
			addTwoToSolve: false,
			dnfTime: false,
			finalTime: 0,
		});

		if (wasRunning) {
			// A failed save must not strand the user in a half-cancelled state, so
			// the cube is restored either way.
			try {
				saveSolve(
					ctx,
					now - startedAt,
					ctx.scramble,
					startedAt,
					now,
					true,
					false,
					buildOverrides(startedAt)
				);
			} catch (err) {
				console.error('[VirtualCube] failed to record the abandoned solve', err);
			}
		}

		restoreScramble();
	}

	/**
	 * Mobile arming. The one thing the reference has no answer for: cstimer routes
	 * the virtual cube through `onkeydown` only (timer.js:666-668), so on a phone
	 * you can turn the cube but can never start the clock.
	 *
	 * The smallest possible addition, chosen so nothing new appears on screen: a
	 * tap on the timer surface outside the cube means Space. The cube's own canvas
	 * is excluded because taps there are gestures, and blocked elements (buttons,
	 * the header, the stats bar) are excluded by the shared classifier.
	 */
	function onTouchEnd(e: TouchEvent) {
		if (!mobileMode) return;
		if (modalsRef.current && modalsRef.current.length) return;

		const ctx = contextRef.current;
		if (ctx.disabled || ctx.timerDisabled) return;

		const target = e.target as HTMLElement;
		if (!target || target.closest(`.${b()}`)) return;

		const { blocked, insideTimer } = classifyTouchTarget(target);
		if (blocked || !insideTimer) return;

		if (running()) {
			// Only solving the cube stops the timer, exactly as on the keyboard.
			return;
		}

		if (armed()) {
			// Abandon the attempt without recording anything, the same as Escape
			// before the first move.
			disarm();
			setTimerParams({ inInspection: false });
			restoreScramble();
			return;
		}

		scrambleIt();
		setTimerParams({ virtualArmed: true });
		if (inspectionEnabled) {
			startInspection(ctx);
		}
	}

	// Capture phase, deliberately. "The virtual cube owns the keyboard" is only
	// true if it sees the key before anything else does; on the bubble phase a
	// window listener runs last, behind every component that also listens.
	useWindowListener('keydown', onKeyDown, [dimension, inspectionEnabled], KEY_CAPTURE);
	useWindowListener('touchend', onTouchEnd, [dimension, inspectionEnabled, mobileMode]);

	// The scramble, cube type or subset changed, so whatever is on screen is stale.
	// Port of `procSignal` (virtual.js:190-217). Only resets while idle: a change
	// arriving mid-solve would wipe the solve out from under the user.
	useEffect(() => {
		if (armed() || running()) return;
		viewRef.current?.reset();
	}, [scramble, cubeType, scrambleSubset, dimension]);

	// The inspection timeout writes its own DNF and resets the timer, but knows
	// nothing about the cube, so the disarm and the visual reset happen here.
	const dnfTime = context.dnfTime;
	useEffect(() => {
		if (!dnfTime) return;
		disarm();
		restoreScramble();
	}, [dnfTime]);

	// An attempt cannot outlive the cube it was being solved on.
	//
	// This component is unmounted whenever it goes away for any reason, and one of
	// those reasons is not obvious: Timer renders entirely separate desktop and
	// mobile trees and the cube sits in a different place in each, so crossing the
	// 1024px breakpoint mid-solve tears it down and builds a fresh, solved one.
	// A tablet rotated mid-solve does exactly that. Without this the scramble was
	// gone while the timer kept counting, leaving an attempt that could never end.
	//
	// Deliberately records nothing. The solver did not abandon the attempt, the app
	// dropped it, and writing a DNF they did not earn would be worse than losing it.
	useEffect(() => {
		return () => {
			const wasActive = !!getTimerStore('virtualArmed') || !!getTimerStore('timeStartedAt');
			if (!wasActive) return;

			stopTimer(START_TIMEOUT);
			clearInspectionTimers(true, true);
			setTimerParams({
				virtualArmed: false,
				timeStartedAt: null,
				solving: false,
				inInspection: false,
				inspectionTimer: 0,
				spaceTimerStarted: 0,
				canStart: false,
				addTwoToSolve: false,
				dnfTime: false,
				finalTime: 0,
			});
		};
	}, []);

	return (
		<>
			{/* Mobile needs a way out of an attempt. The keyboard has Escape; a phone
			    has nothing, and cstimer has no mobile story here at all, so this is
			    ours. Rendered as a <button> deliberately: classifyTouchTarget treats
			    BUTTON as blocked, so the tap that cancels can never also be read as
			    the tap that arms. */}
			{mobileMode && focusMode && (
				<button
					type="button"
					className={b('cancel').toString()}
					aria-label={t('common.cancel')}
					onClick={escapePressed}
				>
					<X weight="bold" size={22} />
				</button>
			)}
			<VirtualCubeView
				ref={viewRef}
				dimension={dimension}
				size={effectiveSize}
				speed={speed}
				orientation={orientation}
				keyboardLayout={keyboardLayout}
				bigVisibility={bigVisibility}
				showTouchGrid={mobileMode && gestureEnabled}
				onMove={handleMove}
			/>
		</>
	);
}
