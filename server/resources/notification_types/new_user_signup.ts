import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

export default class NewUserSignupNotification extends Notification {
	private registrationMethod: 'local' | 'wca';
	private pending: boolean;

	constructor(input: NotificationInput, registrationMethod: 'local' | 'wca', pending: boolean = false) {
		super(input);
		this.registrationMethod = registrationMethod;
		this.pending = pending;
	}

	notificationType() {
		return NotificationType.NEW_USER_SIGNUP;
	}

	subject() {
		if (this.pending) {
			return `Kayit beklemede: ${this.input.triggeringUser.username}`;
		}
		return `Yeni uye: ${this.input.triggeringUser.username}`;
	}

	inAppMessage() {
		const method = this.registrationMethod === 'wca' ? 'WCA' : 'E-posta';
		if (this.pending) {
			return `${this.input.triggeringUser.username} kayit oldu, dogrulama bekleniyor (${method})`;
		}
		return `${this.input.triggeringUser.username} yeni uye oldu (${method})`;
	}

	message() {
		const method = this.registrationMethod === 'wca' ? 'WCA hesabi' : 'e-posta';
		if (this.pending) {
			return `${this.input.triggeringUser.username} kullanicisi ${method} ile kayit oldu, e-posta dogrulaması bekleniyor.`;
		}
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
