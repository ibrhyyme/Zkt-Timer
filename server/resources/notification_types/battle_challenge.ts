import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {createI18nInstance} from '../../i18n_server';
import {challengePath} from '../../../shared/battle/challenge';
import {CHALLENGE_TTL_SEC} from '../../../shared/battle/config';

const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

interface BattleChallengeMeta {
	code: string;
	fromUsername: string;
	locale?: string | null;
}

/**
 * "<name> challenged you to a duel": a profile challenge in Online Battle. The link is the
 * invite page, which says by itself when the invite has expired or been used, so a stale row
 * in the inbox does no harm.
 *
 * The inbox row shows only the category and in_app_message, so that text names the
 * challenger on its own; the push carries the same line under the subject.
 */
export default class BattleChallengeNotification extends Notification {
	private meta: BattleChallengeMeta;
	private i18n: ReturnType<typeof createI18nInstance>;

	constructor(input: NotificationInput, meta: BattleChallengeMeta) {
		super(input);
		this.meta = meta;
		const locale = meta.locale && LOCALES.includes(meta.locale) ? meta.locale : 'en';
		this.i18n = createI18nInstance(locale);
	}

	private t(key: string, vars?: any): string {
		return this.i18n.t(`online_battle.duel.${key}`, vars) as string;
	}

	notificationType() {
		return NotificationType.BATTLE_CHALLENGE;
	}

	subject() {
		return this.t('notif_title', {name: this.meta.fromUsername});
	}

	inAppMessage() {
		return this.t('notif_body', {name: this.meta.fromUsername, minutes: CHALLENGE_TTL_SEC / 60});
	}

	message() {
		return this.inAppMessage();
	}

	icon() {
		return 'sword';
	}

	/** In-app path; push payloads carry this so the client navigates inside the app. */
	relativeLink() {
		return challengePath(this.meta.code);
	}

	link() {
		return `${process.env.BASE_URI}${this.relativeLink()}`;
	}

	linkText() {
		return this.t('notif_link_text');
	}

	categoryName() {
		return this.t('notif_category');
	}

	pushData(): Record<string, string> {
		return {type: this.notificationType(), link: this.relativeLink()};
	}

	customData(): object {
		return {code: this.meta.code};
	}
}
