import {getPrisma} from '../database';
import {UserAccount, InternalUserAccount} from '../schemas/UserAccount.schema';
import NewUserSignupNotification from '../resources/notification_types/new_user_signup';
import AdminProPurchaseNotification from '../resources/notification_types/admin_pro_purchase';
import AdminSupportTicketNotification from '../resources/notification_types/admin_support_ticket';
import AdminSupportTicketReplyNotification from '../resources/notification_types/admin_support_ticket_reply';
import SupportTicketReplyNotification from '../resources/notification_types/support_ticket_reply';
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

export async function notifyAdminsOfSupportTicket(
	sender: InternalUserAccount,
	ticketSubject: string
): Promise<void> {
	const admins = await getPrisma().userAccount.findMany({
		where: {admin: true},
	});

	for (const admin of admins) {
		try {
			const notification = new AdminSupportTicketNotification(
				{user: admin as UserAccount, triggeringUser: sender, sendEmail: false},
				ticketSubject
			);
			await notification.send();
			await sendPushToUser(admin.id, 'Zkt Timer', notification.inAppMessage());
		} catch (error) {
			console.error(`[AdminNotification] Failed to notify admin ${admin.id} of support ticket:`, error);
		}
	}
}

export async function notifyAdminsOfTicketReply(
	sender: InternalUserAccount,
	ticketSubject: string,
	ticketId: string
): Promise<void> {
	const admins = await getPrisma().userAccount.findMany({
		where: {admin: true},
	});

	for (const admin of admins) {
		try {
			const notification = new AdminSupportTicketReplyNotification(
				{user: admin as UserAccount, triggeringUser: sender, sendEmail: false},
				ticketSubject,
				ticketId
			);
			await notification.send();
			await sendPushToUser(admin.id, 'Zkt Timer', notification.inAppMessage());
		} catch (error) {
			console.error(`[AdminNotification] Failed to notify admin ${admin.id} of ticket reply:`, error);
		}
	}
}

export async function notifyUserOfTicketReply(
	user: InternalUserAccount,
	admin: InternalUserAccount,
	ticketSubject: string,
	ticketId: string
): Promise<void> {
	try {
		const notification = new SupportTicketReplyNotification(
			{user: user as UserAccount, triggeringUser: admin, sendEmail: false},
			ticketSubject,
			ticketId
		);
		await notification.send();
		await sendPushToUser(user.id, 'Zkt Timer', notification.inAppMessage());
	} catch (error) {
		console.error(`[SupportTicket] Failed to notify user ${user.id} of admin reply:`, error);
	}
}
