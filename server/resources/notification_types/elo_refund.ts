import Notification from './notification';
import { NotificationInput } from '../../@types/interfaces/server.interface';
import { NotificationType } from '../../@types/enums';

interface EloRefundNotificationInputData {
	eloRefunded: number;
	numberOfGames: number;
}

export default class EloRefundNotification extends Notification {
	eloData: EloRefundNotificationInputData;

	constructor(input: NotificationInput, data: EloRefundNotificationInputData) {
		super(input);
		this.eloData = data;
	}

	notificationType() {
		return NotificationType.ELO_REFUND;
	}

	subject() {
		const refunded = this.eloData.eloRefunded.toLocaleString();
		return `Zkt-Timer hesabına ${refunded} ELO iade edildi`;
	}

	inAppMessage() {
		const refunded = this.eloData.eloRefunded.toLocaleString();
		return `Zkt-Timer hesabına ${refunded} ELO iade edildi`;
	}

	message() {
		const refunded = this.eloData.eloRefunded.toLocaleString();
		const games = this.eloData.numberOfGames;
		const gamesLocale = `${games} oyun`;
		const cheater = this.input.triggeringUser.username;
		return `${cheater} adlı kullanıcının hile yaptığı tespit edildiği için, ona kaybettiğin ${gamesLocale} karşılığında ${refunded} ELO hesabına iade edildi.`;
	}

	icon() {
		return 'sword';
	}

	link() {
		return `${process.env.BASE_URI}/user/${this.input.user.username}`;
	}

	linkText() {
		return `Profilini görüntüle →`;
	}

	categoryName() {
		return '1v1';
	}

	customData(): object {
		return this.eloData;
	}
}
