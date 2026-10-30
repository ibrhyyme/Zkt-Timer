import { useMe } from '../hooks/useMe';
import { useSettings } from '../hooks/useSettings';
import { useSystemInputFocused } from '../hooks/useSystemInputFocused';
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
	const { reversed } = useMagnetStartSettings();
	const timerType = useSettings('timer_type');
	const manualEntry = useSettings('manual_entry');
	const allowed = canUseMagnetStart(me);
	const caps = useMagnetAvailability(allowed && timerType === 'magnet');

	const eligible = magnetReversedEligible({
		allowed,
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

	// The keyboard and native pickers open in the phone's physical orientation, so the page
	// turns upright while one is in use and back when it is done. Typing means the phone is
	// in hand anyway.
	const systemInput = useSystemInputFocused(eligible);
	return eligible && !systemInput;
}
