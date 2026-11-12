import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';
import {WcaApiService} from '../../services/WcaApiService';
import {judgeStaffPath, type JudgeProgressGroup} from '../../services/zkt_judge_progress';

const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

export interface ZktJudgeGroupProgressMeta {
	competition: {id: string; slug: string; name: string};
	group: Pick<JudgeProgressGroup, 'eventId' | 'roundNumber' | 'groupNumber' | 'dualChance' | 'chance'>;
	/** The attempt everyone in the group has finished (3 or 4 on an Ao5). */
	attempt: number;
	locale?: string | null;
}

/**
 * Online score entry (ZKT), plan K10: "3x3 Round 1, Group 2: 3rd attempts are
 * done", for the competition's delegates and organisers
 * (cron_zkt_judge_progress.ts). Push title is the competition; the inbox row
 * shows only the category and in_app_message, so that one names it too.
 *
 * Falls back to Turkish, not English like the other competition types: only
 * the staff of a ZKT (Turkish federation) competition receive it.
 */
export default class ZktJudgeGroupProgressNotification extends Notification {
	private meta: ZktJudgeGroupProgressMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: ZktJudgeGroupProgressMeta) {
		super(input);
		this.meta = meta;
		this.i18n = createI18nInstance(meta.locale && LOCALES.includes(meta.locale) ? meta.locale : 'tr');
	}

	private t(key: string, vars?: any): string {
		return this.i18n.t(`zkt_comp.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.ZKT_JUDGE_GROUP_PROGRESS;
	}

	subject() {
		return this.meta.competition.name;
	}

	/** The push body: "3x3 1. Tur, Grup 2: 3. çözümler bitti." */
	detail() {
		const {group} = this.meta;
		const vars = {eventName: WcaApiService.getShortEventName(group.eventId), roundNumber: group.roundNumber, groupNumber: group.groupNumber};
		let where = group.groupNumber != null ? this.t('judge_progress_where', vars) : this.t('judge_progress_where_no_group', vars);
		if (group.dualChance) where = `${where} · ${this.t('chance_n', {n: group.chance})}`;
		return this.t('judge_progress_body', {where, n: this.meta.attempt});
	}

	inAppMessage() {
		return `${this.subject()} · ${this.detail()}`;
	}

	message() {
		return this.inAppMessage();
	}

	icon() {
		return 'trophy';
	}

	/** In-app path; the push carries it so a tap opens the panel inside the app. */
	relativeLink() {
		return judgeStaffPath(this.meta.competition.slug);
	}

	link() {
		return `${process.env.BASE_URI}${this.relativeLink()}`;
	}

	linkText() {
		return this.t('judge_progress_link_text');
	}

	categoryName() {
		return this.t('judge_progress_category');
	}

	pushData(): Record<string, string> {
		return {type: this.notificationType(), link: this.relativeLink(), competitionId: `zkt-${this.meta.competition.slug}`};
	}

	customData(): object {
		return {competitionId: `zkt-${this.meta.competition.slug}`, attempt: this.meta.attempt};
	}
}
