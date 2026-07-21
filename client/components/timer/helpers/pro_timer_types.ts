import { AllSettings } from '../../../db/settings/query';

/**
 * Timer types that require Pro inside Friendly Rooms.
 *
 * Single source of truth: the pickers (TimerTypePicker, TimerTypeGrid) use it to
 * disable the cards, and FriendlyRoom uses it to downgrade an already-selected
 * gated type on join. `timer_type` is a global setting, so UI-only gating is
 * bypassable by selecting the type on the timer page first.
 */
export const PRO_GATED_TIMER_TYPES = new Set<string>(['smart', 'gantimer', 'qiyitimer']);

export function isProGatedTimerType(timerType: AllSettings['timer_type'] | string): boolean {
	return PRO_GATED_TIMER_TYPES.has(timerType);
}
