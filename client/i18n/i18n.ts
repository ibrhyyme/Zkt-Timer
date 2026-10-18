import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { Capacitor } from '@capacitor/core';

import trTranslation from './locales/tr/translation.json';
import enTranslation from './locales/en/translation.json';
import esTranslation from './locales/es/translation.json';
import ruTranslation from './locales/ru/translation.json';
import zhTranslation from './locales/zh/translation.json';
import {
	FALLBACK_LANGUAGE,
	SUPPORTED_LANGUAGES,
	matchSupportedLanguage,
} from '../../shared/i18n_language';

const resources = {
	tr: { translation: trTranslation },
	en: { translation: enTranslation },
	es: { translation: esTranslation },
	ru: { translation: ruTranslation },
	zh: { translation: zhTranslation },
};

const LANGUAGE_KEY = 'zkt_language';

/**
 * A language this browser already settled on: one the user picked, one a previous launch
 * detected, or (web) the cookie the SSR router set from Accept-Language. When it exists it
 * always wins; device detection below only fills the gap on a first native launch.
 */
function readSavedLanguage(): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const stored = window.localStorage.getItem(LANGUAGE_KEY);
		if (matchSupportedLanguage(stored)) return stored;
	} catch (e) {
		// Storage blocked: fall through to the cookie.
	}
	try {
		const match = document.cookie.match(/(?:^|;\s*)zkt_language=([^;]+)/);
		if (match && matchSupportedLanguage(decodeURIComponent(match[1]))) return match[1];
	} catch (e) {
		// No cookie access.
	}
	return null;
}

const savedLanguageAtBoot = readSavedLanguage();

i18n
	.use(LanguageDetector)
	.use(initReactI18next)
	.init({
		resources,
		fallbackLng: FALLBACK_LANGUAGE,
		supportedLngs: [...SUPPORTED_LANGUAGES],
		returnObjects: true,
		interpolation: {
			escapeValue: false,
		},
		detection: {
			// navigator is the last resort: the web always has the SSR cookie, so it only
			// matters in the native app, whose local bundle has no server to set one.
			order: ['localStorage', 'cookie', 'navigator'],
			lookupLocalStorage: LANGUAGE_KEY,
			lookupCookie: LANGUAGE_KEY,
			caches: ['localStorage'],
		},
		react: {
			useSuspense: false,
		},
	});

// Client-side: update HTML lang attribute and set cookie for SSR
function resolveLang(lng: string): string {
	return matchSupportedLanguage(lng) || FALLBACK_LANGUAGE;
}

/**
 * First native launch with nothing saved: follow the phone's language. The WebView's
 * navigator.language is not enough on iOS, where WKWebView reports the app's own
 * localization (English) instead of the system language, so ask the Device plugin.
 * The plugin is probed at runtime because an older native shell may not ship it
 * (OTA bundles reach builds made before it was added); without it navigator stays.
 */
async function adoptDeviceLanguage(): Promise<void> {
	if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Device')) return;
	const languageAtStart = i18n.language;
	try {
		const { Device } = await import('@capacitor/device');
		const { value } = await Device.getLanguageCode();
		const deviceLanguage = matchSupportedLanguage(value) || FALLBACK_LANGUAGE;
		// The user may have opened the language picker while the plugin answered.
		if (i18n.language !== languageAtStart) return;
		if (resolveLang(i18n.language) !== deviceLanguage) {
			await i18n.changeLanguage(deviceLanguage);
		}
	} catch (e) {
		// Keep the navigator-based guess.
	}
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

	if (!savedLanguageAtBoot) {
		adoptDeviceLanguage();
	}
}

export default i18n;
