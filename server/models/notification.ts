import {getPrisma} from '../database';
import Notification from '../resources/notification_types/notification';
import {UserAccount} from '../schemas/UserAccount.schema';
import {Notification as NotificationSchema} from '../schemas/Notification.schema';

const notificationInclude = {
	triggering_user: {
		include: {
			profile: {
				include: {
					pfp_image: true,
				},
			},
		},
	},
};

export async function getNotificationById(id: string): Promise<NotificationSchema | null> {
	return await getPrisma().notification.findUnique({
		where: {
			id,
		},
	});
}

export async function getUnreadNotificationCount(user: UserAccount): Promise<number> {
	return await getPrisma().notification.count({
		where: {
			user_id: user.id,
			read_at: null,
		},
	});
}

export function getNotifications(user: UserAccount, offset: number, limit: number) {
	return getPrisma().notification.findMany({
		where: {
			user_id: user.id,
		},
		orderBy: {
			created_at: 'desc',
		},
		skip: offset,
		take: limit,
		include: notificationInclude,
	});
}

export async function readNotification(notification: NotificationSchema): Promise<NotificationSchema> {
	return await getPrisma().notification.update({
		where: {
			id: notification.id,
		},
		data: {
			read_at: new Date(),
		},
	});
}

export async function deleteNotification(notification: NotificationSchema) {
	return getPrisma().notification.delete({
		where: {
			id: notification.id,
		},
	});
}

/**
 * Clears every notification a user has, not just the page in front of them.
 *
 * The inbox loads ten at a time, so "clear all" used to loop over the loaded page and
 * delete those; the next page then slid up and the list looked like it refused to
 * empty. Anyone with more than ten notifications had to press it over and over.
 */
export async function deleteAllNotifications(user: UserAccount): Promise<number> {
	const result = await getPrisma().notification.deleteMany({
		where: {user_id: user.id},
	});

	return result.count;
}
