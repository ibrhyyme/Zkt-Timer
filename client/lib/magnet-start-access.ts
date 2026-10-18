import { UserAccount } from '../../server/schemas/UserAccount.schema';
import { isPro, isProEnabled } from './pro';

// The Magnet Timer (timer_type 'magnet', formerly "Kaldırınca Başlat") is a Pro feature. This
// is the single switch point, read wherever the feature is consumed: useMagnetTimerOwnsInput
// (KeyWatcher, useMagnetStart, slam-to-stop), useMagnetReversed (turning the screen) and the
// pickers (useTimerChoices, Pro badge). Checking it at
// consumption means an expired subscription stops the detector, not only the toggle.
// Same rule as slam-to-stop's `proAllowed` (with PRO_ENABLED off everyone has it), plus
// admins: they keep the field-test panel and the telemetry readout working whether or not
// their own account holds a subscription.
export function canUseMagnetStart(me?: UserAccount | null): boolean {
	return !isProEnabled() || isPro(me ?? undefined) || !!me?.admin;
}
