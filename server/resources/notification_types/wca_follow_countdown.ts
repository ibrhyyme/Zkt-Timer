import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

interface WcaFollowCountdownMeta {
	competitionId: string;
	competitionName: string;
	daysBefore: number;
	followedCount: number;
	locale?: string;
}

export default class WcaFollowCountdownNotification extends Notification {
	private meta: WcaFollowCountdownMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: WcaFollowCountdownMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(meta.locale) ? meta.locale : 'en';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.WCA_FOLLOW_COUNTDOWN;
	}

	subject() {
		if (this.meta.daysBefore === 1) {
			return this.t('notif_follow_countdown_title_tomorrow', {
				competitionName: this.meta.competitionName,
			});
		}
		return this.t('notif_follow_countdown_title_days', {
			days: this.meta.daysBefore,
			competitionName: this.meta.competitionName,
		});
	}

	inAppMessage() {
		return this.t('notif_follow_countdown_body', {
			count: this.meta.followedCount,
		});
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
			followedCount: this.meta.followedCount,
			follow: true,
		};
	}
}
