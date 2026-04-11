import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

export default class MembershipGrantedNotification extends Notification {
	private membershipType: 'pro' | 'premium';
	private expiresAt: Date | null;

	constructor(input: NotificationInput, membershipType: 'pro' | 'premium', expiresAt: Date | null) {
		super(input);
		this.membershipType = membershipType;
		this.expiresAt = expiresAt;
	}

	notificationType() {
		return NotificationType.MEMBERSHIP_GRANTED;
	}

	subject() {
		const label = this.membershipType === 'premium' ? 'Premium' : 'Pro';
		if (this.expiresAt) {
			return `Tebrikler! ${label} uyeliginiz ${this.formatDateTime(this.expiresAt)} tarihine kadar aktif`;
		}
		return `Tebrikler! Zkt Timer ${label} uyeliginiz aktif`;
	}

	inAppMessage() {
		const label = this.membershipType === 'premium' ? 'Premium' : 'Pro';
		if (this.expiresAt) {
			return `Tebrikler! ${label} uyeliginiz ${this.formatDateTime(this.expiresAt)} tarihine kadar aktif`;
		}
		return `Tebrikler! ${label} uyeliginiz aktif`;
	}

	message() {
		const label = this.membershipType === 'premium' ? 'Premium' : 'Pro';
		if (this.expiresAt) {
			return `Tebrikler! Zkt Timer ${label} uyeliginiz basariyla aktif edildi. Uyeliginiz ${this.formatDateTime(this.expiresAt)} tarihine kadar gecerlidir.`;
		}
		return `Tebrikler! Zkt Timer ${label} uyeliginiz basariyla aktif edildi. Uyeliginiz suresizdir.`;
	}

	icon() {
		return 'star';
	}

	link() {
		return `${process.env.BASE_URI}/settings`;
	}

	linkText() {
		return 'Ayarlarini goruntule';
	}

	categoryName() {
		return 'Membership';
	}

	customData(): object {
		return {
			membershipType: this.membershipType,
			expiresAt: this.expiresAt,
		};
	}

	private formatDateTime(date: Date): string {
		return date.toLocaleString('tr-TR', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}
}
