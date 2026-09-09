import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';
import {zktSlugOf} from '../../services/ZktWcaAdapter';

/**
 * A record was broken at a live competition, for either authority.
 *
 * Both sources share this class rather than getting one each: the payload, the
 * push shape and the i18n strings are identical, and the only real differences
 * are the label, the notification type and where the link lands. The source is
 * spelled out in the visible text on purpose — a Turkish user can hold a WCA
 * national record and a ZKT national record at the same time, and two
 * notifications reading "National Record" with no attribution would be
 * indistinguishable.
 */
export type RecordSource = 'WCA' | 'ZKT';

interface RecordBrokenMeta {
	source: RecordSource;
	competitionId: string; // ZKT ids arrive prefixed: `zkt-<slug>`
	competitionName: string;
	eventId: string;
	eventName: string;
	recordTag: string; // 'WR' | 'CR' | 'NR' — ZKT only ever produces 'NR'
	resultText: string; // pre-formatted, e.g. "4.12"
	personName: string;
	roundNumber: number;
	locale?: string; // tr/en/es/ru/zh — falls back to en
}

export default class RecordBrokenNotification extends Notification {
	private meta: RecordBrokenMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: RecordBrokenMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(meta.locale) ? meta.locale : 'en';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`my_schedule.${key}`, vars) as string;
	}

	/**
	 * "ZKT Turkish Record" / "National Record (WCA)" rather than a bare "NR".
	 * i18next echoes the key back when a translation is missing, so an unknown
	 * source/tag pair degrades to the raw tag instead of printing a key.
	 */
	private recordLabel(): string {
		const key = `record_label_${this.meta.source.toLowerCase()}_${this.meta.recordTag.toLowerCase()}`;
		const label = this.t(key);
		return label && label !== `my_schedule.${key}` ? label : this.meta.recordTag;
	}

	private isZkt(): boolean {
		return this.meta.source === 'ZKT';
	}

	notificationType() {
		return this.isZkt() ? NotificationType.ZKT_RECORD_BROKEN : NotificationType.WCA_RECORD_BROKEN;
	}

	subject() {
		return this.t('notif_record_title', {
			label: this.recordLabel(),
			eventName: this.meta.eventName,
		});
	}

	inAppMessage() {
		return this.t('notif_record_body', {
			personName: this.meta.personName,
			eventName: this.meta.eventName,
			label: this.recordLabel(),
			resultText: this.meta.resultText,
		});
	}

	message() {
		return `${this.meta.competitionName} — ${this.inAppMessage()}`;
	}

	icon() {
		return 'trophy';
	}

	/**
	 * In-app path, no origin.
	 *
	 * Push payloads must carry this rather than `link()`: the client hands an
	 * absolute http link to the in-app browser and only navigates in-app for a
	 * relative one.
	 *
	 * ZKT records land in the native ZKT view, not the WCA-adapted one. That route
	 * passes its `:competitionId` straight through to the federation, which keys on
	 * the bare slug — so the `zkt-` prefix has to come off here.
	 */
	relativeLink() {
		const {competitionId, eventId, roundNumber} = this.meta;
		if (this.isZkt()) {
			return `/zkt-competitions/${zktSlugOf(competitionId)}/live/${eventId}/${roundNumber}`;
		}
		return `/competitions/${competitionId}/wca-live/${eventId}/${roundNumber}`;
	}

	link() {
		return `${process.env.BASE_URI}${this.relativeLink()}`;
	}

	linkText() {
		return this.t('notif_link_text');
	}

	categoryName() {
		return this.isZkt() ? 'ZKT' : 'WCA';
	}

	customData(): object {
		return {
			source: this.meta.source,
			competitionId: this.meta.competitionId,
			eventId: this.meta.eventId,
			roundNumber: this.meta.roundNumber,
			recordTag: this.meta.recordTag,
			resultText: this.meta.resultText,
		};
	}
}
