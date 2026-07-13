import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

interface WcaRecordBrokenMeta {
	competitionId: string;
	competitionName: string;
	eventId: string;
	eventName: string;
	recordTag: string; // 'WR' | 'CR' | 'NR'
	resultText: string; // pre-formatted, e.g. "4.12"
	personName: string;
	roundNumber: number;
	locale?: string; // tr/en/es/ru/zh — falls back to en
}

export default class WcaRecordBrokenNotification extends Notification {
	private meta: WcaRecordBrokenMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: WcaRecordBrokenMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(meta.locale) ? meta.locale : 'en';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.WCA_RECORD_BROKEN;
	}

	subject() {
		return this.t('notif_record_title', {
			tag: this.meta.recordTag,
			eventName: this.meta.eventName,
		});
	}

	inAppMessage() {
		return this.t('notif_record_body', {
			personName: this.meta.personName,
			eventName: this.meta.eventName,
			tag: this.meta.recordTag,
			resultText: this.meta.resultText,
		});
	}

	message() {
		return `${this.meta.competitionName} — ${this.inAppMessage()}`;
	}

	icon() {
		return 'trophy';
	}

	link() {
		return `${process.env.BASE_URI}/competitions/${this.meta.competitionId}/wca-live/${this.meta.eventId}/${this.meta.roundNumber}`;
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
			recordTag: this.meta.recordTag,
			resultText: this.meta.resultText,
		};
	}
}
