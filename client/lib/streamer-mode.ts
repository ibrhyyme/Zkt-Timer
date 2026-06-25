import { UserAccount } from '../../server/schemas/UserAccount.schema';

// Streamer Mode is a niche feature: only the admin and one specific streamer
// (Mert) may see/use the toggle. Single source of truth for that gate, reused
// by the header button, the mobile quick-settings toggle, and the mirror class.
export const STREAMER_MODE_EMAIL = 'mertsagdinc@gmail.com';

export function canUseStreamerMode(me?: UserAccount | null): boolean {
	return !!me && (me.admin || me.email === STREAMER_MODE_EMAIL);
}
