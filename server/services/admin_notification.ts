import {getPrisma} from '../database';
import {UserAccount, InternalUserAccount} from '../schemas/UserAccount.schema';
import NewUserSignupNotification from '../resources/notification_types/new_user_signup';
import AdminProPurchaseNotification from '../resources/notification_types/admin_pro_purchase';
import {sendPushToUser} from './push';
import {getRedisPubClient} from './redis';

// Bot signup spam'a karsi cooldown: ayni email icin 24 saatte sadece bir kez admin bildirimi.
// Saldirgan farkli IP'lerden 100 hesap acsa bile her admin sadece bir kez bilgilendirilir.
const ADMIN_NOTIFY_COOLDOWN_KEY_PREFIX = 'admin_notify:';
const ADMIN_NOTIFY_COOLDOWN_SECONDS = 24 * 60 * 60;

async function shouldNotifyForUser(userEmail: string): Promise<boolean> {
	if (!userEmail) return true;
	try {
		const client = getRedisPubClient();
		if (!client) return true; // Redis yoksa cooldown'i atla, bildirim gec
		const key = `${ADMIN_NOTIFY_COOLDOWN_KEY_PREFIX}${userEmail.toLowerCase()}`;
		// SET NX EX: sadece anahtar yoksa set et
		const result = await client.set(key, '1', 'EX', ADMIN_NOTIFY_COOLDOWN_SECONDS, 'NX');
		return result === 'OK'; // OK ise yeni — bildirim gonder. null ise zaten var — gec.
	} catch {
		return true; // Hata durumunda fail-open
	}
}

export async function notifyAdminsOfNewUser(
	newUser: InternalUserAccount,
	registrationMethod: 'local' | 'wca',
	pending: boolean = false
): Promise<void> {
	// Cooldown check: ayni email icin 24 saatte tekrar bildirim gonderme
	if (!(await shouldNotifyForUser(newUser.email))) {
		return;
	}

	const admins = await getPrisma().userAccount.findMany({
		where: {admin: true},
	});

	for (const admin of admins) {
		try {
			const notification = new NewUserSignupNotification(
				{user: admin as UserAccount, triggeringUser: newUser, sendEmail: false},
				registrationMethod,
				pending
			);
			await notification.send();
			await sendPushToUser(admin.id, 'Zkt Timer', notification.data().inAppMessage);
		} catch (error) {
			console.error(`[AdminNotification] Failed to notify admin ${admin.id}:`, error);
		}
	}
}

export async function notifyAdminsOfProPurchase(
	buyer: InternalUserAccount,
	plan: 'monthly' | 'yearly' | 'lifetime' | 'unknown',
	platform: 'ios' | 'android'
): Promise<void> {
	const admins = await getPrisma().userAccount.findMany({
		where: {admin: true},
	});

	for (const admin of admins) {
		try {
			const notification = new AdminProPurchaseNotification(
				{user: admin as UserAccount, triggeringUser: buyer, sendEmail: false},
				plan,
				platform
			);
			await notification.send();
			await sendPushToUser(admin.id, 'Zkt Timer', notification.inAppMessage());
		} catch (error) {
			console.error(`[AdminNotification] Failed to notify admin ${admin.id} of Pro purchase:`, error);
		}
	}
}
