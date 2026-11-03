import { useMe } from '../hooks/useMe';
import { useSettings } from '../hooks/useSettings';
import { canUseCameraTimer } from '../../lib/camera-timer-access';
import { cameraTimerOwnsInput } from '../../components/timer/helpers/timer_type_catalog';
import { useCameraTimerAvailability } from './availability';

/**
 * Whether the Kamera Timer drives the timer right now. False for every other input, and for a
 * Kamera selection that may not run (not an admin, or no brain on the server): those fall back
 * to the keyboard timer instead of a timer nothing can start. The stored selection is a synced
 * setting, so the access rule is checked here, at the point of consumption.
 */
export function useCameraTimerOwnsInput(): boolean {
	const me = useMe();
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const allowed = canUseCameraTimer(me);
	const manifest = useCameraTimerAvailability(timerType === 'camera' && allowed);
	return cameraTimerOwnsInput({ timerType, manualEntry: !!manualEntry, allowed, manifest });
}
