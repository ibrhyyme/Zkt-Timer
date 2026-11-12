import {Prisma} from '@prisma/client';
import {Arg, Authorized, Int, Query, Resolver} from 'type-graphql';
import {Role} from '../middlewares/auth';
import {getPrisma} from '../database';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {AdminGrowthReport, AdminProUserRow, GrowthBucket, GrowthCountry} from '../schemas/AdminReport.schema';
import {classifyMembership} from '../util/pro_membership';

type GrowthMetric = 'signups' | 'solves';

// created_at columns are Prisma's default `timestamp` holding UTC, so the Istanbul
// wall clock is two conversions away: UTC -> timestamptz -> local timestamp. Every
// bucket uses the Istanbul calendar, the same one the dashboard's "today" uses.
const USER_LOCAL = Prisma.sql`((u.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul')`;
const SOLVE_LOCAL = Prisma.sql`((s.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Istanbul')`;

// Timer solves only, the same filter as the dashboard's solve counters.
const TIMER_SOLVE = Prisma.sql`(s.trainer_name IS NULL OR s.trainer_name = '')`;

const COUNTRY_LIMIT = 15;

interface RawBucket {
	key: string;
	count: number;
	activated?: number;
	pro?: number;
}

function scopeFilter(local: Prisma.Sql, year?: number, month?: number): Prisma.Sql {
	const parts: Prisma.Sql[] = [];
	if (year) parts.push(Prisma.sql`EXTRACT(YEAR FROM ${local})::int = ${year}::int`);
	if (month) parts.push(Prisma.sql`EXTRACT(MONTH FROM ${local})::int = ${month}::int`);
	return parts.length === 0 ? Prisma.empty : Prisma.sql`AND ${Prisma.join(parts, ' AND ')}`;
}

function toBuckets(rows: RawBucket[], withCohort: boolean): GrowthBucket[] {
	return rows.map((r) => ({
		key: r.key,
		count: Number(r.count),
		activated: withCohort ? Number(r.activated ?? 0) : undefined,
		pro: withCohort ? Number(r.pro ?? 0) : undefined,
	}));
}

async function signupBuckets(format: 'YYYY-MM' | 'YYYY-MM-DD', scope: Prisma.Sql): Promise<GrowthBucket[]> {
	// "Activated" is any solve row on the server: every logged-in user writes solves
	// (sync-gate canWriteSync), so a Basic account counts too.
	const rows = await getPrisma().$queryRaw<RawBucket[]>`
		SELECT t.key,
			COUNT(*)::int AS count,
			COUNT(*) FILTER (WHERE t.activated)::int AS activated,
			COUNT(*) FILTER (WHERE t.pro)::int AS pro
		FROM (
			SELECT to_char(${USER_LOCAL}, ${format}) AS key,
				EXISTS (SELECT 1 FROM solve s WHERE s.user_id = u.id) AS activated,
				(u.is_pro OR u.is_premium) AS pro
			FROM user_account u
			WHERE TRUE ${scope}
		) t
		GROUP BY t.key
		ORDER BY t.key
	`;
	return toBuckets(rows, true);
}

async function solveBuckets(format: 'YYYY-MM' | 'YYYY-MM-DD', scope: Prisma.Sql): Promise<GrowthBucket[]> {
	const rows = await getPrisma().$queryRaw<RawBucket[]>`
		SELECT to_char(${SOLVE_LOCAL}, ${format}) AS key, COUNT(*)::int AS count
		FROM solve s
		WHERE ${TIMER_SOLVE} ${scope}
		GROUP BY 1
		ORDER BY 1
	`;
	return toBuckets(rows, false);
}

@Resolver()
export class AdminReportResolver {
	/**
	 * Monthly and daily growth for the admin dashboard. `months` covers all time and
	 * is the expensive part on the solve table, so the client fetches it once and
	 * passes includeMonths=false while the year/month selection changes.
	 */
	@Authorized([Role.ADMIN])
	@Query(() => AdminGrowthReport)
	async adminGrowthReport(
		@Arg('metric') metric: string,
		@Arg('year', () => Int, {nullable: true}) year?: number,
		@Arg('month', () => Int, {nullable: true}) month?: number,
		@Arg('includeMonths', {nullable: true, defaultValue: true}) includeMonths?: boolean,
	): Promise<AdminGrowthReport> {
		if (metric !== 'signups' && metric !== 'solves') {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Unknown metric');
		}
		if (year != null && (!Number.isInteger(year) || year < 2000 || year > 2100)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid year');
		}
		if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid month');
		}

		const m = metric as GrowthMetric;
		const y = year ?? undefined;
		const mo = month ?? undefined;
		const local = m === 'signups' ? USER_LOCAL : SOLVE_LOCAL;
		const buckets = m === 'signups' ? signupBuckets : solveBuckets;

		const [months, days, countryRows, totalRows] = await Promise.all([
			includeMonths === false ? Promise.resolve([] as GrowthBucket[]) : buckets('YYYY-MM', Prisma.empty),
			y && mo ? buckets('YYYY-MM-DD', scopeFilter(local, y, mo)) : Promise.resolve([] as GrowthBucket[]),
			m === 'signups'
				? getPrisma().$queryRaw<Array<{country: string; count: number}>>`
					SELECT COALESCE(NULLIF(u.join_country, ''), 'NONE') AS country, COUNT(*)::int AS count
					FROM user_account u
					WHERE TRUE ${scopeFilter(USER_LOCAL, y, mo)}
					GROUP BY 1
					ORDER BY 2 DESC, 1 ASC
					LIMIT ${COUNTRY_LIMIT}::int
				`
				: Promise.resolve([] as Array<{country: string; count: number}>),
			m === 'signups'
				? getPrisma().$queryRaw<Array<{total: number}>>`
					SELECT COUNT(*)::int AS total FROM user_account u WHERE TRUE ${scopeFilter(USER_LOCAL, y, mo)}
				`
				: Promise.resolve([] as Array<{total: number}>),
		]);

		const countries: GrowthCountry[] = countryRows.map((r) => ({country: r.country, count: Number(r.count)}));

		return {
			metric: m,
			months,
			days,
			countries,
			scope_total: Number(totalRows[0]?.total ?? 0),
		};
	}

	/**
	 * Every account holding Pro or Premium, classified by where it came from. The list
	 * is the same set the dashboard's Pro card counts (is_pro OR is_premium), which
	 * adminUserSearch's is_pro filter is not: Premium clears is_pro. It comes back whole
	 * so the page filters and counts without a round trip; at a few thousand members
	 * this should move to server-side paging.
	 */
	@Authorized([Role.ADMIN])
	@Query(() => [AdminProUserRow])
	async adminProUsers(): Promise<AdminProUserRow[]> {
		const users = await getPrisma().userAccount.findMany({
			where: {OR: [{is_pro: true}, {is_premium: true}]},
			select: {
				id: true,
				username: true,
				email: true,
				created_at: true,
				admin: true,
				mod: true,
				verified: true,
				banned_forever: true,
				banned_until: true,
				is_pro: true,
				is_premium: true,
				pro_expires_at: true,
				premium_expires_at: true,
				iap_platform: true,
				iap_product_id: true,
				iap_cancellation_at: true,
				iap_billing_issue_at: true,
				iap_paused_until: true,
				iap_latest_event_at: true,
				revenuecat_user_id: true,
				profile: {include: {pfp_image: true}},
				promo_code_redemptions: {
					select: {
						redeemed_at: true,
						promo_code: {select: {code: true, membership_type: true, duration_minutes: true}},
					},
				},
				competition_pro_gifts: {
					where: {status: 'granted'},
					select: {granted_at: true, pro_until: true},
				},
			},
			orderBy: {created_at: 'desc'},
		});

		const now = new Date();
		return users.map((u) => {
			const info = classifyMembership(
				{...u, redemptions: u.promo_code_redemptions, competition_gifts: u.competition_pro_gifts},
				now
			);
			const {promo_code_redemptions, competition_pro_gifts, ...user} = u;
			return {
				user: user as any,
				tier: info.tier,
				source: info.source,
				status: info.status,
				expires_at: info.expires_at ?? undefined,
				last_event_at: info.last_event_at ?? undefined,
				promo_code: info.promo_code ?? undefined,
			};
		});
	}
}
