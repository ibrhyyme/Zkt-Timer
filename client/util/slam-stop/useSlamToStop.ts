import { useEffect, useRef } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useMe } from '../hooks/useMe';
import { isPro, isProEnabled } from '../../lib/pro';
import { startSlamDetector, stopSlamDetector, isSlamDetectorAvailable, SlamEvent } from './plugin';
import { useSlamStop, sensitivityToThreshold } from './settings';
import { endTimer } from '../../components/timer/helpers/events';
import { smartCubeSelected } from '../../components/timer/helpers/util';
import { ITimerContext } from '../../components/timer/Timer';

// Ignore slams in the first moments after start — kills accidental
// early stops from the phone being set down on the table.
const ARM_DELAY_MS = 400;

/**
 * Arms the native slam detector while a touch-timer solve is running.
 * Native-only, touch timer type only, stop-only (start flow untouched).
 * Mounted in KeyWatcher alongside the regular touch/keyboard handlers.
 */
export function useSlamToStop(context: ITimerContext) {
	const { enabled, sensitivity } = useSlamStop();
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	// The enabled flag lives in localStorage, so a user who turned it on while Pro
	// would keep it working after the subscription expired. Gate at arm time,
	// mirroring the ExtrasTab toggle condition (`isProEnabled() && isNotPro(me)`).
	const me = useMe();
	const proAllowed = !isProEnabled() || isPro(me);

	// Context identity changes every render — keep the callback fresh via ref
	// so the effect only restarts on meaningful flag changes.
	const contextRef = useRef(context);
	contextRef.current = context;

	const solving = !!context.timeStartedAt;
	const active =
		isSlamDetectorAvailable() &&
		enabled &&
		proAllowed &&
		timerType === 'keyboard' &&
		!manualEntry &&
		!smartCubeSelected(context) &&
		solving;

	useEffect(() => {
		if (!active) return;

		let owner: symbol | null = null;
		let cancelled = false;

		startSlamDetector(sensitivityToThreshold(sensitivity), (event: SlamEvent) => {
			const ctx = contextRef.current;
			const startedAt = ctx.timeStartedAt;
			if (!startedAt) return;
			if (event.timestamp - startedAt.getTime() < ARM_DELAY_MS) return;

			// Same stop path as touch — endLocked + !timeStartedAt guards in
			// endTimer already prevent double-stop races with screen touches.
			endTimer(ctx, undefined, undefined, event.timestamp);
		}).then((result) => {
			owner = result;
			// Effect cleaned up while start() was in flight
			if (cancelled) {
				stopSlamDetector(owner);
			}
		});

		return () => {
			cancelled = true;
			stopSlamDetector(owner);
		};
	}, [active, sensitivity]);
}
