import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

export default class AdminSupportTicketNotification extends Notification {
	private ticketSubject: string;
	private ticketId: string;

	constructor(input: NotificationInput, ticketSubject: string, ticketId: string) {
		super(input);
		this.ticketSubject = ticketSubject;
		this.ticketId = ticketId;
	}

	notificationType() {
		return NotificationType.ADMIN_SUPPORT_TICKET;
	}

	subject() {
		return `Yeni destek talebi: ${this.input.triggeringUser.username}`;
	}

	inAppMessage() {
		return `${this.input.triggeringUser.username}: ${this.ticketSubject}`;
	}

	message() {
		return `${this.input.triggeringUser.username} kullanicisi yeni bir destek talebi gonderdi: "${this.ticketSubject}"`;
	}

	icon() {
		return 'lifebuoy';
	}

	link() {
		// Deep link opens the conversation directly instead of the queue.
		return `${process.env.BASE_URI}/admin/reports?tab=support&ticket=${this.ticketId}`;
	}

	linkText() {
		return 'Destek taleplerini goruntule';
	}

	categoryName() {
		return 'Admin';
	}

	customData(): object {
		return {
			ticketSubject: this.ticketSubject,
			ticketId: this.ticketId,
		};
	}
}
