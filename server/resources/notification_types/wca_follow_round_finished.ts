import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

interface WcaFollowRoundFinishedMeta {
	competitionId: string;
	competitionName: string;
	eventId: string;
	eventName: string;
	roundNumber: number;
	ranking: number;
	advancing: boolean;
	advancingQuestionable: boolean;
	isFinal: boolean;
	followedName: string;
	locale?: string;
}

export default class WcaFollowRoundFinishedNotification extends Notification {
	private meta: WcaFollowRoundFinishedMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: WcaFollowRoundFinishedMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(meta.locale) ? meta.locale : 'en';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.WCA_FOLLOW_ROUND_FINISHED;
	}

	subject() {
		const {isFinal, ranking, eventName, roundNumber, followedName} = this.meta;
		if (isFinal && ranking >= 1 && ranking <= 3) {
			return this.t(`notif_follow_podium_${['1st', '2nd', '3rd'][ranking - 1]}_title`, {
				name: followedName,
				eventName,
			});
		}
		if (isFinal) {
			return this.t('notif_follow_final_finished_title', {
				name: followedName,
				eventName,
			});
		}
		return this.t('notif_follow_round_finished_title', {
			eventName,
			roundNumber,
		});
	}

	inAppMessage() {
		const {isFinal, ranking, advancing, advancingQuestionable, eventName, followedName} = this.meta;
		const vars = {name: followedName, ranking, eventName};
		if (isFinal && ranking >= 1 && ranking <= 3) {
			return this.t(`notif_follow_podium_${['1st', '2nd', '3rd'][ranking - 1]}_body`, vars);
		}
		if (isFinal) {
			return this.t('notif_follow_final_result', vars);
		}
		if (advancing && !advancingQuestionable) {
			return this.t('notif_follow_advancing', vars);
		}
		if (advancing && advancingQuestionable) {
			return this.t('notif_follow_advancing_questionable', vars);
		}
		return this.t('notif_follow_not_advancing', vars);
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
			ranking: this.meta.ranking,
			advancing: this.meta.advancing,
			isFinal: this.meta.isFinal,
			followedName: this.meta.followedName,
			follow: true,
		};
	}
}
