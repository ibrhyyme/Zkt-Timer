import { Resolver, Query, Mutation, Arg, Ctx, Authorized } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { OllcpStatType, OllcpStatInput } from '../schemas/OllcpStat.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';

/**
 * Per-user OLLCP recognition accuracy (correct/total per case = algId). Stored server-side so the
 * user's two devices share one tally. Recording increments atomically; merge sums device-local data.
 */
@Resolver()
export class OllcpStatResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [OllcpStatType])
	async myOllcpStats(@Ctx() context: GraphQLContext): Promise<OllcpStatType[]> {
		try {
			return await context.prisma.ollcpStat.findMany({
				where: { user_id: context.user.id },
				select: { alg_id: true, correct: true, total: true },
			});
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch OLLCP stats');
		}
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => OllcpStatType)
	async recordOllcpAttempt(
		@Arg('algId') algId: string,
		@Arg('correct') correct: boolean,
		@Ctx() context: GraphQLContext
	): Promise<OllcpStatType> {
		try {
			return await context.prisma.ollcpStat.upsert({
				where: { user_id_alg_id: { user_id: context.user.id, alg_id: algId } },
				create: { user_id: context.user.id, alg_id: algId, correct: correct ? 1 : 0, total: 1 },
				update: { correct: { increment: correct ? 1 : 0 }, total: { increment: 1 } },
				select: { alg_id: true, correct: true, total: true },
			});
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to record OLLCP attempt');
		}
	}

	/** One-time additive merge of a device's local accuracy into the server (counts are summed). */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async mergeOllcpStats(
		@Arg('entries', () => [OllcpStatInput]) entries: OllcpStatInput[],
		@Ctx() context: GraphQLContext
	): Promise<boolean> {
		try {
			for (const e of entries) {
				if (!e.alg_id || e.total <= 0) continue;
				await context.prisma.ollcpStat.upsert({
					where: { user_id_alg_id: { user_id: context.user.id, alg_id: e.alg_id } },
					create: { user_id: context.user.id, alg_id: e.alg_id, correct: e.correct, total: e.total },
					update: { correct: { increment: e.correct }, total: { increment: e.total } },
				});
			}
			return true;
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to merge OLLCP stats');
		}
	}
}
