import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/tr';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import 'dayjs/locale/ru';
import i18n from '../i18n/i18n';

const SUPPORTED_LANGS = ['tr', 'en', 'es', 'ru'];
function resolveLang(lng: string): string {
	return SUPPORTED_LANGS.find((s) => lng?.startsWith(s)) || 'tr';
}

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.locale(resolveLang(i18n.language));

i18n.on('languageChanged', (lng: string) => {
	dayjs.locale(resolveLang(lng));
});

export function getDateFromNow(date: string | number | Date, withoutSuffix: boolean = false): string {
	return dayjs(date).fromNow(withoutSuffix);
}

export function getFullFormattedDate(date: string | number | Date) {
	return dayjs(date).format('LLL');
}
