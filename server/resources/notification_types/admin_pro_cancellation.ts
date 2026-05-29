import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

type Plan = 'monthly' | 'yearly' | 'lifetime' | 'unknown';
type Platform = 'ios' | 'android';

function planLabel(plan: Plan): string {
	if (plan === 'monthly') return 'aylik';
	if (plan === 'yearly') return 'yillik';
	if (plan === 'lifetime') return 'omur boyu';
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
		return `${this.input.triggeringUser.username} Pro aboneligini iptal etti`;
	}

	message() {
		const planPart = this.plan ? ` (${planLabel(this.plan)})` : '';
		return `${this.input.triggeringUser.username} kullanicisi Pro aboneligini${planPart} iptal etti. Donem sonuna kadar erisimi devam ediyor.`;
	}

	icon() {
		return 'crown';
	}

	link() {
		return `${process.env.BASE_URI}/admin/pro-users`;
	}

	linkText() {
		return 'Pro kullanicilari goruntule';
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
