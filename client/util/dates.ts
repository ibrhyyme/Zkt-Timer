import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/tr';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import 'dayjs/locale/ru';
import 'dayjs/locale/zh-cn';
import i18n from '../i18n/i18n';

// App language -> dayjs locale. Chinese is zh-cn in dayjs; without it zh fell back to Turkish.
const DAYJS_LOCALES: [string, string][] = [['tr', 'tr'], ['en', 'en'], ['es', 'es'], ['ru', 'ru'], ['zh', 'zh-cn']];
function resolveLang(lng: string): string {
	return DAYJS_LOCALES.find(([app]) => lng?.startsWith(app))?.[1] || 'tr';
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

/** Locale-aware clock time (e.g. 14:32) — used for chat style message stamps. */
export function getTimeOfDay(date: string | number | Date) {
	return dayjs(date).format('LT');
}

/** Locale-aware date without the time part (e.g. 4 Ağustos 2026). */
export function getLongDate(date: string | number | Date) {
	return dayjs(date).format('LL');
}

export function isSameCalendarDay(a: string | number | Date, b: string | number | Date) {
	return dayjs(a).isSame(dayjs(b), 'day');
}

/**
 * Returns 'today' / 'yesterday' when the date falls on either, otherwise null so
 * the caller can fall back to a formatted date. Keeps the i18n lookup in the UI layer.
 */
export function getRelativeDayKey(date: string | number | Date): 'today' | 'yesterday' | null {
	const target = dayjs(date);
	const now = dayjs();
	if (target.isSame(now, 'day')) return 'today';
	if (target.isSame(now.subtract(1, 'day'), 'day')) return 'yesterday';
	return null;
}
