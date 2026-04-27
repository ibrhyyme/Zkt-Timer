import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

interface WcaResultEnteredMeta {
	competitionId: string;
	competitionName: string;
	eventId: string;
	eventName: string;
	roundNumber: number;
	resultText: string; // Onceden formatlanmis body, orn. "Avg: 12.45 · Single: 11.20"
	locale?: string; // tr/en/es/ru — yoksa tr fallback
}

export default class WcaResultEnteredNotification extends Notification {
	private meta: WcaResultEnteredMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: WcaResultEnteredMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(meta.locale) ? meta.locale : 'en';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.WCA_RESULT_ENTERED;
	}

	subject() {
		return this.t('notif_result_title', {
			eventName: this.meta.eventName,
			roundNumber: this.meta.roundNumber,
		});
	}

	inAppMessage() {
		return `${this.meta.eventName} R${this.meta.roundNumber}: ${this.meta.resultText}`;
	}

	message() {
		return `${this.meta.competitionName} — ${this.meta.eventName} R${this.meta.roundNumber}: ${this.meta.resultText}`;
	}

	icon() {
		return 'trophy';
	}

	link() {
		return `${process.env.BASE_URI}/community/competitions/${this.meta.competitionId}/wca-live/${this.meta.eventId}/${this.meta.roundNumber}`;
	}

	linkText() {
		return this.t('notif_link_text');
	}

	categoryName() {
		return 'WCA';
	}

	customData(): object {
		return {
			competitionId: this.meta.competitionId,
			eventId: this.meta.eventId,
			roundNumber: this.meta.roundNumber,
			resultText: this.meta.resultText,
		};
	}
}
