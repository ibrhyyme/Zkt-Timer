import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import trTranslation from './locales/tr/translation.json';
import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';
import ruTranslation from './locales/ru/translation.json';

const resources = {
	tr: { translation: trTranslation },
	en: { translation: enTranslation },
	es: { translation: esTranslation },
	ru: { translation: ruTranslation },
};

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		fallbackLng: 'tr',
		supportedLngs: ['tr', 'en', 'es', 'ru'],
		interpolation: {
			escapeValue: false,
		},
		detection: {
			order: ['localStorage', 'navigator'],
			lookupLocalStorage: 'zkt_language',
			caches: ['localStorage'],
		},
		react: {
			useSuspense: false,
		},
	});

// Client-side: update HTML lang attribute and set cookie for SSR
const SUPPORTED_LANGS = ['tr', 'en', 'es', 'ru'];
function resolveLang(lng: string): string {
	return SUPPORTED_LANGS.find((s) => lng?.startsWith(s)) || 'tr';
}

if (typeof document !== 'undefined') {
	const lng = resolveLang(i18n.language);
	document.documentElement.lang = lng;
	document.cookie = `zkt_language=${lng};path=/;max-age=31536000`;

	i18n.on('languageChanged', (newLng: string) => {
		const resolved = resolveLang(newLng);
		document.documentElement.lang = resolved;
		document.cookie = `zkt_language=${resolved};path=/;max-age=31536000`;
	});
}

export default i18n;
