import {DmPolicy} from '@prisma/client';
import {getPrisma} from '../database';
import {publicUserInclude} from './user_account';

export const MESSAGE_PAGE_SIZE = 30;
export const CONVERSATION_PAGE_SIZE = 25;
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * How many messages travel with a report.
 *
 * Enough for a moderator to judge context, few enough that reporting is not a way to
 * hand over an entire conversation history. WhatsApp uses the same order of magnitude.
 */
export const REPORT_SNAPSHOT_SIZE = 5;
export const MAX_REPORT_REASON_LENGTH = 500;

export interface DmGateResult {
	allowed: boolean;
	/** False when the recipient's policy sends first contact to the request box. */
	autoAccepted: boolean;
	reason?: 'blocked' | 'policy_nobody' | 'self';
}

/**
 * The shape a message leaves this module in. Shared by create and edit so the socket
 * payload is identical whichever path produced it.
 */
const messageInclude = {
	sender: publicUserInclude,
	solve: true,
};

export function conversationInclude(viewerId: string) {
	return {
		participants: {
			include: {user: publicUserInclude},
		},
		messages: {
			where: {deleted_at: null},
			orderBy: {created_at: 'desc' as const},
			take: 1,
		},
	};
}

/** Blocks are symmetric for delivery: either direction closes the channel. */
export async function isBlockedBetween(userA: string, userB: string): Promise<boolean> {
	const block = await getPrisma().userBlock.findFirst({
		where: {
			OR: [
				{blocker_id: userA, blocked_id: userB},
				{blocker_id: userB, blocked_id: userA},
			],
		},
		select: {id: true},
	});

	return Boolean(block);
}

export async function getSocialPreference(userId: string) {
	const existing = await getPrisma().socialPreference.findUnique({where: {user_id: userId}});
	if (existing) {
		return existing;
	}

	// Lazily created so every account behaves as if it already had defaults.
	return getPrisma().socialPreference.create({data: {user_id: userId}});
}

/**
 * Decides whether `senderId` may open a conversation with `recipientId`, and whether
 * it lands in the inbox or the request box.
 *
 * An existing accepted conversation bypasses the policy: once someone has replied to
 * you, tightening their policy later should not strand the thread you both use.
 */
export async function checkDmGate(senderId: string, recipientId: string): Promise<DmGateResult> {
	if (senderId === recipientId) {
		return {allowed: false, autoAccepted: false, reason: 'self'};
	}

	if (await isBlockedBetween(senderId, recipientId)) {
		return {allowed: false, autoAccepted: false, reason: 'blocked'};
	}

	const prefs = await getSocialPreference(recipientId);

	if (prefs.dm_policy === DmPolicy.NOBODY) {
		return {allowed: false, autoAccepted: false, reason: 'policy_nobody'};
	}

	return {
		allowed: true,
		autoAccepted: prefs.dm_policy === DmPolicy.EVERYONE,
	};
}

/** The one-to-one conversation between two users, if it already exists. */
export async function findDirectConversation(userA: string, userB: string) {
	return getPrisma().conversation.findFirst({
		where: {
			AND: [
				{participants: {some: {user_id: userA}}},
				{participants: {some: {user_id: userB}}},
			],
		},
		include: {participants: true},
	});
}

export async function createDirectConversation(senderId: string, recipientId: string, autoAccepted: boolean) {
	const now = new Date();

	return getPrisma().conversation.create({
		data: {
			last_message_at: now,
			participants: {
				create: [
					// The opener has by definition accepted the thread.
					{user_id: senderId, accepted_at: now, last_read_at: now},
					{user_id: recipientId, accepted_at: autoAccepted ? now : null},
				],
			},
		},
		include: {participants: true},
	});
}

export async function getParticipant(conversationId: string, userId: string) {
	return getPrisma().conversationParticipant.findUnique({
		where: {conversation_id_user_id: {conversation_id: conversationId, user_id: userId}},
	});
}

/**
 * Writes the message and moves every counter that depends on it in one transaction,
 * so an inbox badge can never disagree with the thread it points at.
 */
export async function insertMessage(params: {
	conversationId: string;
	senderId: string;
	body: string;
	solveId?: string | null;
}) {
	const {conversationId, senderId, body, solveId} = params;
	const now = new Date();

	const [message] = await getPrisma().$transaction([
		getPrisma().message.create({
			data: {
				conversation_id: conversationId,
				sender_id: senderId,
				body,
				solve_id: solveId || null,
			},
			include: messageInclude,
		}),
		getPrisma().conversation.update({
			where: {id: conversationId},
			data: {last_message_at: now},
		}),
		// Everyone except the sender gains an unread. The sender's own row is marked
		// read instead, otherwise their thread shows up bold to themselves.
		getPrisma().conversationParticipant.updateMany({
			where: {conversation_id: conversationId, user_id: {not: senderId}},
			data: {unread_count: {increment: 1}, archived: false},
		}),
		// The sender is un-archived as well: writing into a thread you had swiped away
		// puts it back in your own inbox, otherwise the message you just sent is
		// nowhere to be found on your side.
		getPrisma().conversationParticipant.updateMany({
			where: {conversation_id: conversationId, user_id: senderId},
			data: {last_read_at: now, unread_count: 0, archived: false},
		}),
	]);

	return message;
}

/**
 * Whether the sender has already used up their single message into a request box.
 *
 * A stranger gets exactly one message until the other person accepts, the way
 * Instagram does it. Without the limit the request box protects nobody: a stranger
 * could still write forty lines into it, and the recipient would have to read them to
 * decide whether to accept.
 *
 * Note what does not count as a request: a conversation the recipient has accepted, and
 * one opened by someone whose policy is EVERYONE, because they have deliberately asked
 * for messages to arrive without a request step.
 */
export async function requestQuotaUsed(conversationId: string, senderId: string): Promise<boolean> {
	const others = await getPrisma().conversationParticipant.findMany({
		where: {conversation_id: conversationId, user_id: {not: senderId}},
		select: {accepted_at: true},
	});

	// Everyone on the other side has accepted, so this is an ordinary conversation.
	if (others.length === 0 || others.every((o) => o.accepted_at)) {
		return false;
	}

	// Unsent messages do not restore the quota: withdrawing the first line and writing
	// another one would be an unlimited channel with extra steps.
	const alreadySent = await getPrisma().message.count({
		where: {conversation_id: conversationId, sender_id: senderId},
	});

	return alreadySent > 0;
}

/** Replying is the accept action: no separate "accept request" button. */
export async function acceptConversation(conversationId: string, userId: string) {
	return getPrisma().conversationParticipant.updateMany({
		where: {conversation_id: conversationId, user_id: userId, accepted_at: null},
		data: {accepted_at: new Date()},
	});
}

/**
 * "Unsend": the sender withdraws one of their own messages.
 *
 * The row survives so the other side's unread counter and the thread ordering stay
 * consistent, but the body is wiped rather than merely flagged. A message the user
 * asked to take back must not sit in the database as readable text.
 */
export async function unsendMessage(messageId: string, userId: string) {
	const result = await getPrisma().message.updateMany({
		where: {id: messageId, sender_id: userId, deleted_at: null},
		data: {deleted_at: new Date(), body: '', solve_id: null},
	});

	return result.count > 0;
}

/**
 * How long after sending a message may still be edited.
 *
 * The same fifteen minutes WhatsApp allows, and for the same reason: long enough to
 * fix a typo or a wrong word, short enough that nobody can quietly rewrite a
 * conversation somebody already acted on. An unbounded window would turn every old
 * message into something the sender can still change under the reader's feet.
 */
export const EDIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Flat rather than a discriminated union on purpose: this project compiles with
 * strictNullChecks off, where TypeScript will not narrow `{ok: true} | {ok: false}`
 * and every caller ends up casting. A null `message` is the refusal.
 */
export interface EditResult {
	message: any | null;
	reason?: 'not_found' | 'too_late' | 'deleted';
}

/**
 * Rewrites the text of one's own message.
 *
 * Deliberately narrow. Only `body` moves: an attached solve stays exactly what the
 * reader saw, because swapping it would be sharing a different thing under a message
 * they already read. `edited_at` is set once and never cleared, so the label cannot be
 * shaken off by editing back to the original text.
 */
export async function editMessage(messageId: string, userId: string, body: string): Promise<EditResult> {
	const existing = await getPrisma().message.findFirst({
		where: {id: messageId, sender_id: userId},
		select: {id: true, deleted_at: true, created_at: true, solve_id: true},
	});

	if (!existing) {
		return {message: null, reason: 'not_found'};
	}
	if (existing.deleted_at) {
		return {message: null, reason: 'deleted'};
	}
	if (Date.now() - new Date(existing.created_at).getTime() > EDIT_WINDOW_MS) {
		return {message: null, reason: 'too_late'};
	}

	const message = await getPrisma().message.update({
		where: {id: messageId},
		data: {body, edited_at: new Date()},
		include: messageInclude,
	});

	return {message};
}

/**
 * "Delete chat", one-sided. Hides everything up to now from this participant only and
 * drops the thread out of their inbox; the other person keeps their full copy.
 */
export async function clearConversation(conversationId: string, userId: string) {
	const result = await getPrisma().conversationParticipant.updateMany({
		where: {conversation_id: conversationId, user_id: userId},
		data: {cleared_at: new Date(), archived: true, unread_count: 0},
	});

	return result.count > 0;
}

/**
 * Files a report and freezes the evidence with it.
 *
 * The snapshot is what makes moderation possible without a mailbox-reading admin
 * screen: a moderator can only ever see the handful of messages the reporter chose to
 * attach, exactly as they looked when the report was filed. Nothing later, nothing
 * earlier, and nothing from any other thread.
 *
 * Returns null when the reporter already has an open report on this conversation, so
 * repeatedly tapping report cannot flood the queue.
 */
export async function createMessageReport(params: {
	conversationId: string;
	reporterId: string;
	reason: string;
	clearedAt?: Date | null;
}) {
	const {conversationId, reporterId, reason, clearedAt} = params;

	const existing = await getPrisma().messageReport.findFirst({
		where: {conversation_id: conversationId, reporter_id: reporterId, status: 'OPEN'},
		select: {id: true},
	});
	if (existing) {
		return null;
	}

	const other = await getPrisma().conversationParticipant.findFirst({
		where: {conversation_id: conversationId, user_id: {not: reporterId}},
		select: {user_id: true},
	});
	if (!other) {
		return null;
	}

	const recent = await listMessages(conversationId, null, clearedAt);
	const snapshot = recent
		.slice(0, REPORT_SNAPSHOT_SIZE)
		.reverse()
		.map((m: any) => ({
			id: m.id,
			sender_id: m.sender_id,
			sender_username: m.sender?.username ?? null,
			body: m.body,
			has_solve: Boolean(m.solve_id),
			created_at: m.created_at.toISOString(),
		}));

	return getPrisma().messageReport.create({
		data: {
			conversation_id: conversationId,
			reporter_id: reporterId,
			reported_id: other.user_id,
			reason: reason.slice(0, MAX_REPORT_REASON_LENGTH),
			snapshot,
		},
	});
}

export async function markConversationRead(conversationId: string, userId: string) {
	return getPrisma().conversationParticipant.updateMany({
		where: {conversation_id: conversationId, user_id: userId},
		data: {unread_count: 0, last_read_at: new Date()},
	});
}

export async function listConversations(userId: string, opts: {requests: boolean; page: number}) {
	const {requests, page} = opts;
	const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;

	return getPrisma().conversationParticipant.findMany({
		where: {
			user_id: userId,
			archived: false,
			accepted_at: requests ? null : {not: null},
		},
		orderBy: {conversation: {last_message_at: 'desc'}},
		skip: (safePage - 1) * CONVERSATION_PAGE_SIZE,
		take: CONVERSATION_PAGE_SIZE,
		include: {
			conversation: {include: conversationInclude(userId)},
		},
	});
}

/**
 * The number on the header badge.
 *
 * Muted conversations are left out. Their per-thread counter still moves, so the row
 * stays bold in the inbox and nothing is hidden; what mute removes is the part that
 * demands attention from every page of the app. A badge that keeps climbing for a
 * conversation you deliberately silenced is the same nagging with extra steps.
 */
export async function totalUnread(userId: string): Promise<number> {
	const rows = await getPrisma().conversationParticipant.aggregate({
		where: {user_id: userId, archived: false, accepted_at: {not: null}, muted: false},
		_sum: {unread_count: true},
	});

	return rows._sum.unread_count || 0;
}

/** Turns notifications for one conversation on or off, for this participant only. */
export async function setConversationMuted(conversationId: string, userId: string, muted: boolean) {
	const result = await getPrisma().conversationParticipant.updateMany({
		where: {conversation_id: conversationId, user_id: userId},
		data: {muted},
	});

	return result.count > 0;
}

/**
 * Newest-first page of a thread; `before` is the cursor's created_at.
 *
 * `clearedAt` is the viewer's own "delete chat" marker. It is applied per reader rather
 * than per thread, so clearing your copy never touches what the other side can see.
 */
export async function listMessages(conversationId: string, before?: Date | null, clearedAt?: Date | null) {
	// Both bounds land on created_at, so they have to be merged into one object.
	// Spreading them separately would silently drop whichever came first.
	const createdAt: {gt?: Date; lt?: Date} = {};
	if (clearedAt) createdAt.gt = clearedAt;
	if (before) createdAt.lt = before;

	return getPrisma().message.findMany({
		where: {
			conversation_id: conversationId,
			deleted_at: null,
			...(createdAt.gt || createdAt.lt ? {created_at: createdAt} : {}),
		},
		orderBy: {created_at: 'desc'},
		take: MESSAGE_PAGE_SIZE,
		include: {
			sender: publicUserInclude,
			solve: true,
		},
	});
}
