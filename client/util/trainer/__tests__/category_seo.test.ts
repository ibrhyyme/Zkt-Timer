import {createI18nInstance} from '../../../../server/i18n_server';
import {
	findTrainerCategorySeo,
	firstSentence,
	readTrainerCategorySeo,
	trainerCategoryCopy,
	trainerCategorySlugFromPath,
	trainerCategorySlugs,
} from '../category_seo';

const LIBRARY = [
	{category: 'OLL', subsets: [{algorithms: [1, 2, 3]}, {algorithms: [4, 5]}]},
	{category: '2x2 EG1', subsets: [{algorithms: [1]}]},
	{category: 'Empty', subsets: [{algorithms: []}]},
];

describe('trainer category page SEO', () => {
	it('reads the slug of a category page path only', () => {
		expect(trainerCategorySlugFromPath('/trainer/algorithms/oll')).toBe('oll');
		expect(trainerCategorySlugFromPath('/trainer/algorithms/OLL/')).toBe('oll');
		expect(trainerCategorySlugFromPath('/trainer/algorithms')).toBeNull();
		expect(trainerCategorySlugFromPath('/trainer/algorithms/oll/extra')).toBeNull();
		expect(trainerCategorySlugFromPath('/trainer/sets/my-set-Ab3dE6gH9k')).toBeNull();
	});

	it('finds the category with its case count across subsets', () => {
		expect(findTrainerCategorySeo(LIBRARY, 'oll')).toEqual({slug: 'oll', category: 'OLL', caseCount: 5});
		expect(findTrainerCategorySeo(LIBRARY, '2x2-eg1')).toEqual({slug: '2x2-eg1', category: '2x2 EG1', caseCount: 1});
		expect(findTrainerCategorySeo(LIBRARY, 'train')).toBeNull();
		expect(findTrainerCategorySeo(LIBRARY, 'empty')).toBeNull();
	});

	it('lists only categories that have cases', () => {
		expect(trainerCategorySlugs(LIBRARY)).toEqual(['oll', '2x2-eg1']);
	});

	it('ignores a seeded category that belongs to another page', () => {
		const seeded = {slug: 'oll', category: 'OLL', caseCount: 57};
		expect(readTrainerCategorySeo(seeded, '/trainer/algorithms/oll')).toEqual(seeded);
		expect(readTrainerCategorySeo(seeded, '/trainer/algorithms/pll')).toBeNull();
		expect(readTrainerCategorySeo(seeded, '/trainer/algorithms')).toBeNull();
		expect(readTrainerCategorySeo(null, '/trainer/algorithms/oll')).toBeNull();
	});

	it('cuts the first sentence in Latin and Chinese text', () => {
		expect(firstSentence('OLL is the third step. There are 57 cases.')).toBe('OLL is the third step.');
		expect(firstSentence('OLL 是第三步。共有 57 种情况。')).toBe('OLL 是第三步。');
		expect(firstSentence('No full stop')).toBe('No full stop');
	});

	it('names the category, its long name and its case count in each language', () => {
		const oll = {slug: 'oll', category: 'OLL', caseCount: 57};
		const tr = trainerCategoryCopy(oll, createI18nInstance('tr').t);
		expect(tr.title).toBe('OLL Trainer: 57 algoritma | ZKT Timer');
		expect(tr.description).toMatch(/^Son Katmanı Yönlendirme \(OLL\)\. OLL, CFOP yönteminin üçüncü adımı\. 57 vaka/);

		const zh = trainerCategoryCopy(oll, createI18nInstance('zh').t);
		expect(zh.title).toContain('57');
		expect(zh.description.startsWith('顶层朝向（OLL）。')).toBe(true);

		const en = trainerCategoryCopy({slug: 'pll', category: 'PLL', caseCount: 21}, createI18nInstance('en').t);
		expect(en.title).toBe('PLL Trainer: 21 algorithms | ZKT Timer');
		expect(en.description).not.toBe(trainerCategoryCopy(oll, createI18nInstance('en').t).description);
	});

	it('leaves the long name out when it only repeats the name', () => {
		const eg1 = trainerCategoryCopy({slug: '2x2-eg1', category: '2x2 EG1', caseCount: 40}, createI18nInstance('en').t);
		expect(eg1.description.startsWith('2x2 EG1. EG-1 is')).toBe(true);
	});
});
