// Pure eligibility rule for reversed use, kept apart from the hook so it is unit tested
// without the settings DB and the store.
import type { MagnetCapabilities } from './types';

export interface ReversedEligibilityInput {
	allowed: boolean;
	enabled: boolean;
	reversedSetting: boolean;
	/** undefined while the native probe runs, null when the plugin is unavailable. */
	caps: MagnetCapabilities | null | undefined;
	timerType: string;
	manualEntry: boolean;
	mobileLayout: boolean;
	inModal: boolean;
	matchMode: boolean;
	streamer: boolean;
	rotateSupported: boolean;
}

/**
 * Reversed use only makes sense with magnet lift-to-start on the touch timer, and only in
 * the mobile layout (width < 1024, which counts an unfolded foldable). A running solve is
 * deliberately not a condition: the screen must never flip mid-solve. A probe still in
 * flight counts as available so the page does not flash upright on mount.
 */
export function magnetReversedEligible(i: ReversedEligibilityInput): boolean {
	return (
		i.allowed &&
		i.enabled &&
		i.reversedSetting &&
		i.caps !== null &&
		i.timerType === 'keyboard' &&
		!i.manualEntry &&
		i.mobileLayout &&
		!i.inModal &&
		!i.matchMode &&
		!i.streamer &&
		i.rotateSupported
	);
}
