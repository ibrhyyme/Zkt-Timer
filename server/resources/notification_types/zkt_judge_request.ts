import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';
import {WcaApiService} from '../../services/WcaApiService';
import {judgeStaffPath} from '../../services/zkt_judge_progress';
import type {JudgeRequestNotify, JudgeRequestPurpose} from '../../services/zkt_judge_request';

const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

export interface ZktJudgeRequestMeta {
	purpose: JudgeRequestPurpose;
	notify: JudgeRequestNotify;
	locale?: string | null;
}

/**
 * Online score entry (ZKT): "4x4 Round 1, Group 2, Station 5: an extra is
 * requested for attempt 2", for the staff who can approve it
 * (services/zkt_judge_request.ts). The approval itself still happens at the
 * station by scanning the judge's QR; this only says where to go.
 *
 * Falls back to Turkish like the group progress notice: only the staff of a ZKT
 * competition receive it.
 */
export default class ZktJudgeRequestNotification extends Notification {
	private meta: ZktJudgeRequestMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: ZktJudgeRequestMeta) {
		super(input);
		this.meta = meta;
		this.i18n = createI18nInstance(meta.locale && LOCALES.includes(meta.locale) ? meta.locale : 'tr');
	}

	private t(key: string, vars?: any): string {
		return this.i18n.t(`zkt_comp.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.ZKT_JUDGE_REQUEST;
	}

	subject() {
		return this.meta.notify.competition.name;
	}

	/** The push body: "4x4 1. Tur, Grup 2, İstasyon 5: 2. çözüm için ekstra isteniyor." */
	detail() {
		const n = this.meta.notify;
		const vars = {eventName: WcaApiService.getShortEventName(n.eventId), roundNumber: n.roundNumber, groupNumber: n.groupNumber};
		let where = n.groupNumber != null ? this.t('judge_progress_where', vars) : this.t('judge_progress_where_no_group', vars);
		if (n.dualChance) where = `${where} · ${this.t('chance_n', {n: n.chance})}`;
		if (n.stationNumber != null) where = this.t('judge_request_where_station', {where, station: n.stationNumber});
		const key = this.meta.purpose === 'EXTRA' ? 'judge_request_body_extra' : 'judge_request_body_correct';
		return this.t(key, {where, n: n.attemptNo});
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

	/** The organisers' panel: the round and its cards, the way to the station. */
	relativeLink() {
		return judgeStaffPath(this.meta.notify.competition.slug);
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
		return {type: this.notificationType(), link: this.relativeLink(), competitionId: `zkt-${this.meta.notify.competition.slug}`};
	}

	customData(): object {
		return {competitionId: `zkt-${this.meta.notify.competition.slug}`, purpose: this.meta.purpose, attempt: this.meta.notify.attemptNo};
	}
}
