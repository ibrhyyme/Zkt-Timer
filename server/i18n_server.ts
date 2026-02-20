import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import trTranslation from '../client/i18n/locales/tr/translation.json';
import enTranslation from '../client/i18n/locales/en/translation.json';
import esTranslation from '../client/i18n/locales/es/translation.json';
import ruTranslation from '../client/i18n/locales/ru/translation.json';

const resources = {
	tr: { translation: trTranslation },
	en: { translation: enTranslation },
	es: { translation: esTranslation },
	ru: { translation: ruTranslation },
};

export function createI18nInstance(lng: string = 'tr') {
	const instance = i18n.createInstance();
	instance.use(initReactI18next).init({
		resources,
		lng,
		fallbackLng: 'tr',
		supportedLngs: ['tr', 'en', 'es', 'ru'],
		interpolation: {
			escapeValue: false,
		},
		react: {
			useSuspense: false,
		},
	});
	return instance;
}
