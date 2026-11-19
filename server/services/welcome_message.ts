import {getPrisma} from '../database';
import {getSiteConfig} from '../models/site_config';
import {insertMessage, isBlockedBetween, openAdminConversation} from '../models/messaging';
import {deliverMessage} from './dm_delivery';
import {createI18nInstance} from '../i18n_server';
import {logger} from './logger';
import {WELCOME_MESSAGE_KIND, WELCOME_MIN_ACTIVE_MINUTES, isWelcomeCandidate} from '../../shared/welcome';

/**
 * Sends a new member the one-time welcome message from the admin who switched the
 * feature on, once they have been active for about a minute.
 *
 * Driven by the activity heartbeat rather than a timer of its own: the heartbeat only
 * fires while the app is on screen and the person is doing something, which is exactly
 * "opened the app and stayed". Called fire and forget; it never throws.
 */
export async function maybeSendWelcomeMessage(user: {
	id: string;
	created_at?: Date | null;
	welcome_sent_at?: Date | null;
}): Promise<void> {
	try {
		if (!isWelcomeCandidate(user)) return;

		const config = await getSiteConfig();
		const senderId = config.welcome_sender_id;
		if (!config.welcome_message_enabled || !config.messaging_enabled || !senderId || senderId === user.id) {
			return;
		}

		const activeMinutes = await getPrisma().userActivityHeartbeat.count({where: {user_id: user.id}});
		if (activeMinutes < WELCOME_MIN_ACTIVE_MINUTES) return;

		// Someone who came in through a ZKT ID already knows us from a competition or the
		// federation, so the welcome and its "where did you hear about us" are skipped.
		const zktLinks = await getPrisma().integration.count({where: {user_id: user.id, service_name: 'zkt'}});
		if (zktLinks > 0) return;

		const sender = await getPrisma().userAccount.findUnique({
			where: {id: senderId},
			select: {id: true, username: true, admin: true},
		});
		if (!sender?.admin) return;

		// The claim: the first heartbeat to flip the column sends, every other one stops.
		const claimed = await getPrisma().userAccount.updateMany({
			where: {id: user.id, welcome_sent_at: null},
			data: {welcome_sent_at: new Date()},
		});
		if (claimed.count === 0) return;

		if (await isBlockedBetween(sender.id, user.id)) return;

		const recipient = await getPrisma().userAccount.findUnique({
			where: {id: user.id},
			select: {username: true, settings: {select: {locale: true}}},
		});
		const i18n = createI18nInstance(recipient?.settings?.locale || 'en');
		const body = i18n.t('welcome_message.body', {
			name: recipient?.username || '',
			sender: sender.username || '',
		}) as string;

		const conversationId = await openAdminConversation(sender.id, user.id);
		const message = await insertMessage({
			conversationId,
			senderId: sender.id,
			body,
			kind: WELCOME_MESSAGE_KIND,
		});

		await deliverMessage({
			message,
			recipients: [{id: user.id, accepted: true}],
			senderUsername: sender.username || 'ZKT Timer',
		});
	} catch (e) {
		logger.warn('[Welcome] send failed', {userId: user?.id, error: (e as Error)?.message});
	}
}
