import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

// How the account was created. Kept next to its labels so adding a provider is
// one edit: the union, and the two strings an admin reads in the notification.
export type RegistrationMethod = 'local' | 'wca' | 'zkt';

const METHOD_LABEL: Record<RegistrationMethod, string> = {
	local: 'E-posta',
	wca: 'WCA',
	zkt: 'ZKT',
};

const METHOD_ACCOUNT_LABEL: Record<RegistrationMethod, string> = {
	local: 'e-posta',
	wca: 'WCA hesabı',
	zkt: 'ZKT hesabı',
};

export default class NewUserSignupNotification extends Notification {
	private registrationMethod: RegistrationMethod;
	private pending: boolean;

	constructor(input: NotificationInput, registrationMethod: RegistrationMethod, pending: boolean = false) {
		super(input);
		this.registrationMethod = registrationMethod;
		this.pending = pending;
	}

	notificationType() {
		return NotificationType.NEW_USER_SIGNUP;
	}

	subject() {
		if (this.pending) {
			return `Kayıt beklemede: ${this.input.triggeringUser.username}`;
		}
		return `Yeni üye: ${this.input.triggeringUser.username}`;
	}

	inAppMessage() {
		const method = METHOD_LABEL[this.registrationMethod] ?? METHOD_LABEL.local;
		if (this.pending) {
			return `${this.input.triggeringUser.username} kayıt oldu, doğrulama bekleniyor (${method})`;
		}
		return `${this.input.triggeringUser.username} yeni üye oldu (${method})`;
	}

	message() {
		const method = METHOD_ACCOUNT_LABEL[this.registrationMethod] ?? METHOD_ACCOUNT_LABEL.local;
		if (this.pending) {
			return `${this.input.triggeringUser.username} kullanıcısı ${method} ile kayıt oldu, e-posta doğrulaması bekleniyor.`;
		}
		return `${this.input.triggeringUser.username} kullanıcısı ${method} ile Zkt Timer'a kayıt oldu.`;
	}

	icon() {
		return 'user';
	}

	link() {
		return `${process.env.BASE_URI}/admin/users`;
	}

	linkText() {
		return 'Kullanıcıları görüntüle';
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
