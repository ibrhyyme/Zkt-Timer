jest.mock('../../../battle/useBattleLaunch', () => ({useBattleLaunch: () => null}));

import React from 'react';
import ReactDOM from 'react-dom/server';
import {I18nextProvider} from 'react-i18next';
import {createI18nInstance} from '../../../../../server/i18n_server';
import PageSummary from '../PageSummary';

/** The markup a crawler gets for `path` in `lang` while the App shell is still booting. */
function render(path: string, lang: string): string {
	return ReactDOM.renderToStaticMarkup(
		<I18nextProvider i18n={createI18nInstance(lang)}>
			<PageSummary path={path} />
		</I18nextProvider>
	);
}

describe('PageSummary', () => {
	it('prints the page title and description that its <head> carries', () => {
		const i18n = createI18nInstance('en');
		const html = render('/trainer', 'en');
		expect(html).toContain(`<h1 class="zt-page-summary__title">`);
		expect(html).toContain(i18n.t('seo.trainer_description').replace(/'/g, '&#x27;'));
		expect(html).not.toBe('');
	});

	it('links the main sections with real hrefs in the page language', () => {
		const html = render('/competitions', 'tr');
		expect(html).toContain('href="/timer?lang=tr"');
		expect(html).toContain('href="/trainer?lang=tr"');
		expect(html).toContain('href="/help?lang=tr"');
		expect(render('/competitions', 'en')).toContain('href="/timer"');
	});

	it('renders nothing on noindex pages', () => {
		expect(render('/settings', 'en')).toBe('');
		expect(render('/competitions/zkt-some-open', 'en')).toBe('');
		expect(render('/battle/online', 'en')).toBe('');
	});

	it('renders nothing on a path with no copy of its own', () => {
		expect(render('/solve/abc123', 'en')).toBe('');
	});
});
