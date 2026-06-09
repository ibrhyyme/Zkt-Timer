import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

export type ZktRegistrationNotifyKind =
	| 'PENDING'
	| 'APPROVED'
	| 'WAITLISTED'
	| 'PROMOTED'
	| 'REJECTED';

interface ZktRegistrationStatusMeta {
	competitionId: string;
	competitionName: string;
	kind: ZktRegistrationNotifyKind;
	locale?: string;
}

/**
 * Competitor-facing registration status updates (WCA RegistrationsMailer
 * parity): received, approved, waitlisted, promoted from the waitlist,
 * rejected. Rendered in the competitor's own locale.
 */
export default class ZktRegistrationStatusNotification extends Notification {
	private meta: ZktRegistrationStatusMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: ZktRegistrationStatusMeta) {
		super(input);
		this.meta = meta;
		const locale =
			meta.locale && ['tr', 'en', 'es', 'ru', 'zh'].includes(meta.locale) ? meta.locale : 'tr';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any) {
		return this.i18n.t(`zkt_comp.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.ZKT_REGISTRATION_STATUS;
	}

	subject() {
		return this.t(`notif_reg_${this.meta.kind.toLowerCase()}_title`, {
			competitionName: this.meta.competitionName,
		});
	}

	inAppMessage() {
		return this.t(`notif_reg_${this.meta.kind.toLowerCase()}_body`, {
			competitionName: this.meta.competitionName,
		});
	}

	message() {
		return `${this.meta.competitionName}: ${this.inAppMessage()}`;
	}

	icon() {
		return 'trophy';
	}

	link() {
		return `${process.env.BASE_URI}/community/zkt-competitions/${this.meta.competitionId}`;
	}

	linkText() {
		return this.t('notif_reg_link_text');
	}

	categoryName() {
		return 'ZKT';
	}

	customData(): object {
		return {
			competitionId: this.meta.competitionId,
			kind: this.meta.kind,
		};
	}
}
