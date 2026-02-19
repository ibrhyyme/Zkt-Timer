import { Arg, Authorized, Ctx, Mutation, Resolver } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import { getPrisma } from '../database';
import { SendBulkEmailInput, BulkEmailResult } from '../schemas/BulkEmail.schema';
import { sendBulkEmailDirect } from '../services/ses';

@Resolver()
export class BulkEmailResolver {
	@Authorized([Role.ADMIN])
	@Mutation(() => BulkEmailResult)
	async sendBulkEmail(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: SendBulkEmailInput
	): Promise<BulkEmailResult> {
		const { userIds, sendToAll, subject, content } = input;

		if (!subject || !content) {
			throw new Error('Subject and content are required');
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
