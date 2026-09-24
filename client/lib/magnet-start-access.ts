import { UserAccount } from '../../server/schemas/UserAccount.schema';

// Magnet lift-to-start ("Kaldırınca Başlat") is in its admin field test. This is the
// single switch point: opening it to Pro later means returning
// `!isProEnabled() || isPro(me)` here, adding the pro_features registry entry, and the
// locked row in ExtrasTab (see .claude/skills/magnet-start/SKILL.md).
export function canUseMagnetStart(me?: UserAccount | null): boolean {
	return !!me?.admin;
}
