import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLUpload, FileUpload} from 'graphql-upload';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {SupportTicket, SupportTicketInput} from '../schemas/SupportTicket.schema';
import {SupportTicketMessage} from '../schemas/SupportTicketMessage.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getUserById, publicUserInclude} from '../models/user_account';
import {notifyAdminsOfSupportTicket, notifyAdminsOfTicketReply, notifyUserOfTicketReply} from '../services/admin_notification';
import {createRedisKey, getValueFromRedis, setKeyInRedis, RedisNamespace} from '../services/redis';
import {logger} from '../services/logger';
import {uploadSupportTicketAttachment} from '../models/support_ticket_attachment';

const MAX_ATTACHMENTS_PER_MESSAGE = 1;
const attachmentInclude = {attachments: {orderBy: {created_at: 'asc' as const}}};

const RATE_LIMIT_WINDOW_SECONDS = 5 * 60; // 5 minutes
const RATE_LIMIT_MAX = 5;
const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;

// suffix lets messages use a separate (more generous) counter from new-ticket creation
async function checkRateLimit(userId: string, max: number = RATE_LIMIT_MAX, suffix = ''): Promise<boolean> {
	try {
		const key = createRedisKey(RedisNamespace.SUPPORT_TICKET_RATE, suffix ? `${suffix}:${userId}` : userId);
		const current = await getValueFromRedis(key);
		const count = parseInt(current ?? '0', 10);
		if (count >= max) {
			return false;
		}
		await setKeyInRedis(key, String(count + 1), RATE_LIMIT_WINDOW_SECONDS);
		return true;
	} catch (e) {
		logger.error('[SupportTicket] Rate limit check failed', {userId, error: (e as any)?.message});
		// Fail-open: don't block user if Redis fails
		return true;
	}
}

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
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Konu ve mesaj bos olamaz');
		}
		if (subject.length > MAX_SUBJECT_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `Konu ${MAX_SUBJECT_LENGTH} karakteri gecemez`);
		}
		if (message.length > MAX_MESSAGE_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `Mesaj ${MAX_MESSAGE_LENGTH} karakteri gecemez`);
		}

		const allowed = await checkRateLimit(user.id);
		if (!allowed) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla destek talebi gonderdin, biraz bekle');
		}

		const ticket = await prisma.supportTicket.create({
			data: {
				subject,
				message,
				created_by_id: user.id,
			},
		});

		// Notify admins — don't block ticket creation if notification fails
		notifyAdminsOfSupportTicket(user as any, subject).catch((e) => {
			logger.error('[SupportTicket] Admin notification failed', {ticketId: ticket.id, error: (e as any)?.message});
		});

		return ticket as SupportTicket;
	}

	@Authorized([Role.MOD])
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
			include: {
				created_by: publicUserInclude,
				messages: {
					include: {sender: publicUserInclude, ...attachmentInclude},
					orderBy: {created_at: 'asc'},
				},
			},
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
			include: {
				created_by: publicUserInclude,
				messages: {
					include: {sender: publicUserInclude, ...attachmentInclude},
					orderBy: {created_at: 'asc'},
				},
			},
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
			include: {
				created_by: publicUserInclude,
				messages: {
					include: {sender: publicUserInclude, ...attachmentInclude},
					orderBy: {created_at: 'asc'},
				},
			},
		});

		if (!ticket) return null;

		const isAdminOrMod = (user as any).admin || (user as any).mod;
		if (ticket.created_by_id !== user.id && !isAdminOrMod) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Bu destek talebine erisim yetkin yok');
		}

		return ticket as any;
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
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla mesaj gonderdin, biraz bekle');
		}

		const trimmed = (body || '').trim();
		if (trimmed.length > MAX_MESSAGE_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `Mesaj ${MAX_MESSAGE_LENGTH} karakteri gecemez`);
		}

		const ticket = await prisma.supportTicket.findUnique({
			where: {id: ticketId},
			include: {created_by: true},
		});
		if (!ticket) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Destek talebi bulunamadi');
		}
		if (ticket.resolved_at) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Cozulmus talebe yeni mesaj yazilamaz');
		}

		const isAdminOrMod = (user as any).admin || (user as any).mod;
		const isOwner = ticket.created_by_id === user.id;
		if (!isOwner && !isAdminOrMod) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Bu destek talebine yanit yazma yetkin yok');
		}

		// Only admin/mod can upload attachments. If user provides array, silently ignore.
		const effectiveAttachments = isAdminOrMod ? (attachments || []) : [];

		if (effectiveAttachments.length > MAX_ATTACHMENTS_PER_MESSAGE) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `En fazla ${MAX_ATTACHMENTS_PER_MESSAGE} dosya eklenebilir`);
		}

		// Body and attachments cannot both be empty
		if (!trimmed && effectiveAttachments.length === 0) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Mesaj bos olamaz');
		}

		const message = await prisma.supportTicketMessage.create({
			data: {
				ticket_id: ticketId,
				sender_id: user.id,
				body: trimmed,
				is_admin: !!isAdminOrMod,
			},
		});

		// Attachment upload — if any fails, rollback message and uploaded files
		if (effectiveAttachments.length > 0) {
			try {
				for (const filePromise of effectiveAttachments) {
					const file = await filePromise;
					await uploadSupportTicketAttachment(message.id, file.filename, file.createReadStream, file.mimetype);
				}
			} catch (e) {
				logger.error('[SupportTicket] Attachment upload failed, rolling back message', {
					messageId: message.id,
					error: (e as any)?.message,
				});
				await prisma.supportTicketMessage.delete({where: {id: message.id}}).catch(() => undefined);
				throw new GraphQLError(ErrorCode.BAD_INPUT, (e as any)?.message || 'Dosya yuklenemedi');
			}
		}

		const finalMessage = await prisma.supportTicketMessage.findUnique({
			where: {id: message.id},
			include: {sender: publicUserInclude, ...attachmentInclude},
		});

		// Notification — don't block message creation if notification fails
		if (isAdminOrMod) {
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

	@Authorized([Role.MOD])
	@Mutation(() => SupportTicket)
	async resolveSupportTicket(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<SupportTicket> {
		const {prisma} = context;

		const ticket = await prisma.supportTicket.findUnique({where: {id}});
		if (!ticket) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Destek talebi bulunamadi');
		}

		const updated = await prisma.supportTicket.update({
			where: {id},
			data: {resolved_at: new Date()},
			include: {created_by: publicUserInclude},
		});

		return updated as any;
	}
}
