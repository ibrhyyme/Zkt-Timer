import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';

const SUPPORTED_LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

export default class MembershipGrantedNotification extends Notification {
	private membershipType: 'pro' | 'premium';
	private expiresAt: Date | null;
	private i18n: ReturnType<typeof createI18nInstance>;
	private locale: string;

	constructor(input: NotificationInput, membershipType: 'pro' | 'premium', expiresAt: Date | null) {
		super(input);
		this.membershipType = membershipType;
		this.expiresAt = expiresAt;
		const userLocale = (input.user as any)?.settings?.locale;
		this.locale = userLocale && SUPPORTED_LOCALES.includes(userLocale) ? userLocale : 'en';
		this.i18n = createI18nInstance(this.locale);
	}

	private t(key: string, vars?: Record<string, string>): string {
		return this.i18n.t(`notifications.membership_granted.${key}`, vars as any) as string;
	}

	private get label(): string {
		return this.membershipType === 'premium' ? 'Premium' : 'Pro';
	}

	private formatDateTime(date: Date): string {
		const localeMap: Record<string, string> = {
			tr: 'tr-TR', en: 'en-US', es: 'es-ES', ru: 'ru-RU', zh: 'zh-CN',
		};
		return date.toLocaleString(localeMap[this.locale] || 'en-US', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	notificationType() {
		return NotificationType.MEMBERSHIP_GRANTED;
	}

	subject() {
		if (this.expiresAt) {
			return this.t('subject_expiry', {label: this.label, date: this.formatDateTime(this.expiresAt)});
		}
		return this.t('subject', {label: this.label});
	}

	inAppMessage() {
		if (this.expiresAt) {
			return this.t('subject_expiry', {label: this.label, date: this.formatDateTime(this.expiresAt)});
		}
		return this.t('subject', {label: this.label});
	}

	message() {
		if (this.expiresAt) {
			return this.t('message_expiry', {label: this.label, date: this.formatDateTime(this.expiresAt)});
		}
		return this.t('message', {label: this.label});
	}

	icon() {
		return 'star';
	}

	link() {
		return `${process.env.BASE_URI}/settings`;
	}

	linkText() {
		return this.t('link_text');
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
}
