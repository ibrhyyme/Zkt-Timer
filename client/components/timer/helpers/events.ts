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
import { getSettings, getSetting } from '../../../db/settings/query';
import { getTimerStore } from '../../../util/store/getTimer';
import { resourceUri } from '../../../util/storage';
import { smartCubeSelected } from './util';
import { hapticImpact } from '../../../util/native-plugins';

let endLocked = false;

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

export function startTimer(smartStartTimestamp?: number) {
	const timeStartedAt = smartStartTimestamp ? new Date(smartStartTimestamp) : new Date();
	_smartSolveEndTime = null;
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
}

export function endTimer(context: ITimerContext, finalTimeMilli?: number, overrides?: Partial<SolveInput>) {
	hapticImpact('medium');

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

	// Timer/interval temizligi — önce display güncelle, scramble üretimi defer edilecek
	stopTimer(START_TIMEOUT);
	clearInspectionTimers(false, true);

	// Tek dispatch: solving durumu + stats + timer reset — onceden 3 ayri dispatch'ti
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
		// Yeni scramble üretimi pahalı — display güncellendikten sonra defer et (kasma önleme)
		resetScramble(context);

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

		// Alma/bırakma süreleri sadece use_space_with_smart_cube modunda anlamlı.
		// Pure smart cube modunda timer ilk hamleyle başlayıp çözümle duruyor,
		// bu değerler sadece React/BLE processing gecikmesini yansıtır.
		const useSpaceWithSmart = getSetting('use_space_with_smart_cube');
		if (useSpaceWithSmart) {
			if (context.smartPickUpTime) {
				overridesCombined.smart_pick_up_time = context.smartPickUpTime;
			}

			if (context.lastSmartMoveTime) {
				let pd = (now.getTime() - context.lastSmartMoveTime) / 1000;
				if (pd < 0) pd = 0;
				overridesCombined.smart_put_down_time = pd;
			}
		}

		saveSolve(context, finalTime, scramble, timeStartedAt.getTime(), now.getTime(), false, false, overridesCombined);
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
				let audio;
				// Play sounds at 8 and 12 seconds (inspectionDelay - remaining time)
				const elapsed = inspectionDelay + 2 - insTimer;
				if (elapsed >= 8 && elapsed < 8.1) {
					audio = new Audio(resourceUri('/audio/8_sec.mp3'));
				} else if (elapsed >= 12 && elapsed < 12.1) {
					audio = new Audio(resourceUri('/audio/12_sec.mp3'));
				}
				if (audio) {
					audio.playbackRate = 2.3;
					audio.play();
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
