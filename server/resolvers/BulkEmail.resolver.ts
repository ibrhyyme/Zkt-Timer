import { Arg, Authorized, Ctx, Mutation, Resolver } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import { getPrisma } from '../database';
import { SendBulkEmailInput, BulkEmailResult } from '../schemas/BulkEmail.schema';
import { sendBulkEmailDirect } from '../services/ses';
import { checkRateLimit } from '../services/rate_limit';
import { extractIp } from '../util/request';
import { logger } from '../services/logger';

// Bulk email reaches every user, so it is heavily throttled even for admins:
// guards against accidental double-submit and a compromised admin account flooding the list.
const MAX_SUBJECT_LENGTH = 200;
const MAX_CONTENT_LENGTH = 50000;

@Resolver()
export class BulkEmailResolver {
	@Authorized([Role.ADMIN])
	@Mutation(() => BulkEmailResult)
	async sendBulkEmail(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: SendBulkEmailInput
	): Promise<BulkEmailResult> {
		const { userIds, sendToAll, subject, content } = input;

		// Rate limit: 3 sends / 5 min per admin, plus a per-IP ceiling.
		const adminId = context.user.id;
		const userLimit = await checkRateLimit(`bulk_email:user:${adminId}`, 3, 300);
		if (!userLimit.allowed) {
			logger.warn('Bulk email rate limit (user)', { adminId, count: userLimit.count });
			throw new Error('Cok fazla toplu e-posta gonderimi. Lutfen birkac dakika bekleyin.');
		}
		const ip = extractIp(context.req);
		if (ip) {
			const ipLimit = await checkRateLimit(`bulk_email:ip:${ip}`, 5, 300);
			if (!ipLimit.allowed) {
				logger.warn('Bulk email rate limit (ip)', { ip, count: ipLimit.count });
				throw new Error('Cok fazla toplu e-posta gonderimi. Lutfen birkac dakika bekleyin.');
			}
		}

		if (!subject || !content) {
			throw new Error('Subject and content are required');
		}

		if (subject.length > MAX_SUBJECT_LENGTH) {
			throw new Error(`Subject must be at most ${MAX_SUBJECT_LENGTH} characters`);
		}

		if (content.length > MAX_CONTENT_LENGTH) {
			throw new Error(`Content must be at most ${MAX_CONTENT_LENGTH} characters`);
		}

		if (!sendToAll && (!userIds || userIds.length === 0)) {
			throw new Error('At least one recipient is required');
		}

		const users = await getPrisma().userAccount.findMany({
			where: sendToAll
				? { banned_forever: false }
				: { id: { in: userIds }, banned_forever: false },
		});

		if (users.length === 0) {
			return { successCount: 0, failCount: 0, skippedCount: 0 };
		}

		const { successCount, failCount } = await sendBulkEmailDirect(
			users as any[],
			subject,
			content
		);

		return { successCount, failCount, skippedCount: 0 };
	}
}
