import { UserAccount } from '../../server/schemas/UserAccount.schema';
import { isPro, isProEnabled } from './pro';

// Magnet lift-to-start ("Kaldırınca Başlat") is a Pro feature. This is the single switch
// point, read wherever the feature is consumed: useMagnetStart (arming the detector),
// useMagnetReversed (turning the screen) and ExtrasTab (the toggle). Checking it at
// consumption means an expired subscription stops the detector, not only the toggle.
// Same rule as slam-to-stop's `proAllowed` (with PRO_ENABLED off everyone has it), plus
// admins: they keep the field-test panel and the telemetry readout working whether or not
// their own account holds a subscription.
export function canUseMagnetStart(me?: UserAccount | null): boolean {
	return !isProEnabled() || isPro(me ?? undefined) || !!me?.admin;
}
