import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLUpload, FileUpload} from 'graphql-upload';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {SupportTicket, SupportTicketInput} from '../schemas/SupportTicket.schema';
import {SupportTicketMessage} from '../schemas/SupportTicketMessage.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {publicUserInclude} from '../models/user_account';
import {notifyAdminsOfSupportTicket, notifyAdminsOfTicketReply, notifyUserOfTicketReply} from '../services/admin_notification';
import {createRedisKey, getValueFromRedis, setKeyInRedis, RedisNamespace} from '../services/redis';
import {logger} from '../services/logger';
import {uploadSupportTicketAttachment} from '../models/support_ticket_attachment';

const MAX_ATTACHMENTS_PER_MESSAGE = 1;
// Ceiling per conversation so a single ticket cannot be used as free file storage.
const MAX_ATTACHMENTS_PER_TICKET = 20;
const attachmentInclude = {attachments: {orderBy: {created_at: 'asc' as const}}};

const RATE_LIMIT_WINDOW_SECONDS = 5 * 60; // 5 minutes
const RATE_LIMIT_MAX = 5;
// Attachments get their own hourly budget — the per-message limit alone would let a
// user push 20 files x 25MB through the 5 minute message window.
const ATTACHMENT_RATE_WINDOW_SECONDS = 60 * 60;
const ATTACHMENT_RATE_MAX = 10;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

/**
 * User facing errors carry an `i18nKey` so the client renders them in the viewer's
 * language. The literal message stays as a readable server-side/logging fallback.
 */
function supportError(code: ErrorCode, i18nKey: string, fallback: string): GraphQLError {
	return new GraphQLError(code, fallback, {i18nKey});
}

// suffix lets messages use a separate (more generous) counter from new-ticket creation
async function checkRateLimit(
	userId: string,
	max: number = RATE_LIMIT_MAX,
	suffix = '',
	windowSeconds: number = RATE_LIMIT_WINDOW_SECONDS
): Promise<boolean> {
	try {
		const key = createRedisKey(RedisNamespace.SUPPORT_TICKET_RATE, suffix ? `${suffix}:${userId}` : userId);
		const current = await getValueFromRedis(key);
		const count = parseInt(current ?? '0', 10);
		if (count >= max) {
			return false;
		}
		await setKeyInRedis(key, String(count + 1), windowSeconds);
		return true;
	} catch (e) {
		logger.error('[SupportTicket] Rate limit check failed', {userId, error: (e as any)?.message});
		// Fail-open: don't block user if Redis fails
		return true;
	}
}

const ticketInclude = {
	created_by: publicUserInclude,
	messages: {
		include: {sender: publicUserInclude, ...attachmentInclude},
		orderBy: {created_at: 'asc' as const},
	},
};

@Resolver()
export class SupportTicketResolver {
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => SupportTicket)
	async createSupportTicket(
		@Ctx() context: GraphQLContext,
		@Arg('input', () => SupportTicketInput) input: SupportTicketInput
	): Promise<SupportTicket> {
		const {prisma, user} = context;

		const subject = (input.subject || '').trim();
		const message = (input.message || '').trim();

		if (!subject || !message) {
			throw supportError(ErrorCode.BAD_INPUT, 'support_error.empty_fields', 'Konu ve mesaj boş olamaz');
		}
		if (subject.length > MAX_SUBJECT_LENGTH) {
			throw supportError(
				ErrorCode.BAD_INPUT,
				'support_error.subject_too_long',
				`Konu ${MAX_SUBJECT_LENGTH} karakteri geçemez`
			);
		}
		if (message.length > MAX_MESSAGE_LENGTH) {
			throw supportError(
				ErrorCode.BAD_INPUT,
				'support_error.message_too_long',
				`Mesaj ${MAX_MESSAGE_LENGTH} karakteri geçemez`
			);
		}

		const allowed = await checkRateLimit(user.id);
		if (!allowed) {
			throw supportError(
				ErrorCode.BAD_INPUT,
				'support_error.ticket_rate_limited',
				'Çok fazla destek talebi gönderdin, biraz bekle'
			);
		}

		const ticket = await prisma.supportTicket.create({
			data: {
				subject,
				message,
				created_by_id: user.id,
				// The author has by definition seen their own opening message.
				user_read_at: new Date(),
			},
		});

		// Notify admins — don't block ticket creation if notification fails
		notifyAdminsOfSupportTicket(user as any, subject, ticket.id).catch((e) => {
			logger.error('[SupportTicket] Admin notification failed', {ticketId: ticket.id, error: (e as any)?.message});
		});

		return ticket as SupportTicket;
	}

	@Authorized([Role.ADMIN])
	@Query(() => [SupportTicket])
	async supportTickets(
		@Ctx() context: GraphQLContext,
		@Arg('resolved', () => Boolean, {nullable: true}) resolved?: boolean
	): Promise<SupportTicket[]> {
		const {prisma} = context;

		const where: any = {};
		if (resolved === true) {
			where.resolved_at = {not: null};
		} else if (resolved === false) {
			where.resolved_at = null;
		}

		const tickets = await prisma.supportTicket.findMany({
			where,
			include: ticketInclude,
			orderBy: {created_at: 'desc'},
		});

		return tickets as any;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [SupportTicket])
	async mySupportTickets(@Ctx() context: GraphQLContext): Promise<SupportTicket[]> {
		const {prisma, user} = context;

		const tickets = await prisma.supportTicket.findMany({
			where: {created_by_id: user.id},
			include: ticketInclude,
			orderBy: {created_at: 'desc'},
		});

		return tickets as any;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => SupportTicket, {nullable: true})
	async supportTicket(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<SupportTicket | null> {
		const {prisma, user} = context;

		const ticket = await prisma.supportTicket.findUnique({
			where: {id},
			include: ticketInclude,
		});

		if (!ticket) return null;

		// Support is admin-only; mods are competition-only and have no support access.
		const isAdmin = (user as any).admin;
		if (ticket.created_by_id !== user.id && !isAdmin) {
			throw supportError(ErrorCode.FORBIDDEN, 'support_error.no_access', 'Bu destek talebine erişim yetkin yok');
		}

		return ticket as any;
	}

	/**
	 * Stamps the viewer's side of the conversation as read. Called when the ticket is
	 * opened, so the unread badge reflects the account rather than the device.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => SupportTicket)
	async markSupportTicketRead(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<SupportTicket> {
		const {prisma, user} = context;

		const ticket = await prisma.supportTicket.findUnique({where: {id}});
		if (!ticket) {
			throw supportError(ErrorCode.NOT_FOUND, 'support_error.not_found', 'Destek talebi bulunamadı');
		}

		const isAdmin = (user as any).admin;
		const isOwner = ticket.created_by_id === user.id;
		if (!isOwner && !isAdmin) {
			throw supportError(ErrorCode.FORBIDDEN, 'support_error.no_access', 'Bu destek talebine erişim yetkin yok');
		}

		// An admin who owns the ticket is reading it as the user, so the owner side wins.
		const field = isOwner ? 'user_read_at' : 'admin_read_at';

		const updated = await prisma.supportTicket.update({
			where: {id},
			data: {[field]: new Date()},
		});

		return updated as any;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => SupportTicketMessage)
	async addSupportTicketMessage(
		@Ctx() context: GraphQLContext,
		@Arg('ticketId') ticketId: string,
		@Arg('body') body: string,
		@Arg('attachments', () => [GraphQLUpload], {nullable: true}) attachments?: Promise<FileUpload>[]
	): Promise<SupportTicketMessage> {
		const {prisma, user} = context;

		const allowed = await checkRateLimit(user.id, 20, 'msg');
		if (!allowed) {
			throw supportError(
				ErrorCode.BAD_INPUT,
				'support_error.message_rate_limited',
				'Çok fazla mesaj gönderdin, biraz bekle'
			);
		}

		const trimmed = (body || '').trim();
		if (trimmed.length > MAX_MESSAGE_LENGTH) {
			throw supportError(
				ErrorCode.BAD_INPUT,
				'support_error.message_too_long',
				`Mesaj ${MAX_MESSAGE_LENGTH} karakteri geçemez`
			);
		}

		const ticket = await prisma.supportTicket.findUnique({
			where: {id: ticketId},
			include: {created_by: true},
		});
		if (!ticket) {
			throw supportError(ErrorCode.NOT_FOUND, 'support_error.not_found', 'Destek talebi bulunamadı');
		}
		if (ticket.resolved_at) {
			throw supportError(
				ErrorCode.FORBIDDEN,
				'support_error.ticket_closed',
				'Çözülmüş talebe yeni mesaj yazılamaz'
			);
		}

		// Support is admin-only; mods are competition-only and have no support access.
		const isAdmin = (user as any).admin;
		const isOwner = ticket.created_by_id === user.id;
		if (!isOwner && !isAdmin) {
			throw supportError(
				ErrorCode.FORBIDDEN,
				'support_error.no_reply_access',
				'Bu destek talebine yanıt yazma yetkin yok'
			);
		}

		const incomingAttachments = attachments || [];

		if (incomingAttachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
			throw supportError(
				ErrorCode.BAD_INPUT,
				'support_error.too_many_attachments',
				`En fazla ${MAX_ATTACHMENTS_PER_MESSAGE} dosya eklenebilir`
			);
		}

		// Body and attachments cannot both be empty
		if (!trimmed && incomingAttachments.length === 0) {
			throw supportError(ErrorCode.BAD_INPUT, 'support_error.empty_message', 'Mesaj boş olamaz');
		}

		if (incomingAttachments.length > 0 && !isAdmin) {
			// Abuse guards apply to reporters only; staff needs to be able to answer freely.
			const attachmentAllowed = await checkRateLimit(
				user.id,
				ATTACHMENT_RATE_MAX,
				'att',
				ATTACHMENT_RATE_WINDOW_SECONDS
			);
			if (!attachmentAllowed) {
				throw supportError(
					ErrorCode.BAD_INPUT,
					'support_error.attachment_rate_limited',
					'Çok fazla dosya yükledin, biraz bekle'
				);
			}

			const ticketAttachmentCount = await prisma.supportTicketAttachment.count({
				where: {message: {ticket_id: ticketId}},
			});
			if (ticketAttachmentCount + incomingAttachments.length > MAX_ATTACHMENTS_PER_TICKET) {
				throw supportError(
					ErrorCode.BAD_INPUT,
					'support_error.ticket_attachment_limit',
					`Bu talepte en fazla ${MAX_ATTACHMENTS_PER_TICKET} dosya olabilir`
				);
			}
		}

		const message = await prisma.supportTicketMessage.create({
			data: {
				ticket_id: ticketId,
				sender_id: user.id,
				body: trimmed,
				// An admin writing on their own ticket is speaking as the reporter, not as
				// staff — otherwise their messages land on the support side of the thread.
				is_admin: !!isAdmin && !isOwner,
			},
		});

		// Attachment upload — if any fails, rollback message and uploaded files
		if (incomingAttachments.length > 0) {
			try {
				for (const filePromise of incomingAttachments) {
					const file = await filePromise;
					await uploadSupportTicketAttachment(message.id, file.filename, file.createReadStream, file.mimetype);
				}
			} catch (e) {
				logger.error('[SupportTicket] Attachment upload failed, rolling back message', {
					messageId: message.id,
					error: (e as any)?.message,
				});
				await prisma.supportTicketMessage.delete({where: {id: message.id}}).catch(() => undefined);
				throw supportError(
					ErrorCode.BAD_INPUT,
					'support_error.attachment_failed',
					(e as any)?.message || 'Dosya yüklenemedi'
				);
			}
		}

		// Writing counts as reading your own side of the thread.
		await prisma.supportTicket
			.update({
				where: {id: ticketId},
				data: isOwner ? {user_read_at: new Date()} : {admin_read_at: new Date()},
			})
			.catch(() => undefined);

		const finalMessage = await prisma.supportTicketMessage.findUnique({
			where: {id: message.id},
			include: {sender: publicUserInclude, ...attachmentInclude},
		});

		// Notification — don't block message creation if notification fails
		if (isAdmin && !isOwner) {
			// Admin → user
			notifyUserOfTicketReply(ticket.created_by as any, user as any, ticket.subject, ticket.id).catch((e) => {
				logger.error('[SupportTicket] User notification failed', {ticketId, error: (e as any)?.message});
			});
		} else {
			// User → admins
			notifyAdminsOfTicketReply(user as any, ticket.subject, ticket.id).catch((e) => {
				logger.error('[SupportTicket] Admin reply notification failed', {ticketId, error: (e as any)?.message});
			});
		}

		return finalMessage as any;
	}

	/**
	 * Closing is available to the ticket owner too — someone who solved their own
	 * problem should not have to wait in the admin queue.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => SupportTicket)
	async resolveSupportTicket(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<SupportTicket> {
		const {prisma, user} = context;

		const ticket = await prisma.supportTicket.findUnique({where: {id}});
		if (!ticket) {
			throw supportError(ErrorCode.NOT_FOUND, 'support_error.not_found', 'Destek talebi bulunamadı');
		}

		const isAdmin = (user as any).admin;
		if (ticket.created_by_id !== user.id && !isAdmin) {
			throw supportError(ErrorCode.FORBIDDEN, 'support_error.no_access', 'Bu destek talebine erişim yetkin yok');
		}

		const updated = await prisma.supportTicket.update({
			where: {id},
			data: {resolved_at: new Date()},
			include: {created_by: publicUserInclude},
		});

		return updated as any;
	}

	/**
	 * Reopens a closed ticket instead of forcing a brand new one, so the history the
	 * conversation already carries stays attached to the problem.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => SupportTicket)
	async reopenSupportTicket(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<SupportTicket> {
		const {prisma, user} = context;

		const ticket = await prisma.supportTicket.findUnique({where: {id}});
		if (!ticket) {
			throw supportError(ErrorCode.NOT_FOUND, 'support_error.not_found', 'Destek talebi bulunamadı');
		}

		const isAdmin = (user as any).admin;
		const isOwner = ticket.created_by_id === user.id;
		if (!isOwner && !isAdmin) {
			throw supportError(ErrorCode.FORBIDDEN, 'support_error.no_access', 'Bu destek talebine erişim yetkin yok');
		}

		if (!ticket.resolved_at) {
			return ticket as any;
		}

		// Reopening is a ticket-creation-shaped action; rate limit it like one so a
		// closed ticket cannot be flapped open and closed to spam admin notifications.
		const allowed = await checkRateLimit(user.id, RATE_LIMIT_MAX, 'reopen');
		if (!allowed) {
			throw supportError(
				ErrorCode.BAD_INPUT,
				'support_error.ticket_rate_limited',
				'Çok fazla destek talebi gönderdin, biraz bekle'
			);
		}

		const updated = await prisma.supportTicket.update({
			where: {id},
			data: {resolved_at: null},
			include: {created_by: publicUserInclude},
		});

		if (!isAdmin) {
			notifyAdminsOfTicketReply(user as any, ticket.subject, ticket.id).catch((e) => {
				logger.error('[SupportTicket] Reopen notification failed', {ticketId: id, error: (e as any)?.message});
			});
		}

		return updated as any;
	}
}
