import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

interface WcaFollowResultEnteredMeta {
	competitionId: string;
	competitionName: string;
	eventId: string;
	eventName: string;
	roundNumber: number;
	resultText: string;
	followedName: string;
	locale?: string;
}

export default class WcaFollowResultEnteredNotification extends Notification {
	private meta: WcaFollowResultEnteredMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: WcaFollowResultEnteredMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(meta.locale) ? meta.locale : 'en';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.WCA_FOLLOW_RESULT_ENTERED;
	}

	subject() {
		return this.t('notif_follow_result_title', {
			eventName: this.meta.eventName,
			roundNumber: this.meta.roundNumber,
		});
	}

	inAppMessage() {
		return this.t('notif_follow_result_body', {
			name: this.meta.followedName,
			result: this.meta.resultText,
		});
	}

	message() {
		return `${this.meta.competitionName} — ${this.inAppMessage()}`;
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
			followedName: this.meta.followedName,
			resultText: this.meta.resultText,
			follow: true,
		};
	}
}
