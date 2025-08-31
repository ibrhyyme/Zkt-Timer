import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/tr';

dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.locale('tr');

export function getDateFromNow(date: string | number | Date, withoutSuffix: boolean = false): string {
	return dayjs(date).fromNow(withoutSuffix);
}

export function getFullFormattedDate(date: string | number | Date) {
	return dayjs(date).format('LLL');
}
