import { UserAccount } from '../../server/schemas/UserAccount.schema';

// The Kamera Timer (timer_type 'camera') is in its first test: admins only (owner,
// 2026-11-03). The single switch point, read wherever the feature is consumed: the pickers
// (useTimerChoices), useCameraTimerOwnsInput (KeyWatcher, TimeDisplay) and the brain probe.
// The server checks the same rule before it hands out the brain (server/api/camera_timer.ts),
// so opening it to more people means changing both.
export function canUseCameraTimer(me?: UserAccount | null): boolean {
	return !!me?.admin;
}
