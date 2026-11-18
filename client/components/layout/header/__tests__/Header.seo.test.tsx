jest.mock('../../../battle/useBattleLaunch', () => ({useBattleLaunch: () => null}));
// What the server seeded into the `ssr` slice; the real reader decides whether it fits the path.
let mockSeededCategory: unknown = null;
jest.mock('../../../../util/trainer/useTrainerCategorySeo', () => {
	const {readTrainerCategorySeo} = jest.requireActual('../../../../util/trainer/category_seo');
	return {useTrainerCategorySeo: (path: string) => readTrainerCategorySeo(mockSeededCategory, path)};
});

import React from 'react';
import ReactDOM from 'react-dom/server';
import Helmet from 'react-helmet';
import {I18nextProvider} from 'react-i18next';
import {createI18nInstance} from '../../../../../server/i18n_server';
import Header from '../Header';

/** The <head> link tags react-helmet produces for `path` rendered in `lang`, as SSR sends them. */
function headLinks(path: string, lang: string): string {
	ReactDOM.renderToString(
		<I18nextProvider i18n={createI18nInstance(lang)}>
			<Header path={path} />
		</I18nextProvider>
	);
	return Helmet.renderStatic().link.toString();
}

describe('Header language URLs', () => {
	it('makes each translation its own canonical page', () => {
		expect(headLinks('/timer', 'en')).toContain('rel="canonical" href="https://zktimer.app/timer"');
		expect(headLinks('/timer', 'tr')).toContain('rel="canonical" href="https://zktimer.app/timer?lang=tr"');
	});

	it('links every translation with hreflang on an indexable page', () => {
		const links = headLinks('/trainer', 'tr');
		expect(links).toContain('hrefLang="tr" href="https://zktimer.app/trainer?lang=tr"');
		expect(links).toContain('hrefLang="en" href="https://zktimer.app/trainer"');
		expect(links).toContain('hrefLang="zh-Hans" href="https://zktimer.app/trainer?lang=zh"');
		expect(links).toContain('hrefLang="x-default" href="https://zktimer.app/trainer"');
	});

	it('leaves hreflang off noindex pages', () => {
		expect(headLinks('/settings', 'tr')).not.toContain('hrefLang');
	});
});

/** The <title>, meta tags and link tags react-helmet produces for `path` in `lang`. */
function head(path: string, lang: string): {title: string; meta: string; links: string} {
	ReactDOM.renderToString(
		<I18nextProvider i18n={createI18nInstance(lang)}>
			<Header path={path} />
		</I18nextProvider>
	);
	const helmet = Helmet.renderStatic();
	return {title: helmet.title.toString(), meta: helmet.meta.toString(), links: helmet.link.toString()};
}

describe('Header trainer category pages', () => {
	afterEach(() => {
		mockSeededCategory = null;
	});

	it('gives each category page its own title, description and self canonical', () => {
		mockSeededCategory = {slug: 'oll', category: 'OLL', caseCount: 57};
		const oll = head('/trainer/algorithms/oll', 'tr');
		expect(oll.title).toContain('OLL Trainer: 57 algoritma | ZKT Timer');
		expect(oll.meta).toContain('name="description" content="Son Katmanı Yönlendirme (OLL).');
		expect(oll.links).toContain('rel="canonical" href="https://zktimer.app/trainer/algorithms/oll?lang=tr"');
		expect(oll.links).toContain('hrefLang="x-default" href="https://zktimer.app/trainer/algorithms/oll"');
		expect(oll.meta).not.toContain('noindex');

		mockSeededCategory = {slug: 'pll', category: 'PLL', caseCount: 21};
		const pll = head('/trainer/algorithms/pll', 'en');
		expect(pll.title).toContain('PLL Trainer: 21 algorithms | ZKT Timer');
		expect(pll.links).toContain('rel="canonical" href="https://zktimer.app/trainer/algorithms/pll"');
	});

	it('keeps the catalog copy when the seeded category is not this page', () => {
		mockSeededCategory = {slug: 'oll', category: 'OLL', caseCount: 57};
		const i18n = createI18nInstance('en');
		expect(head('/trainer/algorithms/pll', 'en').title).toContain(i18n.t('seo.trainer_algorithms_title'));
	});

	it('marks the study screen, the judge tool and the native data bridge noindex', () => {
		expect(head('/trainer/algorithms/train', 'en').meta).toContain('content="noindex, nofollow"');
		expect(head('/judge/approve', 'en').meta).toContain('content="noindex, nofollow"');
		expect(head('/native-migrate', 'en').meta).toContain('content="noindex, nofollow"');
	});
});
