import Notification from './notification';
import {NotificationInput} from '../../@types/interfaces/server.interface';
import {NotificationType} from '../../@types/enums';
import {getZktOrigin} from '../../../shared/integration';
import {digestBody, type ZktRegistrationDigest} from '../../services/zkt_registration_digest';

/**
 * Members entered or withdrew from a ZKT competition since the last poll, for
 * the federation's admins (cron_zkt_registration_notify.ts). One per
 * competition per poll; links to that competition's registrations on the
 * federation's admin panel.
 */
export default class ZktAdminRegistrationNotification extends Notification {
	private digest: ZktRegistrationDigest;

	constructor(input: NotificationInput, digest: ZktRegistrationDigest) {
		super(input);
		this.digest = digest;
	}

	notificationType() {
		return NotificationType.ZKT_ADMIN_REGISTRATION;
	}

	subject() {
		return `${this.digest.competition.name}: kayıtlarda değişiklik`;
	}

	inAppMessage() {
		return `${this.digest.competition.name}: ${digestBody(this.digest)}`;
	}

	message() {
		return this.inAppMessage();
	}

	icon() {
		return 'user';
	}

	link() {
		const c = this.digest.competition;
		return `${getZktOrigin()}/admin/zkt/${c.slug ?? c.id}/?tab=registrations`;
	}

	linkText() {
		return 'Kayıtları görüntüle';
	}

	categoryName() {
		return 'Admin';
	}

	customData(): object {
		return {competitionId: this.digest.competition.id};
	}
}
