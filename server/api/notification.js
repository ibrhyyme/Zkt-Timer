import {checkLoggedIn} from '../util/auth';
import {
	deleteAllNotifications,
	deleteNotification,
	getNotificationById,
	getNotifications,
	getUnreadNotificationCount,
	readNotification,
} from '../models/notification';
import GraphQLError from '../util/graphql_error';

export const gqlQuery = `
	unreadNotificationCount: Int
	notifications(page: Int): [Notification]
`;

export const gqlMutation = `
	deleteNotification(id: String): Notification
	deleteAllNotifications: Int
	markNotificationAsRead(id: String): Notification
`;

export const queryActions = {
	unreadNotificationCount: async (_, params, {user}) => {
		checkLoggedIn(user);
		return await getUnreadNotificationCount(user);
	},
	notifications: async (_, {page}, {user}) => {
		checkLoggedIn(user);

		const pageSize = 10;
		const offset = page * pageSize;

		return await getNotifications(user, offset, pageSize);
	},
};

export const mutateActions = {
	markNotificationAsRead: async (_, {id}, {user}) => {
		checkLoggedIn(user);

		const notif = await getNotificationById(id);

		if (!notif) {
			return new GraphQLError(404, 'Notification not found');
		}

		return await readNotification(notif);
	},

	deleteAllNotifications: async (_, params, {user}) => {
		checkLoggedIn(user);
		return await deleteAllNotifications(user);
	},

	deleteNotification: async (_, {id}, {user}) => {
		checkLoggedIn(user);

		const notif = await getNotificationById(id);

		if (!notif) {
			return new GraphQLError(404, 'Notification not found');
		}

		return await deleteNotification(notif);
	},
};
