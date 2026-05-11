import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

export default class AdminSupportTicketReplyNotification extends Notification {
	private ticketSubject: string;
	private ticketId: string;

	constructor(input: NotificationInput, ticketSubject: string, ticketId: string) {
		super(input);
		this.ticketSubject = ticketSubject;
		this.ticketId = ticketId;
	}

	notificationType() {
		return NotificationType.ADMIN_SUPPORT_TICKET_REPLY;
	}

	subject() {
		return `${this.input.triggeringUser.username} destek talebine yanit yazdi`;
	}

	inAppMessage() {
		return `${this.input.triggeringUser.username}: "${this.ticketSubject}" — yeni mesaj`;
	}

	message() {
		return `${this.input.triggeringUser.username} kullanicisi "${this.ticketSubject}" konulu destek talebine yanit yazdi.`;
	}

	icon() {
		return 'lifebuoy';
	}

	link() {
		return `${process.env.BASE_URI}/admin/reports?tab=support`;
	}

	linkText() {
		return 'Destek taleplerini goruntule';
	}

	categoryName() {
		return 'Admin';
	}

	customData(): object {
		return {
			ticketId: this.ticketId,
		};
	}
}
