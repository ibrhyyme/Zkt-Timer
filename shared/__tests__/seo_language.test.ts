import {languageAlternates, languageFromQuery, localizedPath} from '../seo_language';

describe('localizedPath', () => {
	it('keeps the bare path for the fallback language', () => {
		expect(localizedPath('/timer', 'en')).toBe('/timer');
		expect(localizedPath('/', 'en')).toBe('/');
	});

	it('pins other languages with ?lang=', () => {
		expect(localizedPath('/timer', 'tr')).toBe('/timer?lang=tr');
		expect(localizedPath('/trainer/algorithms', 'zh')).toBe('/trainer/algorithms?lang=zh');
	});

	it('points translated home pages at /welcome, which answers without a redirect', () => {
		expect(localizedPath('/', 'tr')).toBe('/welcome?lang=tr');
		expect(localizedPath('/welcome', 'tr')).toBe('/welcome?lang=tr');
		expect(localizedPath('/welcome', 'en')).toBe('/');
	});
});

describe('languageAlternates', () => {
	it('lists every shipped language once plus x-default on English', () => {
		const alternates = languageAlternates('/timer');
		expect(alternates.map((a) => a.hrefLang)).toEqual(['tr', 'en', 'es', 'ru', 'zh-Hans', 'x-default']);
		expect(alternates.find((a) => a.hrefLang === 'x-default')?.path).toBe('/timer');
		expect(alternates.find((a) => a.hrefLang === 'tr')?.path).toBe('/timer?lang=tr');
	});
});

describe('languageFromQuery', () => {
	it('accepts shipped languages only', () => {
		expect(languageFromQuery('tr')).toBe('tr');
		expect(languageFromQuery('TR')).toBe('tr');
		expect(languageFromQuery('de')).toBeNull();
		expect(languageFromQuery(['tr', 'en'])).toBeNull();
		expect(languageFromQuery(undefined)).toBeNull();
	});
});
