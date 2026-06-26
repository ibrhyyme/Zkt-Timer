import { setTimerParams } from './params';
import {
	setTimer,
	stopTimer,
	clearInspectionTimers,
	START_TIMEOUT,
	INSPECTION_TIMEOUT,
	INSPECTION_INTERVAL
} from './timers';
import { emitEvent } from '../../../util/event_handler';
import { saveSolve } from './save';
import { resetScramble, preGenerateScramble, consumePreGeneratedScramble } from './scramble';
import { ITimerContext } from '../Timer';
import { SolveInput } from '../../../../server/schemas/Solve.schema';
import { getSettings, getSetting } from '../../../db/settings/query';
import { getTimerStore } from '../../../util/store/getTimer';
import { resourceUri } from '../../../util/storage';
import { playNativeSound } from '../../../util/native-audio';
import { smartCubeSelected } from './util';
import { hapticImpact } from '../../../util/native-plugins';
import { getStore } from '../../store';
import { isPro } from '../../../lib/pro';
import { serializeSmartTurnsCompact } from '../../../../shared/smart_cube/parse_turns';
import { countHTM } from '../../../../shared/util/solve/move_counter';

let endLocked = false;

// Touch/keyboard: freeze display at endTimer — don't wait for React re-render
// Prevents 33ms interval overshoot (same pattern as smart cube freeze)
let _timerEndFinalTime: number | null = null;

export function getTimerEndFinalTime(): number | null {
	return _timerEndFinalTime;
}

// Smart cube: for sync solved detection from BLE layer
// Timer display interval controls this value — display freezes without waiting for React render
let _smartSolveEndTime: number | null = null;

export function getSmartSolveEndTime(): number | null {
	return _smartSolveEndTime;
}

export function setSmartSolveEndTime(time: number | null) {
	_smartSolveEndTime = time;
	// Immediate display update: notify TimeDisplay without waiting for 33ms interval tick
	// Without this, timer has "jump forward then drop back" effect
	if (time !== null) {
		window.dispatchEvent(new CustomEvent('smartSolveFreeze'));
	}
}

// Smart cube: clock skew correction percentage (calculated via linear regression)
// Negative = cube clock slower than real time (e.g. -0.719 → cube is 0.719% slow)
let _smartCubeClockSkew: number = 0;

export function getSmartCubeClockSkew(): number {
	return _smartCubeClockSkew;
}

export function setSmartCubeClockSkew(skew: number) {
	_smartCubeClockSkew = skew;
}

export function startTimer(smartStartTimestamp?: number, touchTimestamp?: number) {
	const now = Date.now();
	let timeStartedAt: Date;

	if (smartStartTimestamp) {
		timeStartedAt = new Date(smartStartTimestamp);
	} else if (touchTimestamp && (now - touchTimestamp) < 2000) {
		timeStartedAt = new Date(touchTimestamp);
	} else {
		timeStartedAt = new Date(now);
	}
	_smartSolveEndTime = null;
	_timerEndFinalTime = null;
	hapticImpact('light');

	// Close open dropdowns (hamburger, cube picker, etc)
	window.dispatchEvent(new CustomEvent('timerInteractionStart'));

	clearInspectionTimers(false, true);
	setTimerParams({
		editScramble: false,
		notification: null,
		timeStartedAt,
		solving: true,
		finalTime: 0,
		lastSmartSolveStats: null,
		dnfTime: false,
	});

	emitEvent('startTimerEvent', {
		timeStartedAt,
	});

	// Pre-generate next scramble in background during solve
	const cubeType = getSetting('cube_type');
	if (cubeType) {
		const scrambleSubset = getTimerStore('scrambleSubset');
		const scrambleTopColor = getSetting('scramble_top_color');
		preGenerateScramble(cubeType, scrambleSubset, scrambleTopColor);
	}
}

export function endTimer(context: ITimerContext, finalTimeMilli?: number, overrides?: Partial<SolveInput>, endTimestamp?: number) {
	hapticImpact('medium');

	const { scramble, timeStartedAt } = context;

	if (endLocked || !timeStartedAt) {
		return;
	}

	endLocked = true;
	let finalTime = finalTimeMilli;

	const currentTime = Date.now();
	const now = (endTimestamp && (currentTime - endTimestamp) < 2000) ? endTimestamp : currentTime;

	if (!finalTimeMilli) {
		finalTime = now - timeStartedAt.getTime();
	}

	// Freeze display IMMEDIATELY — don't wait for Redux dispatch and React re-render
	_timerEndFinalTime = finalTime;
	window.dispatchEvent(new CustomEvent('timerEndFreeze'));

	// Calculate smart cube stats (before dispatch)
	let smartStats: { turns: number; tps: number } | null = null;
	if (smartCubeSelected(context)) {
		let turnCount = 0;

		// If overrides provided (e.g. from SmartCube auto-finish), use them
		// (Already cstimer-grade HTM from SmartCube.tsx countHTM call)
		if (overrides && overrides.smart_turn_count !== undefined) {
			turnCount = overrides.smart_turn_count;
		} else {
			// Otherwise calculate from context with leniency for the first move
			const startTime = timeStartedAt.getTime();
			// Allow moves up to 500ms before timer start (to catch the starting move)
			const solutionTurns = (context.smartTurns || []).filter((t: any) => t.completedAt >= startTime - 500);
			// cstimer-grade HTM: repeated moves on same face in consecutive parallel planes count as 1
			turnCount = countHTM(solutionTurns.map((t: any) => t.turn));
		}

		const timeInSeconds = finalTime / 1000;
		const tps = timeInSeconds > 0 ? Number((turnCount / timeInSeconds).toFixed(2)) : 0;
		smartStats = { turns: turnCount, tps };
	}

	// Timer/interval cleanup
	stopTimer(START_TIMEOUT);
	clearInspectionTimers(false, true);

	// Single dispatch: solving state + stats + timer reset
	setTimerParams({
		solving: false,
		finalTime,
		spaceTimerStarted: 0,
		canStart: false,
		timeStartedAt: null,
		smartTurns: [],
		smartPickUpTime: 0,
		lastSmartMoveTime: 0,
		dnfTime: false,
		addTwoToSolve: false,
		...(smartStats ? { lastSmartSolveStats: smartStats } : {}),
	});

	setTimeout(() => {
		// If pre-generated scramble exists, swap immediately; otherwise generate synchronously
		const preScramble = consumePreGeneratedScramble(context.cubeType, context.scrambleSubset, getSetting('scramble_top_color'));
		if (preScramble && !context.scrambleLocked && !context.customScrambleFunc) {
			setTimerParams({
				scramble: preScramble,
				originalScramble: preScramble,
				smartTurnOffset: 0,
			});
		} else {
			resetScramble(context);
		}

		const overridesCombined = { ...overrides };

		if (smartCubeSelected(context) && !overridesCombined.is_smart_cube) {
			const startTime = timeStartedAt.getTime();
			const solutionTurns = (context.smartTurns || []).filter((t: any) => t.completedAt >= startTime);

			overridesCombined.is_smart_cube = true;
			overridesCombined.smart_device_id = context.smartDeviceId;
			overridesCombined.smart_turn_count = solutionTurns.length;

			// Pro user: moves serialized to compact format + server creates method_steps.
			// Free user: smart_turns stays null, method_steps not created, doesn't store in DB.
			const me = getStore()?.getState()?.account?.me;
			if (isPro(me)) {
				overridesCombined.smart_turns = serializeSmartTurnsCompact(
					solutionTurns.map((t: any) => ({ turn: t.turn, completedAt: t.completedAt })),
					startTime
				);
			} else {
				overridesCombined.smart_turns = null;
			}
		}

		const useSpaceWithSmart = getSetting('use_space_with_smart_cube');
		if (useSpaceWithSmart) {
			if (context.smartPickUpTime) {
				overridesCombined.smart_pick_up_time = context.smartPickUpTime;
			}

			if (context.lastSmartMoveTime) {
				let pd = (now - context.lastSmartMoveTime) / 1000;
				if (pd < 0) pd = 0;
				overridesCombined.smart_put_down_time = pd;
			}
		}

		saveSolve(context, finalTime, scramble, timeStartedAt.getTime(), now, false, false, overridesCombined);


		endLocked = false;
	}, 10);
}

export function resetTimerParams(context: ITimerContext, skipScramble?: boolean) {
	// skipScramble: in cases like inspection-DNF, user keeps puzzle scrambled
	// — giving new scramble contradicts WCA logic and user might accidentally save
	// old scramble's solve with new scramble.
	if (!skipScramble) {
		resetScramble(context);
	}
	stopTimer(START_TIMEOUT);
	clearInspectionTimers(true, true);
	setTimerParams({
		spaceTimerStarted: 0,
		solving: false,
		canStart: false,
		smartCanStart: false,
		timeStartedAt: null,
		// Reset smart cube data
		smartTurns: [],
		smartPickUpTime: 0,
		lastSmartMoveTime: 0,
	});
}

export function cancelInspection() {
	clearInspectionTimers(true, true);
}

export function startInspection(context: ITimerContext) {
	// "Except BLD": on blind subsets (333ni/444bld/555bld/r3ni) skip inspection and start the timer directly.
	if (getSetting('inspection_except_bld') && /(ni|bld)$/.test(context.scrambleSubset || '')) {
		startTimer();
		return;
	}

	// Close open dropdowns
	window.dispatchEvent(new CustomEvent('timerInteractionStart'));
	hapticImpact('medium');

	const {
		inspection_delay: inspectionDelay,
		inspection_auto_start: inspectionAutoStart,
		play_inspection_sound: playInspectionSound,
		timer_type: timerType
	} = getSettings();

	// stackmat + moyutimer shared audio path (vendor/stackmat.js); auto-inspection behaves same
	const stackMatOn = timerType === 'stackmat' || timerType === 'moyutimer';
	// Hardware timers (GAN Timer + QiYi Timer) disable inspection auto-start
	const ganTimerOn = timerType === 'gantimer' || timerType === 'qiyitimer';

	setTimerParams({
		inInspection: true,
		inspectionTimer: inspectionDelay + 2,
		addTwoToSolve: false,
		dnfTime: false,
	});

	setTimer(
		INSPECTION_TIMEOUT,
		setTimeout(() => {
			if (inspectionAutoStart && !ganTimerOn && !stackMatOn) {
				startTimer();
				return;
			}

			// DNF logic
			const now = Date.now();

			setTimerParams({
				dnfTime: true,
				addTwoToSolve: false,
			});

			saveSolve(context, 0, context.scramble, now, now, true, false);

			setTimeout(() => {
				// Inspection-DNF: don't change scramble (user keeps puzzle scrambled same way,
				// should be able to retry). For new scramble, user presses ArrowRight or UI button.
				resetTimerParams(context, true);
			}, 2000);
		}, inspectionDelay * 1000 + 2000)
	);

	setTimer(
		INSPECTION_INTERVAL,
		setInterval(() => {
			const insTimer = getTimerStore('inspectionTimer');
			if (playInspectionSound) {
				// Play sounds at 8 and 12 seconds (inspectionDelay - remaining time)
				const elapsed = inspectionDelay + 2 - insTimer;
				if (elapsed >= 8 && elapsed < 8.1) {
					if (!playNativeSound('8_sec', 2.3)) {
						const audio = new Audio(resourceUri('/audio/8_sec.mp3'));
						audio.playbackRate = 2.3;
						audio.play();
					}
				} else if (elapsed >= 12 && elapsed < 12.1) {
					if (!playNativeSound('12_sec', 2.3)) {
						const audio = new Audio(resourceUri('/audio/12_sec.mp3'));
						audio.playbackRate = 2.3;
						audio.play();
					}
				}
			}
			let addTwoToSolve = false;
			if (insTimer <= 2) {
				addTwoToSolve = true;
			}
			setTimerParams({
				inspectionTimer: Math.max(insTimer - 0.1, 0), // Decrement by 0.1 for smooth display
				addTwoToSolve,
			});
		}, 100) // Update every 100ms for smooth decimal display
	);

}
