// "New feature" tips: one small bubble on the timer that tells a user about a feature and
// takes them to it. Only features the owner picks get a tip; fixes and small changes never
// do, or the app would talk all the time and nobody would read it (owner, 2026-11-03).
//
// Rules: one tip per app open, newest first, once per feature (answered, or shown
// FEATURE_TIP_MAX_VIEWS times), never during a solve, never on a device with no solves yet
// (a first visit, where everything is new), never for a feature that already existed when
// the user started (first solve on this device after its release: to them it is not new),
// not for someone already using the feature, and gone FEATURE_TIP_LIFETIME_DAYS after
// release. Stored on the device only: no server, no push. A tip ships with a deploy, like
// the feature it points at. Workflow for adding one: the feature-tip skill.
//
// Pure, so the picking rules are tested in node. Adding a tip = an entry here, its
// sentence under feature_tips.* in the five languages, and a relevance check in
// relevance.ts when the feature has a "already using it" state.

export interface FeatureTip {
	id: string;
	/** Release day, YYYY-MM-DD (UTC). The tip shows from then for FEATURE_TIP_LIFETIME_DAYS. */
	releasedAt: string;
	/** i18n key of the feature's name, the card's title. */
	titleKey: string;
	/** i18n key of the sentence under it. */
	textKey: string;
	/** Where "Take a look" goes. */
	to: string;
	/** A live picture of the feature beside the text (timer/feature_tip/FeatureTip.tsx). */
	visual?: 'preset_backgrounds';
}

export const FEATURE_TIPS: FeatureTip[] = [
	{
		id: 'preset_backgrounds',
		releasedAt: '2026-11-03',
		titleKey: 'feature_tips.preset_backgrounds_title',
		textKey: 'feature_tips.preset_backgrounds',
		to: '/settings/appearance',
		visual: 'preset_backgrounds',
	},
];

export const FEATURE_TIP_LIFETIME_DAYS = 30;
/** Shown this many times without an answer, a tip counts as seen. */
export const FEATURE_TIP_MAX_VIEWS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface FeatureTipState {
	/** Tips answered (Take a look or close), or seen on the page itself. */
	seen: string[];
	/** How many times each tip has been shown. */
	views: Record<string, number>;
}

export function emptyFeatureTipState(): FeatureTipState {
	return { seen: [], views: {} };
}

/** Anything unreadable starts over rather than throwing. */
export function parseFeatureTipState(raw: string | null | undefined): FeatureTipState {
	if (!raw) return emptyFeatureTipState();
	try {
		const parsed = JSON.parse(raw);
		const seen = Array.isArray(parsed?.seen) ? parsed.seen.filter((id: unknown) => typeof id === 'string') : [];
		const views: Record<string, number> = {};
		if (parsed?.views && typeof parsed.views === 'object') {
			for (const [id, n] of Object.entries(parsed.views)) {
				if (typeof n === 'number' && Number.isFinite(n)) views[id] = n;
			}
		}
		return { seen, views };
	} catch {
		return emptyFeatureTipState();
	}
}

/** Start of the release day in ms (UTC), NaN when unreadable. */
export function featureTipReleaseTime(tip: FeatureTip): number {
	return Date.parse(`${tip.releasedAt}T00:00:00Z`);
}

export function isFeatureTipLive(tip: FeatureTip, now: number): boolean {
	const start = featureTipReleaseTime(tip);
	if (!Number.isFinite(start)) return false;
	return now >= start && now < start + FEATURE_TIP_LIFETIME_DAYS * DAY_MS;
}

/**
 * The tip to show now, or null.
 * @param isRelevant "is this user not using the feature yet".
 * @param startedAt when this user started here (first solve on the device), null if unknown.
 *   A tip released before that is skipped: the feature was already there when they came.
 */
export function pickFeatureTip(
	tips: FeatureTip[],
	state: FeatureTipState,
	now: number,
	isRelevant: (tip: FeatureTip) => boolean = () => true,
	startedAt: number | null = null
): FeatureTip | null {
	// Newest release first; the list order breaks ties.
	const ordered = tips
		.map((tip, index) => ({ tip, index, release: featureTipReleaseTime(tip) }))
		.sort((a, b) => b.release - a.release || a.index - b.index);
	for (const { tip, release } of ordered) {
		if (!isFeatureTipLive(tip, now)) continue;
		if (startedAt !== null && startedAt >= release) continue;
		if (state.seen.includes(tip.id)) continue;
		if ((state.views[tip.id] || 0) >= FEATURE_TIP_MAX_VIEWS) continue;
		if (!isRelevant(tip)) continue;
		return tip;
	}
	return null;
}
