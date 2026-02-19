import { Resolver, Mutation, Arg, Ctx } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { PushTokenResult, RegisterPushTokenInput } from '../schemas/PushToken.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';

@Resolver()
export class PushTokenResolver {

	@Mutation(() => PushTokenResult)
	async registerPushToken(
		@Arg('input') input: RegisterPushTokenInput,
		@Ctx() context: GraphQLContext
	): Promise<PushTokenResult> {
		if (!context.user) {
			throw new GraphQLError(ErrorCode.UNAUTHENTICATED);
		}

		try {
			const platform = input.platform as any;

			await context.prisma.pushToken.upsert({
				where: { token: input.token },
				create: {
					userId: context.user.id,
					token: input.token,
					platform,
				},
				update: {
					userId: context.user.id,
					platform,
					updatedAt: new Date(),
				},
			});

			return { success: true };
		} catch (error) {
			console.error('[Push] Failed to register token:', error);
			return { success: false };
		}
	}

	@Mutation(() => PushTokenResult)
	async unregisterPushToken(
		@Arg('token') token: string,
		@Ctx() context: GraphQLContext
	): Promise<PushTokenResult> {
		if (!context.user) {
			throw new GraphQLError(ErrorCode.UNAUTHENTICATED);
		}

		try {
			await context.prisma.pushToken.deleteMany({
				where: {
					token,
					userId: context.user.id,
				},
			});

			return { success: true };
		} catch (error) {
			console.error('[Push] Failed to unregister token:', error);
			return { success: false };
		}
	}
}
