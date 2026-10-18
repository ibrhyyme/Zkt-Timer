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

function platformLabel(platform: Platform): string {
	return platform === 'ios' ? 'iOS' : 'Android';
}

export default class AdminProPurchaseNotification extends Notification {
	private plan: Plan;
	private platform: Platform;

	constructor(input: NotificationInput, plan: Plan, platform: Platform) {
		super(input);
		this.plan = plan;
		this.platform = platform;
	}

	notificationType() {
		return NotificationType.ADMIN_PRO_PURCHASE;
	}

	subject() {
		return `Yeni Pro abone: ${this.input.triggeringUser.username}`;
	}

	inAppMessage() {
		return `${this.input.triggeringUser.username} Pro abone oldu (${planLabel(this.plan)}, ${platformLabel(this.platform)})`;
	}

	message() {
		return `${this.input.triggeringUser.username} kullanıcısı ${planLabel(this.plan)} Pro abonelik satın aldı (${platformLabel(this.platform)}).`;
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
			plan: this.plan,
			platform: this.platform,
		};
	}
}
