import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

type Plan = 'monthly' | 'yearly' | 'lifetime' | 'unknown';
type Platform = 'ios' | 'android';

function planLabel(plan: Plan): string {
	if (plan === 'monthly') return 'aylık';
	if (plan === 'yearly') return 'yıllık';
	if (plan === 'lifetime') return 'ömür boyu';
	return 'plan bilinmiyor';
}

export default class AdminProCancellationNotification extends Notification {
	private plan?: Plan;
	private platform?: Platform;

	constructor(input: NotificationInput, plan?: Plan, platform?: Platform) {
		super(input);
		this.plan = plan;
		this.platform = platform;
	}

	notificationType() {
		return NotificationType.ADMIN_PRO_CANCELLATION;
	}

	subject() {
		return `Pro iptal: ${this.input.triggeringUser.username}`;
	}

	inAppMessage() {
		return `${this.input.triggeringUser.username} Pro aboneliğini iptal etti`;
	}

	message() {
		const planPart = this.plan ? ` (${planLabel(this.plan)})` : '';
		return `${this.input.triggeringUser.username} kullanıcısı Pro aboneliğini${planPart} iptal etti. Dönem sonuna kadar erişimi devam ediyor.`;
	}

	icon() {
		return 'crown';
	}

	link() {
		return `${process.env.BASE_URI}/admin/pro-users`;
	}

	linkText() {
		return 'Pro kullanıcıları görüntüle';
	}

	categoryName() {
		return 'Admin';
	}

	customData(): object {
		return {
			plan: this.plan ?? null,
			platform: this.platform ?? null,
		};
	}
}
