import {Arg, Authorized, Ctx, Int, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {getPrisma} from '../database';
import {publicUserInclude} from '../models/user_account';
import {PublicUserAccount} from '../schemas/UserAccount.schema';
import {DmPolicy} from '@prisma/client';
import {getSiteConfig} from '../models/site_config';
import {checkRateLimit} from '../services/rate_limit';
import {broadcastEdit, broadcastRead, broadcastTyping, broadcastUnsend, deliverMessage} from '../services/dm_delivery';
import {broadcastPresence, forcePresenceOff, visibleOnlineUsers} from '../services/dm_presence';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	MAX_MESSAGE_LENGTH,
	CONVERSATION_PAGE_SIZE,
	MESSAGE_PAGE_SIZE,
	MAX_REPORT_REASON_LENGTH,
	acceptConversation,
	checkDmGate,
	clearConversation,
	createDirectConversation,
	createMessageReport,
	editMessage,
	findDirectConversation,
	getParticipant,
	getSocialPreference,
	insertMessage,
	isBlockedBetween,
	listConversations,
	listMessages,
	requestQuotaUsed,
	setConversationMuted,
	markConversationRead,
	totalUnread,
	unsendMessage,
} from '../models/messaging';
import {
	BlockedUser,
	ConversationList,
	ConversationView,
	InboxSummary,
	Message,
	MessageList,
	MessageReportList,
	MessageReportView,
	ReportStatusSchema,
	SocialPreference,
	UpdateSocialPreferenceInput,
} from '../schemas/Messaging.schema';

/**
 * Abuse ceilings. Deliberately generous for a normal conversation and tight enough
 * that a script cannot spray the whole user base.
 */
const MESSAGE_RATE_MAX = 20;
const MESSAGE_RATE_WINDOW = 60;
// Editing is cheap to abuse as a flicker attack, so it gets its own ceiling.
const EDIT_RATE_MAX = 30;
const EDIT_RATE_WINDOW = 60;
const NEW_CONVERSATION_RATE_MAX = 10;
const NEW_CONVERSATION_RATE_WINDOW = 3600;
const RECIPIENT_SEARCH_LIMIT = 8;
const REPORT_PAGE_SIZE = 25;

async function assertMessagingEnabled(context: GraphQLContext) {
	const config = await getSiteConfig();
	const isStaff = Boolean(context.user?.admin || context.user?.mod);
	if (!config.messaging_enabled && !isStaff) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Messaging is disabled');
	}
}

/** Flattens a participant row into the shape the inbox renders. */
function toConversationView(row: any, viewerId: string): ConversationView {
	const conversation = row.conversation;
	const other = conversation?.participants?.find((p: any) => p.user_id !== viewerId);

	// The preview has to respect this viewer's own clear marker, otherwise a thread they
	// deleted would come back showing the last message from before they deleted it.
	const lastMessage = conversation?.messages?.[0];
	const clearedAt = row.cleared_at ? new Date(row.cleared_at).getTime() : 0;
	const previewVisible = lastMessage && new Date(lastMessage.created_at).getTime() > clearedAt;

	return {
		id: conversation.id,
		other_user: other?.user,
		last_message: previewVisible ? lastMessage : null,
		unread_count: row.unread_count,
		accepted: Boolean(row.accepted_at),
		muted: Boolean(row.muted),
		last_message_at: conversation.last_message_at,
	};
}

@Resolver()
export class MessagingResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => ConversationList)
	async conversations(
		@Ctx() context: GraphQLContext,
		@Arg('page', () => Int, {nullable: true}) page?: number,
		@Arg('requests', {nullable: true}) requests?: boolean
	): Promise<ConversationList> {
		await assertMessagingEnabled(context);

		const rows = await listConversations(context.user.id, {
			requests: Boolean(requests),
			page: page || 1,
		});

		return {
			conversations: rows.map((row) => toConversationView(row, context.user.id)),
			more_results: rows.length === CONVERSATION_PAGE_SIZE,
		};
	}

	/**
	 * Recipient lookup for "New message".
	 *
	 * Search-only by design: an empty query returns nothing, so this can never be used
	 * to browse the member list. It also hides anyone who opted out of being found,
	 * who accepts no messages, or who is blocked in either direction.
	 */
	@Authorized([Role.LOGGED_IN])
	@Query(() => [PublicUserAccount])
	async messageRecipientSearch(
		@Ctx() context: GraphQLContext,
		@Arg('query') query: string
	): Promise<PublicUserAccount[]> {
		await assertMessagingEnabled(context);

		const term = (query || '').trim();
		if (term.length < 2) {
			return [];
		}

		const blocks = await getPrisma().userBlock.findMany({
			where: {OR: [{blocker_id: context.user.id}, {blocked_id: context.user.id}]},
			select: {blocker_id: true, blocked_id: true},
		});
		const blockedIds = new Set<string>();
		for (const block of blocks) {
			blockedIds.add(block.blocker_id === context.user.id ? block.blocked_id : block.blocker_id);
		}

		const users = await getPrisma().userAccount.findMany({
			where: {
				username: {contains: term, mode: 'insensitive'},
				banned_forever: false,
				id: {notIn: [context.user.id, ...blockedIds]},
				// No preference row means defaults, which are searchable and reachable.
				OR: [
					{social_preference: {is: null}},
					{social_preference: {searchable: true, dm_policy: {not: DmPolicy.NOBODY}}},
				],
			},
			orderBy: {username: 'asc'},
			take: RECIPIENT_SEARCH_LIMIT,
			...publicUserInclude,
		});

		return users as unknown as PublicUserAccount[];
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => InboxSummary)
	async inboxSummary(@Ctx() context: GraphQLContext): Promise<InboxSummary> {
		const [unread_total, request_count] = await Promise.all([
			totalUnread(context.user.id),
			getPrisma().conversationParticipant.count({
				where: {user_id: context.user.id, accepted_at: null, archived: false},
			}),
		]);

		return {unread_total, request_count};
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => MessageList)
	async messages(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string,
		@Arg('before', {nullable: true}) before?: Date
	): Promise<MessageList> {
		await assertMessagingEnabled(context);

		// Membership is the only read gate: never trust a conversation id from a client.
		const participant = await getParticipant(conversationId, context.user.id);
		if (!participant) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}

		// cleared_at is the viewer's own "delete chat" marker, so it is applied here
		// rather than in the query: the other participant still sees everything.
		const rows = await listMessages(conversationId, before, participant.cleared_at);

		return {
			messages: rows as unknown as Message[],
			more_results: rows.length === MESSAGE_PAGE_SIZE,
			accepted: Boolean(participant.accepted_at),
			awaiting_accept: await requestQuotaUsed(conversationId, context.user.id),
			muted: Boolean(participant.muted),
		};
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Message)
	async sendMessage(
		@Ctx() context: GraphQLContext,
		@Arg('body') body: string,
		@Arg('recipientId', {nullable: true}) recipientId?: string,
		@Arg('conversationId', {nullable: true}) conversationId?: string,
		@Arg('solveId', {nullable: true}) solveId?: string
	): Promise<Message> {
		await assertMessagingEnabled(context);
		const senderId = context.user.id;

		const trimmed = (body || '').trim();
		if (!trimmed && !solveId) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Message is empty');
		}
		if (trimmed.length > MAX_MESSAGE_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Message is too long');
		}

		const rate = await checkRateLimit(`dm:send:${senderId}`, MESSAGE_RATE_MAX, MESSAGE_RATE_WINDOW);
		if (!rate.allowed) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Too many messages, slow down');
		}

		// Only the owner may attach a solve — otherwise anyone could paste someone
		// else's solve id and surface a private solve inside a chat.
		if (solveId) {
			const solve = await getPrisma().solve.findUnique({
				where: {id: solveId},
				select: {user_id: true},
			});
			if (!solve || solve.user_id !== senderId) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid solve');
			}
		}

		let targetConversationId = conversationId;

		if (targetConversationId) {
			const participant = await getParticipant(targetConversationId, senderId);
			if (!participant) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
			}

			const others = await getPrisma().conversationParticipant.findMany({
				where: {conversation_id: targetConversationId, user_id: {not: senderId}},
				select: {user_id: true},
			});
			for (const other of others) {
				if (await isBlockedBetween(senderId, other.user_id)) {
					throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cannot message this user');
				}
			}

			// Replying to a request is what accepts it.
			await acceptConversation(targetConversationId, senderId);
		} else {
			if (!recipientId) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Recipient is required');
			}

			const existing = await findDirectConversation(senderId, recipientId);
			if (existing) {
				targetConversationId = existing.id;
				await acceptConversation(existing.id, senderId);
			} else {
				const gate = await checkDmGate(senderId, recipientId);
				if (!gate.allowed) {
					throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cannot message this user');
				}

				const newConvoRate = await checkRateLimit(
					`dm:new:${senderId}`,
					NEW_CONVERSATION_RATE_MAX,
					NEW_CONVERSATION_RATE_WINDOW
				);
				if (!newConvoRate.allowed) {
					throw new GraphQLError(ErrorCode.BAD_INPUT, 'Too many new conversations, try again later');
				}

				const created = await createDirectConversation(senderId, recipientId, gate.autoAccepted);
				targetConversationId = created.id;
			}
		}

		// One message into a request box, then silence until they accept. Checked here
		// rather than at the conversation level so it also covers a thread the recipient
		// later un-accepted, and so the sender gets a clear refusal instead of a message
		// that silently goes nowhere.
		if (await requestQuotaUsed(targetConversationId, senderId)) {
			throw new GraphQLError(
				ErrorCode.BAD_INPUT,
				'Wait for them to accept your request',
				{i18nKey: 'messages.error_request_pending'}
			);
		}

		const message = await insertMessage({
			conversationId: targetConversationId,
			senderId,
			body: trimmed,
			solveId,
		});

		// Fire and forget: the message is already persisted, so a socket or push
		// failure must not turn a delivered message into a failed mutation.
		const recipients = await getPrisma().conversationParticipant.findMany({
			where: {conversation_id: targetConversationId, user_id: {not: senderId}},
			select: {user_id: true, accepted_at: true},
		});
		void deliverMessage({
			message,
			recipients: recipients.map((r) => ({id: r.user_id, accepted: Boolean(r.accepted_at)})),
			senderUsername: context.user.username || 'Zkt Timer',
		});

		return message as unknown as Message;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async markConversationRead(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string
	): Promise<boolean> {
		const participant = await getParticipant(conversationId, context.user.id);
		if (!participant) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}

		const readAt = new Date();
		await markConversationRead(conversationId, context.user.id);

		const others = await getPrisma().conversationParticipant.findMany({
			where: {conversation_id: conversationId, user_id: {not: context.user.id}},
			select: {user_id: true},
		});
		void broadcastRead({
			conversationId,
			actorId: context.user.id,
			recipientIds: others.map((p) => p.user_id),
			readAt,
		});

		return true;
	}

	/**
	 * Typing state. Nothing is written down: it is forwarded to the other participants
	 * and forgotten, and the server drops it entirely when either side has the indicator
	 * turned off.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async setTyping(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string,
		@Arg('typing') typing: boolean
	): Promise<boolean> {
		const participant = await getParticipant(conversationId, context.user.id);
		if (!participant) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}

		const others = await getPrisma().conversationParticipant.findMany({
			where: {conversation_id: conversationId, user_id: {not: context.user.id}},
			select: {user_id: true},
		});

		void broadcastTyping({
			conversationId,
			actorId: context.user.id,
			recipientIds: others.map((p) => p.user_id),
			typing: Boolean(typing),
		});

		return true;
	}

	/**
	 * Accepts a pending request without having to write something first.
	 *
	 * Replying already accepts, but that forces a decision into the same gesture as a
	 * reply: someone who wants to let a stranger through before deciding what to say
	 * had no way to do it, and the sender stayed locked out of their second message.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async acceptConversationRequest(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string
	): Promise<boolean> {
		await assertMessagingEnabled(context);

		const participant = await getParticipant(conversationId, context.user.id);
		if (!participant) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}
		if (participant.accepted_at) {
			// Already accepted: nothing to do, and not worth an error.
			return true;
		}

		await acceptConversation(conversationId, context.user.id);
		return true;
	}

	/**
	 * Silences one conversation without the other person knowing.
	 *
	 * The middle step between putting up with someone and blocking them: messages keep
	 * arriving and the thread keeps its own unread count, but the phone stays quiet and
	 * the header badge ignores it. Nothing about this is visible to the other side, and
	 * nothing about it is broadcast.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async setConversationMuted(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string,
		@Arg('muted') muted: boolean
	): Promise<boolean> {
		await assertMessagingEnabled(context);

		const changed = await setConversationMuted(conversationId, context.user.id, muted);
		if (!changed) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async archiveConversation(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string
	): Promise<boolean> {
		const participant = await getParticipant(conversationId, context.user.id);
		if (!participant) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}

		// One-sided: hiding a thread must not delete the other person's copy.
		await getPrisma().conversationParticipant.update({
			where: {id: participant.id},
			data: {archived: true, unread_count: 0},
		});
		return true;
	}

	/**
	 * Withdraws one of your own messages. The text is wiped from the row rather than
	 * flagged, so a message you took back is not left sitting in the database.
	 */
	/**
	 * Edits the text of one's own message, within a short window after sending.
	 *
	 * Every rule lives on the server, not in the menu that hides the button: ownership,
	 * the time limit, and the fact that only `body` can change. A client is free to try
	 * anything; none of it gets past here.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Message)
	async editMessage(
		@Ctx() context: GraphQLContext,
		@Arg('messageId') messageId: string,
		@Arg('body') body: string
	): Promise<Message> {
		await assertMessagingEnabled(context);

		const trimmed = (body || '').trim();
		if (!trimmed) {
			// Emptying a message is unsending it, and that path wipes the row properly.
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Message is empty');
		}
		if (trimmed.length > MAX_MESSAGE_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Message is too long');
		}

		const rate = await checkRateLimit(`dm:edit:${context.user.id}`, EDIT_RATE_MAX, EDIT_RATE_WINDOW);
		if (!rate.allowed) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Too many edits, slow down');
		}

		const result = await editMessage(messageId, context.user.id, trimmed);
		if (!result.message) {
			// "not_found" also covers someone else's message: never confirm it exists.
			const message =
				result.reason === 'too_late'
					? 'Edit window has passed'
					: result.reason === 'deleted'
					? 'Message was removed'
					: 'Message not found';
			throw new GraphQLError(ErrorCode.BAD_INPUT, message);
		}

		const participants = await getPrisma().conversationParticipant.findMany({
			where: {conversation_id: result.message.conversation_id},
			select: {user_id: true},
		});

		void broadcastEdit({
			conversationId: result.message.conversation_id,
			message: result.message,
			participantIds: participants.map((p) => p.user_id),
		});

		return result.message as unknown as Message;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async unsendMessage(
		@Ctx() context: GraphQLContext,
		@Arg('messageId') messageId: string
	): Promise<boolean> {
		await assertMessagingEnabled(context);

		// Read the conversation before wiping the row: afterwards the message still
		// exists but nothing points at who needs to be told.
		const existing = await getPrisma().message.findFirst({
			where: {id: messageId, sender_id: context.user.id, deleted_at: null},
			select: {conversation_id: true},
		});

		// updateMany scopes on sender_id, so someone else's message can never match.
		const removed = await unsendMessage(messageId, context.user.id);
		if (!removed || !existing) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Message not found');
		}

		const participants = await getPrisma().conversationParticipant.findMany({
			where: {conversation_id: existing.conversation_id},
			select: {user_id: true},
		});

		void broadcastUnsend({
			conversationId: existing.conversation_id,
			messageId,
			participantIds: participants.map((p) => p.user_id),
		});

		return true;
	}

	/**
	 * Deletes the thread for you only. Everything up to now disappears from your side
	 * and the thread leaves your inbox; the other person's copy is untouched, which is
	 * how every messenger behaves and is the only option that does not let one person
	 * destroy someone else's record of a conversation.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async clearConversation(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string
	): Promise<boolean> {
		const participant = await getParticipant(conversationId, context.user.id);
		if (!participant) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}

		await clearConversation(conversationId, context.user.id);
		return true;
	}

	/**
	 * Reports a conversation, attaching a frozen copy of the last few messages.
	 *
	 * This is the only path by which any message text ever becomes visible to staff.
	 * There is no admin screen that opens a mailbox, so a report is the moment a user
	 * chooses to hand over evidence, not a moment we go looking for it.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async reportConversation(
		@Ctx() context: GraphQLContext,
		@Arg('conversationId') conversationId: string,
		@Arg('reason') reason: string
	): Promise<boolean> {
		await assertMessagingEnabled(context);

		const trimmed = (reason || '').trim();
		if (!trimmed) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Reason required');
		}
		if (trimmed.length > MAX_REPORT_REASON_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Reason too long');
		}

		const participant = await getParticipant(conversationId, context.user.id);
		if (!participant) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Conversation not found');
		}

		// Reporting is idempotent while a report is open: null means one already exists,
		// which is still a success from the reporter's point of view.
		await createMessageReport({
			conversationId,
			reporterId: context.user.id,
			reason: trimmed,
			clearedAt: participant.cleared_at,
		});

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [BlockedUser])
	async blockedUsers(@Ctx() context: GraphQLContext): Promise<BlockedUser[]> {
		const rows = await getPrisma().userBlock.findMany({
			where: {blocker_id: context.user.id},
			orderBy: {created_at: 'desc'},
			include: {blocked: publicUserInclude},
		});

		return rows.map((row) => ({
			id: row.id,
			user: row.blocked as any,
			created_at: row.created_at,
		}));
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async blockUser(@Ctx() context: GraphQLContext, @Arg('userId') userId: string): Promise<boolean> {
		if (!userId || userId === context.user.id) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid user');
		}

		await getPrisma().userBlock.upsert({
			where: {blocker_id_blocked_id: {blocker_id: context.user.id, blocked_id: userId}},
			update: {},
			create: {blocker_id: context.user.id, blocked_id: userId},
		});

		// Blocking also clears the thread from the blocker's inbox; the messages stay
		// so an unblock restores the history rather than silently losing it.
		await getPrisma().conversationParticipant.updateMany({
			where: {
				user_id: context.user.id,
				conversation: {participants: {some: {user_id: userId}}},
			},
			data: {archived: true, unread_count: 0},
		});

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async unblockUser(@Ctx() context: GraphQLContext, @Arg('userId') userId: string): Promise<boolean> {
		await getPrisma().userBlock.deleteMany({
			where: {blocker_id: context.user.id, blocked_id: userId},
		});

		// blockUser archived the thread. Undoing the block has to undo that too,
		// otherwise the conversation stays invisible to the unblocker until the other
		// side happens to write again, and there is no way back to it from the UI.
		await getPrisma().conversationParticipant.updateMany({
			where: {
				user_id: context.user.id,
				archived: true,
				conversation: {participants: {some: {user_id: userId}}},
			},
			data: {archived: false},
		});

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => SocialPreference)
	async socialPreference(@Ctx() context: GraphQLContext): Promise<SocialPreference> {
		const prefs = await getSocialPreference(context.user.id);
		return prefs as unknown as SocialPreference;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => SocialPreference)
	async updateSocialPreference(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateSocialPreferenceInput
	): Promise<SocialPreference> {
		await getSocialPreference(context.user.id);

		const updated = await getPrisma().socialPreference.update({
			where: {user_id: context.user.id},
			data: {
				...(input.dm_policy !== undefined ? {dm_policy: input.dm_policy as any} : {}),
				...(input.searchable !== undefined ? {searchable: input.searchable} : {}),
				...(input.dm_push !== undefined ? {dm_push: input.dm_push} : {}),
				...(input.read_receipts !== undefined ? {read_receipts: input.read_receipts} : {}),
				...(input.typing_indicator !== undefined ? {typing_indicator: input.typing_indicator} : {}),
				...(input.online_status !== undefined ? {online_status: input.online_status} : {}),
			},
		});

		// Switching the dot off has to reach the people currently looking at it, or it
		// stays lit on their screen until they reload.
		if (input.online_status !== undefined) {
			if (input.online_status) {
				void broadcastPresence(context.user.id, true);
			} else {
				void forcePresenceOff(context.user.id);
			}
		}

		return updated as unknown as SocialPreference;
	}

	/**
	 * Which of these people are online right now.
	 *
	 * A query rather than a field on the conversation because presence is not a
	 * property of the thread: it changes while the page is open, and the socket event
	 * keeps it current afterwards. Every permission check lives in the service.
	 */
	@Authorized([Role.LOGGED_IN])
	@Query(() => [String])
	async dmPresence(
		@Ctx() context: GraphQLContext,
		// validate: false matches every other scalar-array argument in this codebase.
		// class-validator refuses a bare string[] with "an unknown value was passed",
		// so without it the query fails before the resolver body ever runs.
		@Arg('userIds', () => [String], {validate: false}) userIds: string[]
	): Promise<string[]> {
		await assertMessagingEnabled(context);
		return visibleOnlineUsers(context.user.id, userIds || []);
	}

	/**
	 * Moderation queue. Staff only, and deliberately limited to what reporters handed
	 * over: there is no query anywhere that opens a live conversation for staff.
	 */
	@Authorized([Role.MOD])
	@Query(() => MessageReportList)
	async messageReports(
		@Arg('status', () => ReportStatusSchema, {nullable: true}) status?: ReportStatusSchema,
		@Arg('page', () => Int, {nullable: true}) page?: number
	): Promise<MessageReportList> {
		const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
		const where = status ? {status} : {};

		const [rows, openCount] = await Promise.all([
			getPrisma().messageReport.findMany({
				where: where as any,
				orderBy: {created_at: 'desc'},
				skip: (safePage - 1) * REPORT_PAGE_SIZE,
				take: REPORT_PAGE_SIZE,
				include: {
					reporter: publicUserInclude,
					reported: publicUserInclude,
					reviewed_by: publicUserInclude,
				},
			}),
			getPrisma().messageReport.count({where: {status: 'OPEN'}}),
		]);

		return {
			reports: rows as unknown as MessageReportView[],
			open_count: openCount,
			more_results: rows.length === REPORT_PAGE_SIZE,
		};
	}

	@Authorized([Role.MOD])
	@Mutation(() => Boolean)
	async resolveMessageReport(
		@Ctx() context: GraphQLContext,
		@Arg('reportId') reportId: string,
		@Arg('action', () => ReportStatusSchema) action: ReportStatusSchema,
		@Arg('note', {nullable: true}) note?: string
	): Promise<boolean> {
		if (action === ReportStatusSchema.OPEN) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid action');
		}

		await getPrisma().messageReport.update({
			where: {id: reportId},
			data: {
				status: action as any,
				moderator_note: note ? note.slice(0, MAX_REPORT_REASON_LENGTH) : null,
				reviewed_at: new Date(),
				reviewed_by_id: context.user.id,
			},
		});

		return true;
	}
}
