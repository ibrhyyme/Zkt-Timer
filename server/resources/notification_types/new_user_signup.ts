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
	wca: 'WCA hesabi',
	zkt: 'ZKT hesabi',
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
			return `Kayit beklemede: ${this.input.triggeringUser.username}`;
		}
		return `Yeni uye: ${this.input.triggeringUser.username}`;
	}

	inAppMessage() {
		const method = METHOD_LABEL[this.registrationMethod] ?? METHOD_LABEL.local;
		if (this.pending) {
			return `${this.input.triggeringUser.username} kayit oldu, dogrulama bekleniyor (${method})`;
		}
		return `${this.input.triggeringUser.username} yeni uye oldu (${method})`;
	}

	message() {
		const method = METHOD_ACCOUNT_LABEL[this.registrationMethod] ?? METHOD_ACCOUNT_LABEL.local;
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
