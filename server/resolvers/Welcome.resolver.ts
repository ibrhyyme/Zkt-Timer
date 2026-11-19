import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {getPrisma} from '../database';
import {getSiteConfig} from '../models/site_config';
import {getParticipant, insertMessage} from '../models/messaging';
import {deliverMessage} from '../services/dm_delivery';
import {createI18nInstance} from '../i18n_server';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {Message} from '../schemas/Messaging.schema';
import {WelcomeStats} from '../schemas/Welcome.schema';
import {WELCOME_MESSAGE_KIND, WELCOME_THANKS_KIND, isAcquisitionSource} from '../../shared/welcome';

@Resolver()
export class WelcomeResolver {
	/**
	 * Records the member's answer to "where did you hear about us" and posts it into the
	 * thread as their reply, quoting the welcome message, so the admin reads it like any
	 * other message (with a push) and the stats get a clean value instead of free text.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Message)
	async answerWelcomeSurvey(
		@Ctx() context: GraphQLContext,
		@Arg('messageId') messageId: string,
		@Arg('source') source: string
	): Promise<Message> {
		const userId = context.user.id;

		if (!isAcquisitionSource(source)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid answer');
		}
		if (!(await getSiteConfig()).messaging_enabled) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Messaging is disabled');
		}

		const welcome = await getPrisma().message.findFirst({
			where: {id: messageId, kind: WELCOME_MESSAGE_KIND, deleted_at: null},
			select: {id: true, conversation_id: true, sender_id: true},
		});
		if (!welcome || welcome.sender_id === userId || !(await getParticipant(welcome.conversation_id, userId))) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Message not found');
		}

		// Answered once: the first answer is the one that counts.
		const claimed = await getPrisma().userAccount.updateMany({
			where: {id: userId, acquisition_source: null},
			data: {acquisition_source: source},
		});
		if (claimed.count === 0) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Already answered');
		}

		const settings = await getPrisma().setting.findUnique({where: {user_id: userId}, select: {locale: true}});
		const i18n = createI18nInstance(settings?.locale || 'en');
		const message = await insertMessage({
			conversationId: welcome.conversation_id,
			senderId: userId,
			body: i18n.t(`welcome_message.sources.${source}`) as string,
			replyToId: welcome.id,
		});

		const recipients = await getPrisma().conversationParticipant.findMany({
			where: {conversation_id: welcome.conversation_id, user_id: {not: userId}},
			select: {user_id: true, accepted_at: true},
		});
		await deliverMessage({
			message,
			recipients: recipients.map((r) => ({id: r.user_id, accepted: Boolean(r.accepted_at)})),
			senderUsername: context.user.username || 'ZKT Timer',
		});

		// The admin thanks them and the thread closes on their side: nothing more is
		// asked of them, and the admin can still write (which opens it again).
		const sender = await getPrisma().userAccount.findUnique({
			where: {id: welcome.sender_id},
			select: {username: true},
		});
		const thanks = await insertMessage({
			conversationId: welcome.conversation_id,
			senderId: welcome.sender_id,
			body: i18n.t('welcome_message.thanks') as string,
			kind: WELCOME_THANKS_KIND,
		});
		await getPrisma().conversationParticipant.updateMany({
			where: {conversation_id: welcome.conversation_id, user_id: userId},
			data: {reply_locked: true},
		});
		void deliverMessage({
			message: thanks,
			recipients: [{id: userId, accepted: true}],
			senderUsername: sender?.username || 'ZKT Timer',
		});

		return message as unknown as Message;
	}

	@Authorized([Role.ADMIN])
	@Query(() => WelcomeStats)
	async adminWelcomeStats(): Promise<WelcomeStats> {
		const prisma = getPrisma();
		const [sent, grouped] = await Promise.all([
			prisma.userAccount.count({where: {welcome_sent_at: {not: null}}}),
			prisma.userAccount.groupBy({
				by: ['acquisition_source'],
				where: {acquisition_source: {not: null}},
				_count: {_all: true},
			}),
		]);

		const sources = grouped
			.map((g) => ({source: g.acquisition_source as string, count: g._count._all}))
			.sort((a, b) => b.count - a.count);

		return {sent, answered: sources.reduce((sum, s) => sum + s.count, 0), sources};
	}
}
