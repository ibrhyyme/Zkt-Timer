import React, { useContext, useEffect, useRef, useState } from 'react';
import {useTranslation} from 'react-i18next';
import { getTimeString } from '../../../util/time';
import './TimeDisplay.scss';
import Manual from './manual/Manual';
import { preflightChecks } from '../smart_cube/preflight';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../../db/settings/update';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { smartCubeSelected } from '../helpers/util';
import { getSmartSolveEndTime, getTimerEndFinalTime } from '../helpers/events';
import { TimerContext } from '../Timer';
import block from '../../../styles/bem';
import { useSettings } from '../../../util/hooks/useSettings';
import { onVisibilityChange } from '../../../util/app-visibility';
import StartInstructions from './start_instructions/StartInstructions';
import StackMat from './stackmat/StackMat';
import GanTimer from './gantimer/GanTimer';
import SmartStats from '../smart_cube/stats/SmartStats';
import SolveDiff from './SolveDiff';
import OfflineModeIndicator from './OfflineModeIndicator';

const b = block('time-display');
const bi = block('timer-bottom-info');

export default function TimeDisplay() {
	const {t} = useTranslation();
	const context = useContext(TimerContext);
	const [time, setTime] = useState(0);
	const timerCounter = useRef<NodeJS.Timeout>(null);
	const timerLocked = useRef<boolean>(false);

	const {
		disabled,
		hideTime,
		canStart,
		smartTurns,
		scramble,
		dnfTime,
		subTimerActions,
		solving,
		finalTime,
		timeStartedAt,
		spaceTimerStarted,
		inInspection,
		inspectionTimer,
		matchMode,
	} = context;

	const inspectionOn = useSettings('inspection');
	const manualEntry = useSettings('manual_entry');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');
	const timerFontFamily = useSettings('timer_font_family');
	const timerType = useSettings('timer_type');
	const stackMatOn = timerType === 'stackmat';
	const ganTimerOn = timerType === 'gantimer';
	const zeroOutTimeAfterSolve = useSettings('zero_out_time_after_solve');

	const mobileMode = useGeneral('mobile_mode');
	let timerTimeSize = useSettings('timer_time_size');

	useEffect(() => {
		if (timerCounter.current && !solving) {
			stopInterval();
		} else if (!timerCounter.current && timeStartedAt) {
			startInterval();
		}
		if (!solving && finalTime < 0) {
			setTime(0);
		}
	}, [solving, finalTime, timeStartedAt]);

	// Smart cube: BLE solved tespiti anında display'i dondur (33ms interval tick'ini bekleme)
	// Bu olmadan timer "ileri kaçıp geri düşme" efekti yaşanır
	useEffect(() => {
		const handleFreeze = () => {
			const solveEnd = getSmartSolveEndTime();
			if (solveEnd !== null && solveEnd > 0 && timeStartedAt) {
				const frozenTime = (solveEnd - timeStartedAt.getTime()) / 1000;
				if (frozenTime > 0) {
					setTime(frozenTime);
					// Interval'ı durdur — artık ticking gereksiz
					if (timerCounter.current) {
						clearInterval(timerCounter.current);
						timerCounter.current = null;
					}
				}
			}
		};
		window.addEventListener('smartSolveFreeze', handleFreeze);
		return () => window.removeEventListener('smartSolveFreeze', handleFreeze);
	}, [timeStartedAt]);

	// Touch/keyboard: endTimer aninda display'i dondur ve interval'i temizle
	useEffect(() => {
		const handleEndFreeze = () => {
			const endFinal = getTimerEndFinalTime();
			if (endFinal !== null && endFinal > 0) {
				setTime(endFinal / 1000);
				if (timerCounter.current) {
					clearInterval(timerCounter.current);
					timerCounter.current = null;
				}
			}
		};
		window.addEventListener('timerEndFreeze', handleEndFreeze);
		return () => window.removeEventListener('timerEndFreeze', handleEndFreeze);
	}, []);

	// Arka plana gecildiginde timer display interval'ini durdur
	useEffect(() => {
		const unsub = onVisibilityChange((visible) => {
			if (!visible && timerCounter.current) {
				clearInterval(timerCounter.current);
				timerCounter.current = null;
			} else if (visible && !timerCounter.current && timeStartedAt && solving) {
				startInterval();
			}
		});
		return unsub;
	}, [solving, timeStartedAt]);

	useEffect(() => {
		if (!timeStartedAt && !solving && finalTime >= 0) {
			setTime(finalTime / 1000);
		}
	}, [finalTime]);

	function stopInterval() {
		// Smart cube: freeze handler interval'ı zaten temizledi
		// finalTime ile display'i doğru değere güncelle (freeze yaklaşık, linear fit doğru)
		if (!timerCounter.current && getSmartSolveEndTime() !== null) {
			if (finalTime > 0) {
				setTime(finalTime / 1000);
			}
			return;
		}

		timerLocked.current = true;

		if (!finalTime || finalTime <= 0) {
			setTime(0);
		} else {
			setTime(finalTime / 1000);
		}

		if (timerCounter.current) {
			clearInterval(timerCounter.current);
		}
		timerCounter.current = null;
		timerLocked.current = false;

		if (zeroOutTimeAfterSolve && finalTime > 0) {
			setTime(0);
		}
	}

	function startInterval() {
		if (timerCounter.current) {
			return;
		}
		timerCounter.current = setInterval(() => {
			const now = new Date();

			if (timerLocked.current || (!solving && !finalTime) || !timeStartedAt) {
				return;
			}

			// Smart cube: BLE katmanında solved tespit edildiyse display'i dondur
			const solveEnd = getSmartSolveEndTime();
			if (solveEnd !== null && solveEnd > 0) {
				const frozenTime = (solveEnd - timeStartedAt.getTime()) / 1000;
				if (frozenTime > 0) {
					setTime(frozenTime);
					return;
				}
			}

			// Touch/keyboard: endTimer cagrildiginda display'i dondur
			// Redux dispatch ve React re-render beklemeden overshoot'u engeller
			const endFinalTime = getTimerEndFinalTime();
			if (endFinalTime !== null && endFinalTime > 0) {
				setTime(endFinalTime / 1000);
				return;
			}

			const runningTime = (now.getTime() - timeStartedAt.getTime()) / 1000;
			setTime(runningTime);
		}, 33);
	}

	if (manualEntry) {
		return <Manual />;
	}

	let timeStr;
	let bottomInfo = null;

	if (inInspection) {
		if (inspectionTimer <= 2) {
			timeStr = '+2';
		} else {
			// İnceleme süresinde ondalık gösterme — tam sayı geri sayım
			timeStr = Math.ceil(inspectionTimer - 2).toString();
		}
	} else {
		timeStr = getTimeString(time, (mobileMode && solving) ? 1 : undefined);
	}

	if (dnfTime && inInspection) {
		timeStr = 'DNF';
	}

	if (hideTimeWhenSolving && timeStartedAt) {
		timeStr = t('time_display.solve');
	}

	// Mobilde karakter sayisina gore font boyutunu dinamik ayarla
	if (mobileMode) {
		const charCount = timeStr.length;
		if (smartCubeSelected(context)) {
			// Smart cube: container %45 genislik, daha agresif kucultme
			const maxSize = 50;
			if (charCount > 4) {
				timerTimeSize = Math.max(Math.floor(maxSize * 4 / charCount), 22);
			} else {
				timerTimeSize = maxSize;
			}
		} else {
			const maxSize = 100;
			if (charCount > 5) {
				timerTimeSize = Math.max(Math.floor(maxSize * 5 / charCount), 40);
			} else {
				timerTimeSize = maxSize;
			}
		}
	}

	if (stackMatOn) {
		bottomInfo = <StackMat />;
	} else if (ganTimerOn) {
		bottomInfo = <GanTimer />;
	} else if (smartCubeSelected(context) && !mobileMode) {
		if (context.smartNeedsCubeReset) {
			bottomInfo = (
				<StartInstructions>
					{t('smart_cube.solve_cube_to_start')}
				</StartInstructions>
			);
		} else if (preflightChecks(smartTurns, scramble)) {
			bottomInfo = (
				<StartInstructions>
					{t('time_display.turn_smart_cube_to_start')}
				</StartInstructions>
			);
		} else {
			bottomInfo = (
				<StartInstructions>
					{t('time_display.scramble_smart_cube_to_start')}
				</StartInstructions>
			);
		}
	}

	let body = (
		<>
			<div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
				<OfflineModeIndicator />
				<h1
					style={{
						fontSize: timerTimeSize + 'px',
						fontFamily: timerFontFamily + ', monospace',
						marginBottom: mobileMode ? '0px' : '10px', // Reduce bottom margin on mobile
						lineHeight: '1',
					}}
					className={b({
						gray: inInspection,
						green: canStart,
						orange: !!spaceTimerStarted,
						disabled,
					})}
				>
					{timeStr}
				</h1>

				{/* Diff underneath timer, close to it */}
				<div style={{ marginTop: mobileMode ? '-5px' : '0' }}>
					{!matchMode && <SolveDiff />}
				</div>

				{/* Mobile: Stats below time & diff */}
				{mobileMode && smartCubeSelected(context) && (
					<div style={{ marginTop: '5px' }}>
						<SmartStats mobile={true} />
					</div>
				)}
			</div>
			<div className={bi()}>{bottomInfo}</div>
			{subTimerActions}
		</>
	);

	if (hideTime) {
		body = null;
	}

	return (
		<div
			className={b({
				smart: smartCubeSelected(context),
			})}
		>
			{body}
		</div>
	);
}
