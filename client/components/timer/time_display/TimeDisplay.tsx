import React, { useContext, useEffect, useRef, useState } from 'react';
import { getTimeString } from '../../../util/time';
import './TimeDisplay.scss';
import Manual from './manual/Manual';
import { preflightChecks } from '../smart_cube/preflight';
import { MOBILE_FONT_SIZE_MULTIPLIER } from '../../../db/settings/update';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { smartCubeSelected } from '../helpers/util';
import { TimerContext } from '../Timer';
import block from '../../../styles/bem';
import { useSettings } from '../../../util/hooks/useSettings';
import StartInstructions from './start_instructions/StartInstructions';
import StackMat from './stackmat/StackMat';
import GanTimer from './gantimer/GanTimer';
import SmartStats from '../smart_cube/stats/SmartStats';
import SolveDiff from './SolveDiff';
import OfflineModeIndicator from './OfflineModeIndicator';

const b = block('time-display');
const bi = block('timer-bottom-info');

export default function TimeDisplay() {
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
	if (mobileMode) {

		if (smartCubeSelected(context)) {
			timerTimeSize = 50;
		} else {
			timerTimeSize = 100;
		}
	}

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

	useEffect(() => {
		if (!timeStartedAt && !solving && finalTime >= 0) {
			setTime(finalTime / 1000);
		}
	}, [finalTime]);

	function stopInterval() {
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

			const runningTime = (now.getTime() - timeStartedAt.getTime()) / 1000;
			setTime(runningTime);
		}, 10);
	}

	if (manualEntry) {
		return <Manual />;
	}

	let timeStr;
	let bottomInfo = null;
	if (inspectionOn) {
		bottomInfo = <StartInstructions>İnceleme Açık</StartInstructions>;
	}

	if (inInspection) {
		if (inspectionTimer <= 2) {
			timeStr = '+2';
		} else {
			// İnceleme süresinde ondalık gösterme — tam sayı geri sayım
			timeStr = Math.ceil(inspectionTimer - 2).toString();
		}
	} else {
		timeStr = getTimeString(time);
	}

	if (dnfTime && inInspection) {
		timeStr = 'DNF';
	}

	if (hideTimeWhenSolving && timeStartedAt) {
		timeStr = 'ÇÖZ';
	}

	if (stackMatOn) {
		bottomInfo = <StackMat />;
	} else if (ganTimerOn) {
		bottomInfo = <GanTimer />;
	} else if (smartCubeSelected(context) && !mobileMode) {
		if (preflightChecks(smartTurns, scramble)) {
			bottomInfo = (
				<StartInstructions>
					Başlamak için <span>akıllı küpü</span> çevir
				</StartInstructions>
			);
		} else {
			bottomInfo = (
				<StartInstructions>
					Başlamak için <span>akıllı küpü</span> karıştır
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
