import { useMe } from '../hooks/useMe';
import { useSettings } from '../hooks/useSettings';
import { canUseMagnetStart } from '../../lib/magnet-start-access';
import { supportsRotate } from '../reversed-ui';
import { useMagnetAvailability } from './availability';
import { useMagnetStartSettings } from './settings';
import { magnetReversedEligible } from './reversed_eligibility';

export function useMagnetReversed(opts: {
	mobileLayout: boolean;
	inModal: boolean;
	matchMode: boolean;
	streamer: boolean;
}): boolean {
	const me = useMe();
	const { enabled, reversed } = useMagnetStartSettings();
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const allowed = canUseMagnetStart(me);
	const caps = useMagnetAvailability(allowed && enabled);

	return magnetReversedEligible({
		allowed,
		enabled,
		reversedSetting: reversed,
		caps,
		timerType,
		manualEntry: !!manualEntry,
		mobileLayout: opts.mobileLayout,
		inModal: opts.inModal,
		matchMode: opts.matchMode,
		streamer: opts.streamer,
		rotateSupported: supportsRotate(),
	});
}
