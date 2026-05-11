import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

export default class SupportTicketReplyNotification extends Notification {
	private ticketSubject: string;
	private ticketId: string;

	constructor(input: NotificationInput, ticketSubject: string, ticketId: string) {
		super(input);
		this.ticketSubject = ticketSubject;
		this.ticketId = ticketId;
	}

	notificationType() {
		return NotificationType.SUPPORT_TICKET_REPLY;
	}

	subject() {
		return `Destek talebine cevap geldi`;
	}

	inAppMessage() {
		return `"${this.ticketSubject}" konulu talebine yanit yazildi`;
	}

	message() {
		return `Destek talebine bir yanit yazildi: "${this.ticketSubject}"`;
	}

	icon() {
		return 'lifebuoy';
	}

	link() {
		return `${process.env.BASE_URI}/account/support`;
	}

	linkText() {
		return 'Destek taleplerini gor';
	}

	categoryName() {
		return 'Destek';
	}

	customData(): object {
		return {
			ticketId: this.ticketId,
		};
	}
}
