import type {Store} from 'redux';
import {setSsrValue} from '../../client/actions/ssr';
import {
	findTrainerCategorySeo,
	TRAINER_CATEGORY_SSR_KEY,
	trainerCategorySlugFromPath,
} from '../../client/util/trainer/category_seo';
import {getTrainerLibrary} from '../util/trainer_library';
import {logger} from './logger';

/**
 * Seeds a trainer category page's name and case count into the SSR store, so its title,
 * description and h1 name the category (client/util/trainer/category_seo.ts). Read from the
 * library the server serves, which is what a visitor's category page shows. Other paths are
 * left alone; an unknown slug writes null and the page keeps the catalog's copy.
 */
export function seedTrainerCategory(store: Store<any>, path: string): void {
	const slug = trainerCategorySlugFromPath(path);
	if (!slug) return;
	try {
		store.dispatch(setSsrValue(TRAINER_CATEGORY_SSR_KEY, findTrainerCategorySeo(getTrainerLibrary().mains, slug)));
	} catch (e) {
		logger.warn('SSR trainer category seed failed', {path, error: (e as Error)?.message || e});
	}
}
