/**
 * Search copy for one Algorithm Trainer category page (/trainer/algorithms/<slug>).
 *
 * Every category page used to share the catalog's title and description, so Google would
 * have folded them into one page. The server seeds the category's name and case count into
 * the `ssr` slice (server/services/trainer_category_ssr.ts) from the library it serves;
 * Header (title, meta description, breadcrumb) and PageSummary (h1 + paragraph) read it back,
 * so the server render and the first client render agree. React free so it runs in node.
 */
import type {TFunction} from 'i18next';
import {categoryToSlug} from './url/category_slug';
import {categoryInfoKey, categoryLongName} from './catalog';

export const TRAINER_CATEGORY_SSR_KEY = 'trainer_category';

export interface TrainerCategorySeo {
	slug: string;
	category: string;
	caseCount: number;
}

/** The part of a library category this needs: the served library's mains fit it. */
export interface LibraryCategoryLike {
	category: string;
	subsets: {algorithms?: readonly unknown[]}[];
}

const CATEGORY_PATH = /^\/trainer\/algorithms\/([^/]+)\/?$/;

/** The slug of a category page path, or null for any other path. */
export function trainerCategorySlugFromPath(path: string): string | null {
	const match = CATEGORY_PATH.exec(path || '');
	return match ? match[1].toLowerCase() : null;
}

function caseCountOf(category: LibraryCategoryLike): number {
	return (category.subsets || []).reduce((sum, subset) => sum + (subset?.algorithms?.length || 0), 0);
}

/** The category behind `slug` with its case count, or null when there is no such category or it is empty. */
export function findTrainerCategorySeo(library: readonly LibraryCategoryLike[], slug: string): TrainerCategorySeo | null {
	for (const category of library) {
		if (categoryToSlug(category.category) !== slug) continue;
		const caseCount = caseCountOf(category);
		return caseCount > 0 ? {slug, category: category.category, caseCount} : null;
	}
	return null;
}

/** Slugs of the categories that show cases to a visitor, in library order (the sitemap's list). */
export function trainerCategorySlugs(library: readonly LibraryCategoryLike[]): string[] {
	return library.filter((category) => caseCountOf(category) > 0).map((category) => categoryToSlug(category.category));
}

/** The seeded category when it belongs to `path`; a value left from another page is ignored. */
export function readTrainerCategorySeo(seeded: unknown, path: string): TrainerCategorySeo | null {
	const slug = trainerCategorySlugFromPath(path);
	if (!slug || !seeded || typeof seeded !== 'object') return null;
	const seo = seeded as TrainerCategorySeo;
	if (seo.slug !== slug || typeof seo.category !== 'string' || !(seo.caseCount > 0)) return null;
	return seo;
}

/** The first sentence of a category description; Chinese ends sentences with "。" and no space. */
export function firstSentence(text: string): string {
	const trimmed = (text || '').trim();
	const match = /^[\s\S]+?(?:[.!?](?=\s|$)|[。！？])/.exec(trimmed);
	return match ? match[0] : trimmed;
}

/** Title and meta description of a category page in the language of `t`. */
export function trainerCategoryCopy(seo: TrainerCategorySeo, t: TFunction): {title: string; description: string} {
	const key = categoryInfoKey(seo.category);
	const longName = categoryLongName(seo.category, t(`trainer.cat_info.${key}.title`, {defaultValue: ''}));
	const heading = longName ? t('seo.trainer_category_heading', {name: seo.category, longName}) : seo.category;
	const lead = firstSentence(t(`trainer.cat_info.${key}.desc`, {defaultValue: ''}));
	return {
		title: t('seo.trainer_category_title', {name: seo.category, count: seo.caseCount}),
		description: t('seo.trainer_category_description', {heading, lead, count: seo.caseCount})
			.replace(/\s+/g, ' ')
			.trim(),
	};
}
