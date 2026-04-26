import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

interface WcaRoundFinishedMeta {
	competitionId: string;
	competitionName: string;
	eventId: string;
	eventName: string;
	roundNumber: number;
	ranking: number;
	advancing: boolean;
	advancingQuestionable: boolean;
	isFinal: boolean; // Event'in son round'u mu?
	locale?: string;
}

function ordinalSuffix(n: number, locale: string): string {
	if (locale !== 'en') return '';
	const s = ['th', 'st', 'nd', 'rd'];
	const v = n % 100;
	return s[(v - 20) % 10] || s[v] || s[0];
}

export default class WcaRoundFinishedNotification extends Notification {
	private meta: WcaRoundFinishedMeta;
	private i18n: ReturnType<typeof createI18nInstance>;
	private locale: string;

	constructor(input: NotificationInput, meta: WcaRoundFinishedMeta) {
		super(input);
		this.meta = meta;
		this.locale = meta.locale && ['tr', 'en', 'es', 'ru'].includes(meta.locale) ? meta.locale : 'tr';
		this.i18n = createI18nInstance(this.locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.WCA_ROUND_FINISHED;
	}

	subject() {
		if (this.meta.isFinal && this.meta.ranking >= 1 && this.meta.ranking <= 3) {
			return this.t(`notif_podium_${['1st', '2nd', '3rd'][this.meta.ranking - 1]}_title`);
		}
		if (this.meta.isFinal) {
			return this.t('notif_final_finished_title', {eventName: this.meta.eventName});
		}
		return this.t('notif_round_finished_title', {
			eventName: this.meta.eventName,
			roundNumber: this.meta.roundNumber,
		});
	}

	inAppMessage() {
		const suffix = ordinalSuffix(this.meta.ranking, this.locale);
		const vars = {ranking: this.meta.ranking, suffix};
		if (this.meta.isFinal && this.meta.ranking >= 1 && this.meta.ranking <= 3) {
			return this.t(`notif_podium_${['1st', '2nd', '3rd'][this.meta.ranking - 1]}_body`, {eventName: this.meta.eventName});
		}
		if (this.meta.isFinal) {
			return this.t('notif_final_result', vars);
		}
		if (this.meta.advancing && !this.meta.advancingQuestionable) {
			return this.t('notif_advancing', vars);
		}
		if (this.meta.advancing && this.meta.advancingQuestionable) {
			return this.t('notif_advancing_questionable', vars);
		}
		return this.t('notif_not_advancing', vars);
	}

	message() {
		return `${this.meta.competitionName} — ${this.meta.eventName} R${this.meta.roundNumber}: ${this.inAppMessage()}`;
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
		};
	}
}
