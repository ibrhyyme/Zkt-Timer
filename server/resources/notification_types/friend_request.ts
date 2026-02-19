import Notification from './notification';
import { NotificationInput } from '../../@types/interfaces/server.interface';
import { NotificationType } from '../../@types/enums';

export default class FriendRequestNotification extends Notification {
	constructor(input: NotificationInput) {
		super(input);
	}

	notificationType() {
		return NotificationType.FRIEND_REQUEST;
	}

	subject() {
		return `${this.input.triggeringUser.username} sana Zkt-Timer'da arkadaşlık isteği gönderdi`;
	}

	inAppMessage() {
		return `${this.input.triggeringUser.username} sana arkadaşlık isteği gönderdi`;
	}

	message() {
		return `${this.input.triggeringUser.username} kullanıcısından yeni bir arkadaşlık isteğin var. Profilini görüntülemek ve isteği kabul etmek için aşağıdaki bağlantıya tıkla.`;
	}

	icon() {
		return 'user';
	}

	link() {
		return `${process.env.BASE_URI}/user/${this.input.triggeringUser.username}`;
	}

	linkText() {
		return `Arkadaşlık isteğini görüntüle →`;
	}

	categoryName() {
		return 'Friends';
	}

	customData(): object {
		return {};
	}
}
