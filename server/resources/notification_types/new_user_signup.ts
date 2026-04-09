import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

export default class NewUserSignupNotification extends Notification {
	private registrationMethod: 'local' | 'wca';

	constructor(input: NotificationInput, registrationMethod: 'local' | 'wca') {
		super(input);
		this.registrationMethod = registrationMethod;
	}

	notificationType() {
		return NotificationType.NEW_USER_SIGNUP;
	}

	subject() {
		return `Yeni uye: ${this.input.triggeringUser.username}`;
	}

	inAppMessage() {
		const method = this.registrationMethod === 'wca' ? 'WCA' : 'E-posta';
		return `${this.input.triggeringUser.username} yeni uye oldu (${method})`;
	}

	message() {
		const method = this.registrationMethod === 'wca' ? 'WCA hesabi' : 'e-posta';
		return `${this.input.triggeringUser.username} kullanicisi ${method} ile Zkt Timer'a kayit oldu.`;
	}

	icon() {
		return 'user';
	}

	link() {
		return `${process.env.BASE_URI}/admin/users`;
	}

	linkText() {
		return 'Kullanicilari goruntule';
	}

	categoryName() {
		return 'Admin';
	}

	customData(): object {
		return {
			registrationMethod: this.registrationMethod,
		};
	}
}
