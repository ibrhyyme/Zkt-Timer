import {createI18nInstance} from '../../i18n_server';
import {formatCompTime} from '../../services/CompetitionLifecycle';
import {lifecycleLocale} from './competition_lifecycle_base';

/**
 * Text for the ZKT competition announcement and its registration reminder.
 *
 * Broadcast to every user with push enabled, so there is no Notification row
 * per user (the existing announcement broadcast writes none either): just a
 * localized title and body per recipient language.
 *
 * - announced:         new competition, registration opens at a known time
 * - announced_open:    new competition whose registration is already open
 * - announced_no_date: new competition without a usable opening time
 * - reminder:          registration opens shortly
 * - opened:            the organizer opened registration before the reminder went out
 */
export type ZktAnnouncementStage = 'announced' | 'announced_open' | 'announced_no_date' | 'reminder' | 'opened';

export interface ZktAnnouncementInput {
	stage: ZktAnnouncementStage;
	competitionName: string;
	openAt: Date | null;
	timezone: string | null;
}

export function buildZktAnnouncementText(locale: string, input: ZktAnnouncementInput): {title: string; body: string} {
	const lng = lifecycleLocale(locale);
	const i18n = createI18nInstance(lng);
	const t = (key: string, vars?: any) => i18n.t(`my_schedule.${key}`, vars) as string;
	const competitionName = input.competitionName;
	const tz = input.timezone || 'Europe/Istanbul';

	switch (input.stage) {
		case 'announced':
			return {
				title: t('notif_zkt_announced_title', {competitionName}),
				body: t('notif_zkt_announced_body', {openAt: formatCompTime(input.openAt, tz, lng, 'date_time')}),
			};
		case 'announced_open':
			return {
				title: t('notif_zkt_announced_title', {competitionName}),
				body: t('notif_zkt_announced_open_body'),
			};
		case 'announced_no_date':
			return {
				title: t('notif_zkt_announced_title', {competitionName}),
				body: t('notif_zkt_announced_no_date_body'),
			};
		case 'reminder':
			return {
				title: t('notif_zkt_reminder_title', {competitionName}),
				body: t('notif_zkt_reminder_body', {time: formatCompTime(input.openAt, tz, lng, 'time')}),
			};
		case 'opened':
			return {
				title: t('notif_zkt_opened_title', {competitionName}),
				body: t('notif_zkt_opened_body'),
			};
	}
}
