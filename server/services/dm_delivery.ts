import {getSocketIO} from './socket';
import {getClientIdsInRoom, userRoom} from './socket_util';
import {sendPushToUser} from './push';
import {getSocialPreference} from '../models/messaging';
import {getPrisma} from '../database';
import {createRedisKey, RedisNamespace, getValueFromRedis, setKeyInRedis} from './redis';
import {logger} from './logger';

export const DM_MESSAGE_EVENT = 'dm:message';
export const DM_INBOX_EVENT = 'dm:inbox_changed';
export const DM_UNSEND_EVENT = 'dm:unsent';
export const DM_EDIT_EVENT = 'dm:edited';
export const DM_REACTION_EVENT = 'dm:reaction';
export const DM_TYPING_EVENT = 'dm:typing';
export const DM_READ_EVENT = 'dm:read';

/**
 * Typing and read state are reciprocal: you only get to see someone else's if you
 * publish your own. Both sides are checked here rather than in the UI, so turning the
 * setting off actually stops the data leaving the server instead of just hiding it.
 */
async function bothSharing(
	actorId: string,
	otherId: string,
	field: 'read_receipts' | 'typing_indicator'
): Promise<boolean> {
	const [actor, other] = await Promise.all([getSocialPreference(actorId), getSocialPreference(otherId)]);
	return Boolean((actor as any)[field]) && Boolean((other as any)[field]);
}

/** Ephemeral: never stored, only forwarded to people already in the conversation. */
export async function broadcastTyping(params: {
	conversationId: string;
	actorId: string;
	recipientIds: string[];
	typing: boolean;
}): Promise<void> {
	const {conversationId, actorId, recipientIds, typing} = params;

	try {
		const io = getSocketIO();
		if (!io) return;

		for (const recipientId of recipientIds) {
			if (!(await bothSharing(actorId, recipientId, 'typing_indicator'))) {
				continue;
			}
			io.to(userRoom(recipientId)).emit(DM_TYPING_EVENT, {
				conversation_id: conversationId,
				user_id: actorId,
				typing,
			});
		}
	} catch (e) {
		logger.warn('[DM] typing broadcast failed', {error: (e as Error)?.message});
	}
}

export async function broadcastRead(params: {
	conversationId: string;
	actorId: string;
	recipientIds: string[];
	readAt: Date;
}): Promise<void> {
	const {conversationId, actorId, recipientIds, readAt} = params;

	try {
		const io = getSocketIO();
		if (!io) return;

		for (const recipientId of recipientIds) {
			if (!(await bothSharing(actorId, recipientId, 'read_receipts'))) {
				continue;
			}
			io.to(userRoom(recipientId)).emit(DM_READ_EVENT, {
				conversation_id: conversationId,
				user_id: actorId,
				read_at: readAt.toISOString(),
			});
		}
	} catch (e) {
		logger.warn('[DM] read broadcast failed', {error: (e as Error)?.message});
	}
}

/**
 * Pushes an edited message to everyone in the thread.
 *
 * Sends the whole message rather than just the new text, so a client can replace its
 * copy without asking for anything: the same rule the delivery path follows, and the
 * reason a chat message costs one request instead of five.
 */
export async function broadcastEdit(params: {
	conversationId: string;
	message: any;
	participantIds: string[];
}): Promise<void> {
	const {conversationId, message, participantIds} = params;

	try {
		const io = getSocketIO();
		if (!io) return;

		const wire = toWireMessage(message);
		for (const userId of participantIds) {
			io.to(userRoom(userId)).emit(DM_EDIT_EVENT, {conversation_id: conversationId, message: wire});
			// The inbox preview shows the last message, so editing it changes the list.
			io.to(userRoom(userId)).emit(DM_INBOX_EVENT);
		}
	} catch (e) {
		logger.warn('[DM] edit broadcast failed', {error: (e as Error)?.message});
	}
}

/**
 * Tells every open window that a message was withdrawn.
 *
 * The confirmation says "it is removed for the other person too", and until this existed
 * that was only true after they reloaded: the row was already wiped server-side but
 * their screen kept showing text that no longer exists anywhere.
 */
/**
 * Pushes a reaction change to everyone in the thread.
 *
 * Sends the whole set for that message rather than a delta: it is a handful of rows,
 * and a client that missed an earlier event would otherwise drift out of sync forever.
 */
export async function broadcastReaction(params: {
	conversationId: string;
	messageId: string;
	reactions: {user_id: string; emoji: string}[];
	participantIds: string[];
}): Promise<void> {
	const {conversationId, messageId, reactions, participantIds} = params;

	try {
		const io = getSocketIO();
		if (!io) return;

		for (const userId of participantIds) {
			io.to(userRoom(userId)).emit(DM_REACTION_EVENT, {
				conversation_id: conversationId,
				message_id: messageId,
				reactions,
			});
		}
	} catch (e) {
		logger.warn('[DM] reaction broadcast failed', {error: (e as Error)?.message});
	}
}

export async function broadcastUnsend(params: {
	conversationId: string;
	messageId: string;
	participantIds: string[];
}): Promise<void> {
	const {conversationId, messageId, participantIds} = params;

	try {
		const io = getSocketIO();
		if (!io) return;

		for (const userId of participantIds) {
			io.to(userRoom(userId)).emit(DM_UNSEND_EVENT, {conversation_id: conversationId, message_id: messageId});
			io.to(userRoom(userId)).emit(DM_INBOX_EVENT);
		}
	} catch (e) {
		logger.warn('[DM] unsend broadcast failed', {error: (e as Error)?.message});
	}
}

/**
 * Push is a fallback, not a duplicate of the socket.
 *
 * Two suppressions, both deliberate:
 *  - recipient has a live socket -> they are looking at the app, the in-app badge is
 *    enough and a buzzing phone next to an open chat is pure annoyance.
 *  - one push per conversation per debounce window -> a 20-message burst must not
 *    produce 20 notifications.
 */
const PUSH_DEBOUNCE_SECONDS = 30;

async function shouldSendPush(recipientId: string, conversationId: string, accepted: boolean): Promise<boolean> {
	// A pending request never rings a phone. Everything else about the request box is
	// designed so a stranger cannot push themselves into someone's attention: no chat
	// bubble, no clickable link, no presence. A notification is the loudest channel of
	// all and was the one place that rule was not being applied.
	if (!accepted) {
		return false;
	}

	// Muting one person is not the same as switching notifications off entirely, so it
	// is stored per conversation rather than on the account.
	const participant = await getPrisma().conversationParticipant.findFirst({
		where: {conversation_id: conversationId, user_id: recipientId},
		select: {muted: true},
	});
	if (participant?.muted) {
		return false;
	}

	const prefs = await getSocialPreference(recipientId);
	if (!prefs.dm_push) {
		return false;
	}

	const online = await getClientIdsInRoom(userRoom(recipientId));
	if (online && online.size > 0) {
		return false;
	}

	const key = createRedisKey(RedisNamespace.PRO_DATA, `dm_push:${recipientId}:${conversationId}`);
	const recent = await getValueFromRedis(key);
	if (recent) {
		return false;
	}

	await setKeyInRedis(key, '1', PUSH_DEBOUNCE_SECONDS);
	return true;
}

function previewOf(body: string, hasSolve: boolean): string {
	const trimmed = (body || '').trim();
	if (trimmed) {
		return trimmed.length > 120 ? `${trimmed.slice(0, 117)}...` : trimmed;
	}
	return hasSolve ? '📊' : '';
}

/**
 * Explicit wire shape for the socket, mirroring the client's MessageFragment.
 *
 * The Prisma row must never be broadcast as-is, for two independent reasons.
 *
 * Privacy: `sender.integrations` is a full Integration row, which holds the sender's
 * WCA OAuth `auth_token` and `refresh_token`. GraphQL never exposes those because the
 * schema only declares the three public fields, but a socket emit has no schema in
 * front of it and would hand the recipient the sender's credentials.
 *
 * Encoding: room broadcasts travel through the Redis adapter, which serialises with
 * msgpack (notepack). notepack handles Date fine but throws "Could not encode" on
 * BigInt, and the event is then dropped with no error reaching the caller. Both
 * `Integration.auth_expires_at` and `Solve.started_at`/`ended_at` are BigInt, so a raw
 * row silently fails for any sender with a linked WCA account or any attached solve.
 * The replacer below is the backstop for BigInt columns added later.
 */
function toWireMessage(message: any) {
	const sender = message.sender;
	const solve = message.solve;

	const picked = {
		id: message.id,
		conversation_id: message.conversation_id,
		sender_id: message.sender_id,
		body: message.body,
		created_at: message.created_at,
		// Null on everything that has never been touched, which is almost every message.
		edited_at: message.edited_at ?? null,
		reactions: (message.reactions || []).map((r: any) => ({user_id: r.user_id, emoji: r.emoji})),
		// The quoted line. Deliberately the same shape the GraphQL query returns, so a
		// client renders a quote identically whether it arrived over the socket or in
		// the initial page load. Only the fields the quote draws: never the full
		// message, which would drag another sender row through the socket.
		reply_to: message.reply_to
			? {
					id: message.reply_to.id,
					sender_id: message.reply_to.sender_id,
					body: message.reply_to.body,
					deleted_at: message.reply_to.deleted_at ?? null,
					solve_id: message.reply_to.solve_id ?? null,
					sender: {username: message.reply_to.sender?.username ?? null},
			  }
			: null,
		sender: sender
			? {
					id: sender.id,
					username: sender.username,
					verified: sender.verified,
					created_at: sender.created_at,
					banned_forever: sender.banned_forever,
					banned_until: sender.banned_until,
					is_pro: sender.is_pro,
					admin: sender.admin,
					mod: sender.mod,
					// Only what the avatar renders. Tokens stay on the server.
					integrations: (sender.integrations || []).map((i: any) => ({
						id: i.id,
						service_name: i.service_name,
						wca_country_iso2: i.wca_country_iso2,
					})),
					profile: sender.profile ? {pfp_image: sender.profile.pfp_image ?? null} : null,
			  }
			: null,
		solve: solve
			? {
					id: solve.id,
					time: solve.time,
					dnf: solve.dnf,
					plus_two: solve.plus_two,
					cube_type: solve.cube_type,
					scramble_subset: solve.scramble_subset,
					scramble: solve.scramble,
					share_code: solve.share_code,
					is_smart_cube: solve.is_smart_cube,
					created_at: solve.created_at,
			  }
			: null,
	};

	// Dates become the ISO strings the client already gets from GraphQL; any stray
	// BigInt becomes a string rather than killing the broadcast.
	return JSON.parse(JSON.stringify(picked, (_key, value) => (typeof value === 'bigint' ? value.toString() : value)));
}

/**
 * Fan-out for one new message: live socket to everyone in the thread, push only to
 * recipients who are actually away. Never throws — a delivery problem must not fail
 * the mutation that already persisted the message.
 */
export async function deliverMessage(params: {
	message: any;
	/**
	 * `accepted` is per recipient, so it is decided here rather than baked into the
	 * message: the same message is an ordinary chat for one side and a pending request
	 * for the other, and the client needs to know which it is holding.
	 */
	recipients: {id: string; accepted: boolean}[];
	senderUsername: string;
}): Promise<void> {
	const {message, recipients, senderUsername} = params;

	try {
		const io = getSocketIO();
		if (io) {
			const wire = toWireMessage(message);

			for (const recipient of recipients) {
				// The flag exists so a stranger cannot park a chat bubble on someone's
				// timer screen. Holding a message in the request box is meaningless if
				// it still floats over the page the moment it arrives.
				io.to(userRoom(recipient.id)).emit(DM_MESSAGE_EVENT, {...wire, request: !recipient.accepted});
				io.to(userRoom(recipient.id)).emit(DM_INBOX_EVENT);
			}
			// The sender's other tabs need the message too, but not an inbox bump. Never
			// a request: you have accepted every thread you are the one writing in.
			io.to(userRoom(message.sender_id)).emit(DM_MESSAGE_EVENT, {...wire, request: false});
		}
	} catch (e) {
		logger.warn('[DM] socket delivery failed', {error: (e as Error)?.message});
	}

	for (const recipient of recipients) {
		try {
			if (await shouldSendPush(recipient.id, message.conversation_id, recipient.accepted)) {
				await sendPushToUser(
					recipient.id,
					senderUsername,
					previewOf(message.body, Boolean(message.solve_id)),
					// `link` is what both tap handlers actually read: the Capacitor
					// listener in push-notifications.ts and the service worker's
					// notificationclick. Without it a tapped notification dropped
					// the user on the home page instead of the conversation.
					{
						type: 'dm',
						conversation_id: message.conversation_id,
						link: `/messages/${message.conversation_id}`,
					}
				);
			}
		} catch (e) {
			logger.warn('[DM] push delivery failed', {recipientId: recipient.id, error: (e as Error)?.message});
		}
	}
}
