// "Is this user not using the feature yet?" per tip. Kept apart from feature_tips.ts, which
// stays pure, because these read the device's settings and solves.

import { getSetting } from '../../db/settings/query';
import { getSolveDb } from '../../db/solves/init';
import { isPresetBackgroundId } from '../../components/timer/timer_background/presets/preset_shaders';
import { FeatureTip } from './feature_tips';

export function isFeatureTipRelevant(tip: FeatureTip): boolean {
	try {
		switch (tip.id) {
			case 'preset_backgrounds':
				return !isPresetBackgroundId(getSetting('timer_bg_preset'));
			default:
				return true;
		}
	} catch {
		return false;
	}
}

/** A device with no solve yet is a first visit: the onboarding hints have the screen. */
export function hasSolvesOnDevice(): boolean {
	try {
		return (getSolveDb()?.count() || 0) > 0;
	} catch {
		return false;
	}
}
