import {useSelector} from 'react-redux';
import {readTrainerCategorySeo, TRAINER_CATEGORY_SSR_KEY, TrainerCategorySeo} from './category_seo';

/** The category page's name and case count the server seeded for `path`, or null (category_seo.ts). */
export function useTrainerCategorySeo(path: string): TrainerCategorySeo | null {
	const seeded = useSelector((state: any) => state?.ssr?.[TRAINER_CATEGORY_SSR_KEY]);
	return readTrainerCategorySeo(seeded, path);
}
