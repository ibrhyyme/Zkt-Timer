import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {getPrisma} from '../database';
import {ActiveUserRow, ActivityHeartbeatResult, AdminActiveUsersResult} from '../schemas/Activity.schema';
import {logger} from '../services/logger';
import {
	todayBoundsIstanbul,
	thisWeekBoundsIstanbul,
	thisMonthBoundsIstanbul,
	monthBoundsIstanbul,
	parseMonthYear,
	dateToMinuteBucket,
} from '../util/calendar_window';

const MINUTE_MS = 60 * 1000;

function currentMinuteBucket(): bigint {
	return BigInt(Math.floor(Date.now() / MINUTE_MS));
}

async function listAvailableMonths(): Promise<string[]> {
	const rows: Array<{ym: string}> = await getPrisma().$queryRawUnsafe(
		`SELECT DISTINCT to_char(to_timestamp(minute_bucket * 60) AT TIME ZONE 'Europe/Istanbul', 'YYYY-MM') AS ym
		 FROM user_activity_heartbeat
		 ORDER BY ym DESC
		 LIMIT 6`
	);
	return rows.map((r) => r.ym).filter(Boolean);
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
	@Query(() => AdminActiveUsersResult)
	async adminActiveUsers(
		@Arg('period') period: string,
		@Arg('monthYear', {nullable: true}) monthYear?: string,
	): Promise<AdminActiveUsersResult> {
		let start: Date;
		let end: Date;

		if (period === 'day') {
			({start, end} = todayBoundsIstanbul());
		} else if (period === 'week') {
			({start, end} = thisWeekBoundsIstanbul());
		} else if (period === 'month') {
			if (monthYear) {
				const parsed = parseMonthYear(monthYear);
				if (parsed) {
					({start, end} = monthBoundsIstanbul(parsed.year, parsed.month));
				} else {
					({start, end} = thisMonthBoundsIstanbul());
				}
			} else {
				({start, end} = thisMonthBoundsIstanbul());
			}
		} else {
			({start, end} = todayBoundsIstanbul());
		}

		const sinceBucket = dateToMinuteBucket(start);
		const untilBucket = dateToMinuteBucket(end);

		const prisma = getPrisma();

		const grouped = await prisma.userActivityHeartbeat.groupBy({
			by: ['user_id'],
			where: {minute_bucket: {gte: sinceBucket, lt: untilBucket}},
			_count: {minute_bucket: true},
			orderBy: {_count: {minute_bucket: 'desc'}},
			take: 200,
		});

		const available_months = period === 'month' ? await listAvailableMonths() : [];

		if (grouped.length === 0) {
			return {rows: [], total_active_users: 0, total_active_minutes: 0, available_months};
		}

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

		const rows: ActiveUserRow[] = grouped
			.map((g): ActiveUserRow | null => {
				const user = userMap.get(g.user_id);
				if (!user) return null;
				return {
					user: user as any,
					active_minutes: g._count.minute_bucket,
					last_seen_at: user.last_seen_at ?? undefined,
				};
			})
			.filter((r): r is ActiveUserRow => r !== null);

		const total_active_users = grouped.length;
		const total_active_minutes = grouped.reduce((sum, g) => sum + g._count.minute_bucket, 0);

		return {rows, total_active_users, total_active_minutes, available_months};
	}
}
