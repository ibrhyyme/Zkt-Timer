import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

interface WcaCompetitionCountdownMeta {
	competitionId: string;
	competitionName: string;
	daysBefore: number; // 7 | 3 | 1
	startTime?: string; // "HH:mm" (kullanicinin yerel saati, opsiyonel)
	locale?: string;
}

export default class WcaCompetitionCountdownNotification extends Notification {
	private meta: WcaCompetitionCountdownMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: WcaCompetitionCountdownMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && ['tr', 'en', 'es', 'ru'].includes(meta.locale) ? meta.locale : 'tr';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.WCA_COMPETITION_COUNTDOWN;
	}

	subject() {
		if (this.meta.daysBefore === 1) {
			return this.t('notif_countdown_title_tomorrow', {
				competitionName: this.meta.competitionName,
			});
		}
		return this.t('notif_countdown_title_days', {
			days: this.meta.daysBefore,
			competitionName: this.meta.competitionName,
		});
	}

	inAppMessage() {
		if (this.meta.startTime) {
			return this.t('notif_countdown_body_with_time', {
				startTime: this.meta.startTime,
			});
		}
		return this.t('notif_countdown_body');
	}

	message() {
		return `${this.meta.competitionName} — ${this.inAppMessage()}`;
	}

	icon() {
		return 'calendar';
	}

	link() {
		return `${process.env.BASE_URI}/community/competitions/${this.meta.competitionId}`;
	}

	linkText() {
		return this.t('notif_countdown_link_text');
	}

	categoryName() {
		return 'WCA';
	}

	customData(): object {
		return {
			competitionId: this.meta.competitionId,
			daysBefore: this.meta.daysBefore,
			startTime: this.meta.startTime || null,
		};
	}
}
