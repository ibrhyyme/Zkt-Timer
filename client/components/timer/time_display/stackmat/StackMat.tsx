import React, { useContext, useEffect, useRef, useState } from 'react';
import StartInstructions from '../start_instructions/StartInstructions';
import { ITimerContext, TimerContext } from '../../Timer';
import { useSettings } from '../../../../util/hooks/useSettings';
import Stackmat from '../../../../util/vendor/stackmat';
import { endTimer, startTimer, startInspection } from '../../helpers/events';
import { setTimerParams } from '../../helpers/params';

export default function StackMat() {
	const stackMatId = useSettings('stackmat_id');
	const stackMatAutoInspection = useSettings('stackmat_auto_inspection');
	const inspectionEnabled = useSettings('inspection');

	const context = useContext(TimerContext);
	const localContext = useRef<ITimerContext>(context);

	// Settings'i ref olarak tut (stale closure önleme)
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

	// Settings değiştiğinde ref'leri güncelle
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
		return stackMat.current.init('', stackMatId, false, (timer) => {
			if (timerInitCounter.current < 2) {
				timerInitCounter.current++;
				return;
			}

			// Timer başladığında bekleyen inspection timeout'u iptal et
			if (timer.running && !stackMatStarted.current) {
				stackMatStarted.current = true;
				// Bekleyen auto-inspection'ı iptal et
				if (inspectionTimeoutRef.current) {
					clearTimeout(inspectionTimeoutRef.current);
					inspectionTimeoutRef.current = null;
				}
				startTimer();
			} else if (!timer.running && stackMatStarted.current) {
				stackMatStarted.current = false;
				endTimer(localContext.current, timer.time_milli);
			}

			// Mat sıfırlandığında
			if (timer.time_milli === 0 && prevTime.current > 0 && !timer.running) {
				// Ekrandaki süreyi sıfırla
				setTimerParams({ finalTime: 0 });

				// Otomatik inceleme aktifse kullanıcının belirlediği süre sonra başlat
				const delaySeconds = stackMatAutoInspectionRef.current;
				if (delaySeconds > 0 && inspectionEnabledRef.current) {
					// Önceki timeout varsa iptal et
					if (inspectionTimeoutRef.current) {
						clearTimeout(inspectionTimeoutRef.current);
					}

					inspectionTimeoutRef.current = setTimeout(() => {
						inspectionTimeoutRef.current = null;
						startInspection(localContext.current);
					}, delaySeconds * 1000);
				}
			}

			// Süre > 0 olduğunda veya timer çalışıyorsa timeout'u iptal et
			if ((timer.time_milli > 0 || timer.running) && inspectionTimeoutRef.current) {
				clearTimeout(inspectionTimeoutRef.current);
				inspectionTimeoutRef.current = null;
			}

			// Önceki süreyi güncelle
			prevTime.current = timer.time_milli;
		});
	}

	return (
		<StartInstructions>
			Başlamak için ellerinizi <span>StackMat</span> üzerine koyun
		</StartInstructions>
	);
}
