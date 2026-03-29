import {getPrisma} from '../database';
import {UserAccount, InternalUserAccount} from '../schemas/UserAccount.schema';
import NewUserSignupNotification from '../resources/notification_types/new_user_signup';
import {sendPushToUser} from './push';

export async function notifyAdminsOfNewUser(
	newUser: InternalUserAccount,
	registrationMethod: 'local' | 'wca'
): Promise<void> {
	const admins = await getPrisma().userAccount.findMany({
		where: {admin: true},
	});

	for (const admin of admins) {
		try {
			const notification = new NewUserSignupNotification(
				{user: admin as UserAccount, triggeringUser: newUser, sendEmail: false},
				registrationMethod
			);
			await notification.send();
			await sendPushToUser(admin.id, 'Zkt-Timer', notification.data().inAppMessage);
		} catch (error) {
			console.error(`[AdminNotification] Failed to notify admin ${admin.id}:`, error);
		}
	}
}
