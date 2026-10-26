// Crawlable addresses for the translations of a page.
//
// The language used to live only in the zkt_language cookie, so every page had one
// URL and search engines, which send no cookie and usually no Accept-Language, only
// ever saw the English version: the Turkish, Spanish, Russian and Chinese pages were
// never indexed. Now `?lang=tr` pins a page to a language. The SSR router renders that
// language, hreflang links tie the versions together, and the sitemap lists each one.
//
// The fallback language keeps the bare path, so every URL indexed before stays the
// canonical address of the English page.
//
// Pure: imported by the SSR router, the sitemap job and the client header.

import {FALLBACK_LANGUAGE, SUPPORTED_LANGUAGES, SupportedLanguage, matchSupportedLanguage} from './i18n_language';

export const LANGUAGE_QUERY_PARAM = 'lang';

/** hreflang value per shipped language. The Chinese translation is Simplified. */
const HREFLANG: Record<SupportedLanguage, string> = {
	tr: 'tr',
	en: 'en',
	es: 'es',
	ru: 'ru',
	zh: 'zh-Hans',
};

/** `?lang=` value of a request, or null when absent or not a language we ship. */
export function languageFromQuery(value: unknown): SupportedLanguage | null {
	return typeof value === 'string' ? matchSupportedLanguage(value) : null;
}

/** Address of `path` (no query) in `lang`. */
export function localizedPath(path: string, lang: SupportedLanguage): string {
	// "/" redirects anonymous visitors to /welcome but stays the canonical home page, as
	// it always was. A translation points at /welcome itself, so its address answers 200
	// instead of a redirect (search engines drop hreflang targets that redirect).
	if (path === '/' || path === '/welcome') {
		return lang === FALLBACK_LANGUAGE ? '/' : `/welcome?${LANGUAGE_QUERY_PARAM}=${lang}`;
	}
	return lang === FALLBACK_LANGUAGE ? path : `${path}?${LANGUAGE_QUERY_PARAM}=${lang}`;
}

export interface LanguageAlternate {
	hrefLang: string;
	path: string;
}

/** One hreflang alternate per shipped language, plus x-default on the fallback language. */
export function languageAlternates(path: string): LanguageAlternate[] {
	return [
		...SUPPORTED_LANGUAGES.map((lang) => ({hrefLang: HREFLANG[lang], path: localizedPath(path, lang)})),
		{hrefLang: 'x-default', path: localizedPath(path, FALLBACK_LANGUAGE)},
	];
}
