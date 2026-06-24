import { useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { getSettings } from '../../db/settings/query';
import { startSlamDetector, stopSlamDetector, isSlamDetectorAvailable, SlamEvent } from './plugin';
import { useSlamStop, sensitivityToThreshold } from './settings';
import { smartCubeSelected } from '../../components/timer/helpers/util';
import { fetchLastSolve } from '../../db/solves/query';
import { deleteSolveDb } from '../../db/solves/update';
import { hapticImpact } from '../native-plugins';
import { ITimerContext } from '../../components/timer/Timer';

// Idle gesture: double-tap the table → delete the last solve. Sibling of
// useSlamToStop (which handles the single-tap stop while solving). Both share
// the singleton native detector via owner tokens; only one is active at a time
// (solving xor idle). Pure TS — native unchanged (refractory is a start() param).
const ARM_DELAY_MS = 800; // wait after going idle so the stop-slam doesn't count as tap #1
const DOUBLE_TAP_WINDOW_MS = 600; // max gap between the two taps
const DELETE_REFRACTORY_MS = 150; // low refractory so two taps surface as two events

export function useSlamToDeleteLast(context: ITimerContext) {
	const { enabled, sensitivity } = useSlamStop();
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');

	const solving = !!context.timeStartedAt;
	const active =
		isSlamDetectorAvailable() &&
		enabled &&
		timerType === 'keyboard' &&
		!manualEntry &&
		!smartCubeSelected(context) &&
		!solving; // idle only — stop gesture owns the solving state

	useEffect(() => {
		if (!active) return;

		let owner: symbol | null = null;
		let cancelled = false;
		let firstTapAt = 0;

		const armTimer = setTimeout(() => {
			startSlamDetector(
				sensitivityToThreshold(sensitivity),
				(event: SlamEvent) => {
					const now = event.timestamp;
					if (firstTapAt && now - firstTapAt < DOUBLE_TAP_WINDOW_MS) {
						// Second tap within the window → delete last solve
						firstTapAt = 0;
						const lastSolve = fetchLastSolve({ session_id: getSettings().session_id });
						if (lastSolve) {
							deleteSolveDb(lastSolve);
							hapticImpact('heavy');
						}
					} else {
						firstTapAt = now;
					}
				},
				DELETE_REFRACTORY_MS
			).then((result) => {
				owner = result;
				if (cancelled) stopSlamDetector(owner);
			});
		}, ARM_DELAY_MS);

		return () => {
			cancelled = true;
			clearTimeout(armTimer);
			stopSlamDetector(owner);
		};
	}, [active, sensitivity]);
}
