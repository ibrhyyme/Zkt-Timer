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
import { resetScramble } from './scramble';
import { ITimerContext } from '../Timer';
import { SolveInput } from '../../../../server/schemas/Solve.schema';
import { getSettings } from '../../../db/settings/query';
import { getTimerStore } from '../../../util/store/getTimer';
import { resourceUri } from '../../../util/storage';
import { smartCubeSelected } from './util';

let endLocked = false;

export function startTimer() {
	const timeStartedAt = new Date();

	clearInspectionTimers(false, true);
	setTimerParams({
		editScramble: false,
		notification: null,
		timeStartedAt,
		solving: true,
		finalTime: 0,
		lastSmartSolveStats: null,
	});

	setTimeout(() => {
		emitEvent('startTimerEvent', {
			timeStartedAt,
		});
	});
}

export function endTimer(context: ITimerContext, finalTimeMilli?: number, overrides?: Partial<SolveInput>) {

	const { scramble, timeStartedAt } = context;

	if (endLocked || !timeStartedAt) {
		return;
	}

	endLocked = true;
	let finalTime = finalTimeMilli;

	const now = new Date();

	if (!finalTimeMilli) {
		finalTime = now.getTime() - timeStartedAt.getTime();
	}

	setTimerParams({
		solving: false,
		finalTime,
	});

	// Calculate and persist stats for the finished solve
	if (smartCubeSelected(context)) {
		let turnCount = 0;

		// If overrides provided (e.g. from SmartCube auto-finish), use them
		if (overrides && overrides.smart_turn_count !== undefined) {
			turnCount = overrides.smart_turn_count;
		} else {
			// Otherwise calculate from context with leniency for the first move
			const startTime = timeStartedAt.getTime();
			// Allow moves up to 500ms before timer start (to catch the starting move)
			const solutionTurns = (context.smartTurns || []).filter((t: any) => t.completedAt >= startTime - 500);
			turnCount = solutionTurns.length;
		}

		const timeInSeconds = finalTime / 1000;
		const tps = timeInSeconds > 0 ? Number((turnCount / timeInSeconds).toFixed(2)) : 0;

		setTimerParams({
			lastSmartSolveStats: {
				turns: turnCount,
				tps,
			},
		});
	}

	resetTimerParams(context);
	setTimeout(() => {
		const overridesCombined = { ...overrides };


		// Auto-detect smart cube data if not explicitly provided
		if (smartCubeSelected(context) && !overridesCombined.is_smart_cube) {
			const startTime = timeStartedAt.getTime();
			// Filter out turns that happened before the timer started (scramble moves)
			const solutionTurns = (context.smartTurns || []).filter((t: any) => t.completedAt >= startTime);

			overridesCombined.is_smart_cube = true;
			overridesCombined.smart_device_id = context.smartDeviceId;
			overridesCombined.smart_turn_count = solutionTurns.length;
			overridesCombined.smart_turns = JSON.stringify(solutionTurns);
		}

		if (context.smartPickUpTime) {
			overridesCombined.smart_pick_up_time = context.smartPickUpTime;
		}

		if (context.lastSmartMoveTime) {
			let pd = (now.getTime() - context.lastSmartMoveTime) / 1000;
			if (pd < 0) pd = 0;
			overridesCombined.smart_put_down_time = pd;
		}

		saveSolve(context, finalTime, scramble, timeStartedAt.getTime(), now.getTime(), false, false, overridesCombined);
		endLocked = false;
	}, 10);
}

export function resetTimerParams(context: ITimerContext) {
	resetScramble(context);
	stopTimer(START_TIMEOUT);
	clearInspectionTimers(false, true);
	setTimerParams({
		spaceTimerStarted: 0,
		solving: false,
		canStart: false,
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

	const {
		inspection_delay: inspectionDelay,
		inspection_auto_start: inspectionAutoStart,
		play_inspection_sound: playInspectionSound,
		timer_type: timerType
	} = getSettings();

	const stackMatOn = timerType === 'stackmat';
	const ganTimerOn = timerType === 'gantimer';

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
				resetTimerParams(context);
			}, 2000);
		}, inspectionDelay * 1000 + 2000)
	);

	setTimer(
		INSPECTION_INTERVAL,
		setInterval(() => {
			const insTimer = getTimerStore('inspectionTimer');
			if (playInspectionSound) {
				let audio;
				// Play sounds at 8 and 12 seconds (inspectionDelay - remaining time)
				const elapsed = inspectionDelay + 2 - insTimer;
				if (elapsed >= 5 && elapsed < 5.1) {
					audio = new Audio(resourceUri('/audio/8_sec.mp3'));
				} else if (elapsed >= 9 && elapsed < 9.1) {
					audio = new Audio(resourceUri('/audio/12_sec.mp3'));
				}
				if (audio) {
					audio.playbackRate = 2.3;
					audio.play();
				}
			}
			let addTwoToSolve = false;
			if (insTimer <= 3) {
				addTwoToSolve = true;
			}
			setTimerParams({
				inspectionTimer: Math.max(insTimer - 0.1, 0), // Decrement by 0.1 for smooth display
				addTwoToSolve,
			});
		}, 100) // Update every 100ms for smooth decimal display
	);

}
