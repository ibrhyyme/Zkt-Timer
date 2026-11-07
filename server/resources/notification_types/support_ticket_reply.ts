import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';
import {matchSupportedLanguage} from '../../../shared/i18n_language';

export default class SupportTicketReplyNotification extends Notification {
	private ticketSubject: string;
	private ticketId: string;
	private i18n: ReturnType<typeof createI18nInstance>;

	// `locale` is the recipient's settings.locale. The reply goes to whoever opened the
	// ticket, often a user abroad, so it is never written in a fixed language.
	constructor(input: NotificationInput, ticketSubject: string, ticketId: string, locale?: string | null) {
		super(input);
		this.ticketSubject = ticketSubject;
		this.ticketId = ticketId;
		this.i18n = createI18nInstance(matchSupportedLanguage(locale) || 'en');
	}

	private t(key: string): string {
		return this.i18n.t(`notifications.support_ticket_reply.${key}`, {subject: this.ticketSubject}) as string;
	}

	notificationType() {
		return NotificationType.SUPPORT_TICKET_REPLY;
	}

	subject() {
		return this.t('subject');
	}

	inAppMessage() {
		return this.t('in_app');
	}

	message() {
		return this.t('message');
	}

	icon() {
		return 'lifebuoy';
	}

	link() {
		// Deep link straight into the conversation — landing on the list and hunting for
		// the right ticket is the same as not linking at all.
		return `${process.env.BASE_URI}/account/support?ticket=${this.ticketId}`;
	}

	linkText() {
		return this.t('link_text');
	}

	categoryName() {
		return this.t('category');
	}

	customData(): object {
		return {
			ticketId: this.ticketId,
		};
	}
}
