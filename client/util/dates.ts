import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/tr';
import 'dayjs/locale/en';
import i18n from '../i18n/i18n';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.locale(i18n.language?.startsWith('en') ? 'en' : 'tr');

i18n.on('languageChanged', (lng: string) => {
	dayjs.locale(lng.startsWith('en') ? 'en' : 'tr');
});

export function getDateFromNow(date: string | number | Date, withoutSuffix: boolean = false): string {
	return dayjs(date).fromNow(withoutSuffix);
}

export function getFullFormattedDate(date: string | number | Date) {
	return dayjs(date).format('LLL');
}
