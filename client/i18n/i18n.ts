import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import trTranslation from './locales/tr/translation.json';
import enTranslation from './locales/en/translation.json';

const resources = {
	tr: { translation: trTranslation },
	en: { translation: enTranslation },
};

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		fallbackLng: 'tr',
		supportedLngs: ['tr', 'en'],
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
if (typeof document !== 'undefined') {
	const lng = i18n.language?.startsWith('en') ? 'en' : 'tr';
	document.documentElement.lang = lng;
	document.cookie = `zkt_language=${lng};path=/;max-age=31536000`;

	i18n.on('languageChanged', (newLng: string) => {
		const resolved = newLng.startsWith('en') ? 'en' : 'tr';
		document.documentElement.lang = resolved;
		document.cookie = `zkt_language=${resolved};path=/;max-age=31536000`;
	});
}

export default i18n;
