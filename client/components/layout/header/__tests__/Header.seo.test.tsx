jest.mock('../../../battle/useBattleLaunch', () => ({useBattleLaunch: () => null}));

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
