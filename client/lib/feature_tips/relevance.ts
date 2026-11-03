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

/**
 * When this user started here: the time of the first solve on the device, imported solves
 * left out (a csTimer history says nothing about when they came to ZKT Timer). Null when
 * there is none, which is a first visit: the onboarding hints have the screen then.
 */
export function firstSolveTime(): number | null {
	try {
		let first = Infinity;
		for (const solve of getSolveDb()?.find() || []) {
			if (solve.bulk) continue;
			const at = Number(solve.ended_at) || Number(solve.started_at);
			if (at > 0 && at < first) first = at;
		}
		return Number.isFinite(first) ? first : null;
	} catch {
		return null;
	}
}
