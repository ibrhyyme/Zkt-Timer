import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {getPrisma} from '../database';
import {ActiveUserRow, ActivityHeartbeatResult} from '../schemas/Activity.schema';
import {logger} from '../services/logger';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

function currentMinuteBucket(): bigint {
	return BigInt(Math.floor(Date.now() / MINUTE_MS));
}

function bucketAtMsAgo(msAgo: number): bigint {
	return BigInt(Math.floor((Date.now() - msAgo) / MINUTE_MS));
}

@Resolver()
export class ActivityResolver {
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ActivityHeartbeatResult)
	async recordActivityHeartbeat(@Ctx() context: GraphQLContext): Promise<ActivityHeartbeatResult> {
		const userId = context.user.id;
		const bucket = currentMinuteBucket();

		try {
			await getPrisma().userActivityHeartbeat.upsert({
				where: {
					user_id_minute_bucket: {
						user_id: userId,
						minute_bucket: bucket,
					},
				},
				create: {
					user_id: userId,
					minute_bucket: bucket,
				},
				update: {},
			});
		} catch (e) {
			logger.error('[Heartbeat] upsert failed', {userId, error: (e as any)?.message});
		}

		return {success: true};
	}

	@Authorized([Role.ADMIN])
	@Query(() => [ActiveUserRow])
	async adminActiveUsers(@Arg('period') period: string): Promise<ActiveUserRow[]> {
		// period: 'day' | 'week' | 'month'
		const now = Date.now();
		let msAgo: number;
		switch (period) {
			case 'day': msAgo = DAY_MS; break;
			case 'week': msAgo = 7 * DAY_MS; break;
			case 'month': msAgo = 30 * DAY_MS; break;
			default: msAgo = DAY_MS;
		}

		const sinceBucket = bucketAtMsAgo(msAgo);
		const sinceDate = new Date(now - msAgo);

		const prisma = getPrisma();

		// Distinct user_id'ler ve dakika sayilari
		const grouped = await prisma.userActivityHeartbeat.groupBy({
			by: ['user_id'],
			where: {minute_bucket: {gte: sinceBucket}},
			_count: {minute_bucket: true},
			orderBy: {_count: {minute_bucket: 'desc'}},
			take: 200,
		});

		if (grouped.length === 0) return [];

		const userIds = grouped.map((g) => g.user_id);
		const users = await prisma.userAccount.findMany({
			where: {id: {in: userIds}},
			select: {
				id: true,
				username: true,
				admin: true,
				mod: true,
				verified: true,
				is_pro: true,
				is_premium: true,
				banned_forever: true,
				banned_until: true,
				created_at: true,
				last_seen_at: true,
				profile: {
					include: {pfp_image: true},
				},
				integrations: {select: {id: true, service_name: true, wca_id: true}},
			},
		});

		const userMap = new Map(users.map((u) => [u.id, u]));

		return grouped
			.map((g) => {
				const user = userMap.get(g.user_id);
				if (!user) return null;
				return {
					user: user as any,
					active_minutes: g._count.minute_bucket,
					last_seen_at: user.last_seen_at && user.last_seen_at >= sinceDate ? user.last_seen_at : user.last_seen_at,
				};
			})
			.filter((r): r is ActiveUserRow => r !== null);
	}
}
