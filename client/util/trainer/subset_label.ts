// Display name of a trainer subset (design .feedback/designs/trainer-sets.md section 8.3).
//
// The raw subset name in default-algs.json ("Adj corners", "P shape", "Case 12") stays the
// data key: set rows and localStorage use it. Screens show `trainer.subset_names.<slug>`
// and fall back to the raw name when there is no translation (group names such as Sune,
// T1, AS6 and "OLL 21" are proper names and have none). The picker, set page, PDF and
// search all go through this file so a subset reads the same everywhere.

type Translate = (key: string, options?: any) => string;

/** The subset of a category that has only one group. Not shown as a group heading. */
export const HIDDEN_SUBSET = 'Default';

const CASE_N = /^Case (\d+)$/;
const SLASH_N = /^(\d+) Slash(?:es)?$/;

/** Translation key part of a subset name: "Adj corners" -> "adj_corners", "2 Adj / 2" -> "2_adj_2". */
export function subsetSlug(subset: string): string {
	return subset
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

export function subsetTranslationKey(subset: string): string {
	return `trainer.subset_names.${subsetSlug(subset)}`;
}

export function isHiddenSubset(subset: string | null | undefined): boolean {
	return subset === HIDDEN_SUBSET;
}

/**
 * Translated subset name, or the raw name when no translation exists.
 * The hidden "Default" subset returns '': callers skip its heading or checkbox.
 */
export function subsetLabel(t: Translate, subset: string | null | undefined): string {
	if (!subset || isHiddenSubset(subset)) return '';

	const caseMatch = CASE_N.exec(subset);
	if (caseMatch) return t('trainer.subset_case_n', {n: Number(caseMatch[1]), defaultValue: subset});

	const slashMatch = SLASH_N.exec(subset);
	if (slashMatch) return t('trainer.subset_slash_n', {n: Number(slashMatch[1]), defaultValue: subset});

	const slug = subsetSlug(subset);
	if (!slug) return subset;
	return t(`trainer.subset_names.${slug}`, {defaultValue: subset});
}

/**
 * Text a search matches a subset against: the translated name and the raw name, so
 * "P şekli" and "P shape" both find it. Not folded; the search folds both sides itself
 * (case and Turkish letters, client/util/trainer/case_search.ts).
 */
export function subsetSearchText(t: Translate, subset: string | null | undefined): string {
	if (!subset || isHiddenSubset(subset)) return '';
	const label = subsetLabel(t, subset);
	return label && label !== subset ? `${label} ${subset}` : subset;
}
