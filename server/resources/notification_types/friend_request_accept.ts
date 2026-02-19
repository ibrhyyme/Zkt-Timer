import Notification from './notification';
import { NotificationInput } from '../../@types/interfaces/server.interface';
import { NotificationType } from '../../@types/enums';

export default class FriendRequestAcceptNotification extends Notification {
	constructor(input: NotificationInput) {
		super(input);
	}

	notificationType() {
		return NotificationType.FRIEND_REQUEST_ACCEPT;
	}

	subject() {
		return `${this.input.triggeringUser.username} Zkt-Timer'da arkadaşlık isteğini kabul etti`;
	}

	inAppMessage() {
		return `${this.input.triggeringUser.username} arkadaşlık isteğini kabul etti`;
	}

	message() {
		return `Güzel haber! ${this.input.triggeringUser.username} arkadaşlık isteğini kabul etti. Profilini görüntülemek için aşağıdaki bağlantıya tıkla.`;
	}

	icon() {
		return 'user';
	}

	link() {
		return `${process.env.BASE_URI}/user/${this.input.triggeringUser.username}`;
	}

	linkText() {
		return `Profili görüntüle →`;
	}

	categoryName() {
		return 'Friends';
	}

	customData(): object {
		return {};
	}
}
