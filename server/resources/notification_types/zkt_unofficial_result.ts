import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';
import {formatWcaResult} from '../../services/CompetitionLifecycle';
import type {JudgeEndResult} from '../../services/zkt_judge_end';

const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

export interface ZktUnofficialResultMeta {
	competition: {id: string; slug: string; name: string};
	result: JudgeEndResult;
	locale?: string | null;
}

/**
 * Online score entry (ZKT): the competitor's unofficial result, sent the moment
 * the judge ends a finished card (services/zkt_judge_end.ts). Push title
 * "RESMİ OLMAYAN SONUÇLARA GÖRE", body "Ortalama: 12.34 · Single: 10.21" (owner,
 * 2026-11-15: in capitals, no round or event). The inbox row carries the
 * competition as its heading.
 *
 * Falls back to Turkish like the other judge notices: only ZKT competitors receive it.
 */
export default class ZktUnofficialResultNotification extends Notification {
	private meta: ZktUnofficialResultMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: ZktUnofficialResultMeta) {
		super(input);
		this.meta = meta;
		this.i18n = createI18nInstance(meta.locale && LOCALES.includes(meta.locale) ? meta.locale : 'tr');
	}

	private t(key: string, vars?: any): string {
		return this.i18n.t(`zkt_comp.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.ZKT_UNOFFICIAL_RESULT;
	}

	subject() {
		return this.t('unofficial_result_title');
	}

	/** The push body: "Ortalama: 12.34 · Single: 10.21", or the single alone without an average. */
	detail() {
		const {eventId, best, average} = this.meta.result;
		const single = formatWcaResult(best, eventId, 'single');
		if (average === null) return this.t('unofficial_result_body_single', {single});
		return this.t('unofficial_result_body', {average: formatWcaResult(average, eventId, 'average'), single});
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

	/** The competition's live results, where the times are. */
	relativeLink() {
		return `/competitions/zkt-${this.meta.competition.slug}/wca-live`;
	}

	link() {
		return `${process.env.BASE_URI}${this.relativeLink()}`;
	}

	linkText() {
		return this.t('unofficial_result_link_text');
	}

	categoryName() {
		return this.meta.competition.name;
	}

	pushData(): Record<string, string> {
		return {type: this.notificationType(), link: this.relativeLink(), competitionId: `zkt-${this.meta.competition.slug}`};
	}

	customData(): object {
		return {competitionId: `zkt-${this.meta.competition.slug}`, eventId: this.meta.result.eventId};
	}
}
