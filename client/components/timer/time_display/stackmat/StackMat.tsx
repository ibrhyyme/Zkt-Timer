import React, { useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import StartInstructions from '../start_instructions/StartInstructions';
import { ITimerContext, TimerContext } from '../../Timer';
import { useSettings } from '../../../../util/hooks/useSettings';
import Stackmat from '../../../../util/vendor/stackmat';
import { endTimer, startTimer, startInspection } from '../../helpers/events';
import { setTimerParams } from '../../helpers/params';

// Renders the audio-jack timer input. Used by both the StackMat timer type and the
// QYtoys (QiYi wired) timer type — both speak the standard StackMat audio protocol.
export default function StackMat() {
	const { t } = useTranslation();
	const stackMatId = useSettings('stackmat_id');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const inspectionEnabled = useSettings('inspection');
	const timerType = useSettings('timer_type');

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
	// Tracks the on-screen "ready/green" state so we only dispatch on change, not every audio packet.
	const readyRef = useRef(false);
	const [handsReady, setHandsReady] = useState(false);

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
		// cstimer init(timer, deviceId, force): '' = standard StackMat protocol (1200 Hz).
		// StackMat and QYtoys (QiYi wired) both use this standard mode.
		return stackMat.current.init('', stackMatId, false, (timer) => {
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
				// Clear the on-screen "ready/green" indicator once the solve actually begins
				readyRef.current = false;
				setHandsReady(false);
				setTimerParams({ canStart: false });
				startTimer();
			} else if (!timer.running && stackMatStarted.current) {
				stackMatStarted.current = false;
				endTimer(localContext.current, timer.time_milli);
			}

			// On-screen "ready" feedback mirroring the physical timer's green light:
			// head 'A' => both hands on + green. Drive the green time display while idle,
			// so StackMat/QYtoys users can tell on screen that the timer is armed.
			if (!timer.running && !stackMatStarted.current && !localContext.current.inInspection) {
				const ready = !!timer.greenLight;
				if (ready !== readyRef.current) {
					readyRef.current = ready;
					setHandsReady(ready);
					setTimerParams({ canStart: ready });
				}
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
						// Clear any lingering ready-green before inspection's gray countdown takes over
						readyRef.current = false;
						setHandsReady(false);
						setTimerParams({ canStart: false });
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

	const deviceLabel = timerType === 'qiyiwired' ? 'QYtoys' : 'StackMat';

	return (
		<StartInstructions>
			{handsReady
				? t('timer_modules.audio_ready')
				: t('timer_modules.audio_place_hands', { device: deviceLabel })}
		</StartInstructions>
	);
}
