import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import trTranslation from '../client/i18n/locales/tr/translation.json';
import enTranslation from '../client/i18n/locales/en/translation.json';

const resources = {
	tr: { translation: trTranslation },
	en: { translation: enTranslation },
};

export function createI18nInstance(lng: string = 'tr') {
	const instance = i18n.createInstance();
	instance.use(initReactI18next).init({
		resources,
		lng,
		fallbackLng: 'tr',
		supportedLngs: ['tr', 'en'],
		interpolation: {
			escapeValue: false,
		},
		react: {
			useSuspense: false,
		},
	});
	return instance;
}
