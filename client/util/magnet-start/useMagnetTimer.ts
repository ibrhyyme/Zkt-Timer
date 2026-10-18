import { useMe } from '../hooks/useMe';
import { useSettings } from '../hooks/useSettings';
import { canUseMagnetStart } from '../../lib/magnet-start-access';
import { magnetTimerOwnsInput } from '../../components/timer/helpers/timer_type_catalog';
import { useMagnetAvailability } from './availability';
import { isSlamDetectorAvailable } from '../slam-stop/plugin';

/**
 * Whether the Magnet Timer drives the timer right now: lifting the cube starts, dropping it
 * stops, and touch neither starts nor stops. False for every other input, and for a Magnet
 * selection that lost Pro or whose sensor probe failed: those fall back to the touch timer
 * instead of leaving a timer nothing can start.
 *
 * Pro is checked here, at the point of consumption (KeyWatcher, the overlay, slam-to-stop,
 * the detector), not only in the picker: the selection is a synced setting that outlives a
 * subscription. There is no server resource to gate, the feature is client only.
 */
export function useMagnetTimerOwnsInput(): boolean {
	const me = useMe();
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const allowed = canUseMagnetStart(me);
	const caps = useMagnetAvailability(timerType === 'magnet' && allowed);
	// Without the slam detector nothing could stop the solve (touch does not), so the input
	// falls back to the touch timer like a failed magnet probe.
	return magnetTimerOwnsInput({
		timerType,
		manualEntry: !!manualEntry,
		allowed,
		caps: isSlamDetectorAvailable() ? caps : null,
	});
}
