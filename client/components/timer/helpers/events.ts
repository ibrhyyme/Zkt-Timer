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

let endLocked = false;

// Touch/keyboard: endTimer anında display'i dondur — React re-render beklemeden
// 33ms interval overshoot'unu engeller (smart cube freeze ile aynı pattern)
let _timerEndFinalTime: number | null = null;

export function getTimerEndFinalTime(): number | null {
	return _timerEndFinalTime;
}

// Smart cube: BLE katmanından senkron solved tespiti için
// Timer display interval'ı bu değeri kontrol eder — React render beklemeden display donar
let _smartSolveEndTime: number | null = null;

export function getSmartSolveEndTime(): number | null {
	return _smartSolveEndTime;
}

export function setSmartSolveEndTime(time: number | null) {
	_smartSolveEndTime = time;
	// Anında display güncellemesi: 33ms interval tick'ini beklemeden TimeDisplay'e haber ver
	// Bu olmadan timer "ileri kaçıp geri düşme" efekti yaşanır
	if (time !== null) {
		window.dispatchEvent(new CustomEvent('smartSolveFreeze'));
	}
}

// Smart cube: clock skew düzeltme yüzdesi (linear regression ile hesaplanır)
// Negatif = küp saati gerçek zamandan yavaş (ör. -0.719 → küp %0.719 yavaş)
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

	// Acik dropdown menuleri kapat (hamburger, kup secici vb.)
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

	// Cozum sirasinda yeni karistirmayi arka planda hazirla
	const cubeType = getSetting('cube_type');
	if (cubeType) {
		const scrambleSubset = getTimerStore('scrambleSubset');
		preGenerateScramble(cubeType, scrambleSubset);
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

	// Display'i HEMEN dondur — Redux dispatch ve React re-render beklemeden
	_timerEndFinalTime = finalTime;
	window.dispatchEvent(new CustomEvent('timerEndFreeze'));

	// Smart cube stats hesapla (dispatch oncesi)
	let smartStats: { turns: number; tps: number } | null = null;
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
		smartStats = { turns: turnCount, tps };
	}

	// Timer/interval temizligi
	stopTimer(START_TIMEOUT);
	clearInspectionTimers(false, true);

	// Tek dispatch: solving durumu + stats + timer reset
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
		// Pre-generated scramble varsa anlik swap, yoksa senkron uret
		const preScramble = consumePreGeneratedScramble(context.cubeType);
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

			// Pro user: hamleler compact format'a serialize edilir + server method_steps olusturur.
			// Free user: smart_turns null kalir, method_steps olusmaz, DB sismez.
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

export function resetTimerParams(context: ITimerContext) {
	resetScramble(context);
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
	// Acik dropdown menuleri kapat
	window.dispatchEvent(new CustomEvent('timerInteractionStart'));
	hapticImpact('medium');

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
