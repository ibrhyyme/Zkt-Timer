import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';

export interface RegistrationWatchDigest {
	competitionId: string;
	competitionName: string;
	body: string;
}

/**
 * The accepted list of a watched WCA competition changed after registration
 * closed (cron_registration_watch.ts). Owner only; links to the watch page.
 */
export default class RegistrationWatchChangeNotification extends Notification {
	private digest: RegistrationWatchDigest;

	constructor(input: NotificationInput, digest: RegistrationWatchDigest) {
		super(input);
		this.digest = digest;
	}

	notificationType() {
		return NotificationType.REGISTRATION_WATCH_CHANGE;
	}

	subject() {
		return `${this.digest.competitionName}: kayıt listesi değişti`;
	}

	inAppMessage() {
		return `${this.digest.competitionName}: ${this.digest.body}`;
	}

	message() {
		return this.inAppMessage();
	}

	icon() {
		return 'user';
	}

	relativeLink() {
		return `/admin/registration-watch?c=${encodeURIComponent(this.digest.competitionId)}`;
	}

	link() {
		return `${process.env.BASE_URI}${this.relativeLink()}`;
	}

	pushData(): Record<string, string> {
		return {
			type: this.notificationType(),
			competitionId: this.digest.competitionId,
			link: this.relativeLink(),
		};
	}

	linkText() {
		return 'Değişiklikleri görüntüle';
	}

	categoryName() {
		return 'Admin';
	}

	customData(): object {
		return {competitionId: this.digest.competitionId};
	}
}
