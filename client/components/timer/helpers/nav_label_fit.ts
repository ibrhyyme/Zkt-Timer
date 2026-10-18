/**
 * Önceki and Sonraki on the mobile action row carry their labels when the row has room for
 * them. The room depends on the phone and on the language: the Russian labels are almost
 * twice as wide as the Turkish ones. Without room the two buttons fall back to arrows only.
 *
 * `needed` is the row's content width measured while the labels were shown. It is kept while
 * they are hidden, so they come back once the row is wide enough again (a rotation, a wider
 * window) without measuring a layout that is not on screen.
 */
export interface NavLabelFit {
	shown: boolean;
	needed: number;
}

export const NAV_LABELS_SHOWN: NavLabelFit = { shown: true, needed: 0 };

/** Breathing room kept between the left group and Önceki, so the two never touch. */
export const NAV_LABEL_MIN_GAP_PX = 8;

/**
 * @param available the row's inner width (clientWidth)
 * @param contentWithLabels the row's content width with the labels shown, null when they
 *   are hidden (it cannot be measured then)
 */
export function nextNavLabelFit(current: NavLabelFit, available: number, contentWithLabels: number | null): NavLabelFit {
	if (!(available > 0)) return current;

	if (current.shown) {
		if (contentWithLabels === null || !Number.isFinite(contentWithLabels)) return current;
		const needed = contentWithLabels + NAV_LABEL_MIN_GAP_PX;
		return needed <= available ? current : { shown: false, needed };
	}

	return current.needed > 0 && current.needed <= available ? NAV_LABELS_SHOWN : current;
}
