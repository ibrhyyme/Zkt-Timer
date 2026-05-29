import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StartInstructions from '../start_instructions/StartInstructions';
import { ITimerContext, TimerContext } from '../../Timer';
import { useSettings } from '../../../../util/hooks/useSettings';
import Stackmat from '../../../../util/vendor/stackmat';
import { endTimer, startTimer, startInspection } from '../../helpers/events';
import { setTimerParams } from '../../helpers/params';

interface Props {
	// cstimer mode: '' = StackMat (1200 Hz), 'm' = MoYu Timer (8000 Hz BCD)
	// MoYu Timer is exposed as a separate timer_type; shares common audio processing path —
	// only sample rate + bit analyzer differ (vendor/stackmat.js).
	mode?: '' | 'm';
}

export default function StackMat({mode = ''}: Props = {}) {
	const { t } = useTranslation();
	const stackMatId = useSettings('stackmat_id');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const inspectionEnabled = useSettings('inspection');

	const context = useContext(TimerContext);
	const localContext = useRef<ITimerContext>(context);

	// Keep settings as refs (prevent stale closures)
	const stackMatAutoInspectionRef = useRef(stackMatAutoInspection);
	const inspectionEnabledRef = useRef(inspectionEnabled);

	const timerInitCounter = useRef(0);
	const [stackMatRetryCount, setStackMatRetryCount] = useState(0);
	const stackMat = useRef<Stackmat>(null);
	const stackMatStarted = useRef(false);
	const prevTime = useRef(0);
	const inspectionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		localContext.current = context;
	}, [context]);

	// Update refs when settings change
	useEffect(() => {
		stackMatAutoInspectionRef.current = stackMatAutoInspection;
	}, [stackMatAutoInspection]);

	useEffect(() => {
		inspectionEnabledRef.current = inspectionEnabled;
	}, [inspectionEnabled]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (inspectionTimeoutRef.current) {
				clearTimeout(inspectionTimeoutRef.current);
			}
		};
	}, []);

	// Initialize StackMat
	useEffect(() => {
		if (!stackMatId) {
			return;
		}

		navigator.mediaDevices
			.enumerateDevices()
			.then(initStackMat)
			.catch((e) => {
				console.error(e);
				stackMat.current = null;
				if (stackMatRetryCount < 5) {
					setTimeout(() => {
						setStackMatRetryCount(stackMatRetryCount + 1);
					}, 1000);
				}
			});
	}, [stackMatRetryCount]);

	function initStackMat() {
		if (stackMat.current) {
			return;
		}

		stackMat.current = new Stackmat();
		// cstimer init(timer, deviceId, force): '' (empty = standard) vs 'm' (MoYu)
		return stackMat.current.init(mode, stackMatId, false, (timer) => {
			if (timerInitCounter.current < 2) {
				timerInitCounter.current++;
				return;
			}

			// Cancel pending inspection timeout when timer starts
			if (timer.running && !stackMatStarted.current) {
				stackMatStarted.current = true;
				// Cancel pending auto-inspection
				if (inspectionTimeoutRef.current) {
					clearTimeout(inspectionTimeoutRef.current);
					inspectionTimeoutRef.current = null;
				}
				startTimer();
			} else if (!timer.running && stackMatStarted.current) {
				stackMatStarted.current = false;
				endTimer(localContext.current, timer.time_milli);
			}

			// When mat is reset
			if (timer.time_milli === 0 && prevTime.current > 0 && !timer.running) {
				// Reset displayed time on screen
				setTimerParams({ finalTime: 0 });

				// If auto-inspection is active, start after user-specified delay
				const delaySeconds = stackMatAutoInspectionRef.current;
				if (delaySeconds > 0 && inspectionEnabledRef.current) {
					// Cancel previous timeout if exists
					if (inspectionTimeoutRef.current) {
						clearTimeout(inspectionTimeoutRef.current);
					}

					inspectionTimeoutRef.current = setTimeout(() => {
						inspectionTimeoutRef.current = null;
						startInspection(localContext.current);
					}, delaySeconds * 1000);
				}
			}

			// Cancel timeout when time > 0 or timer is running
			if ((timer.time_milli > 0 || timer.running) && inspectionTimeoutRef.current) {
				clearTimeout(inspectionTimeoutRef.current);
				inspectionTimeoutRef.current = null;
			}

			// Update previous time
			prevTime.current = timer.time_milli;
		});
	}

	return (
		<StartInstructions>
			{t('timer_modules.stackmat_place_hands')}
		</StartInstructions>
	);
}
