import { Resolver, Query, Mutation, Arg, Ctx, Authorized, Int } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import {
	MagnetTelemetryInput,
	MagnetTelemetryResult,
	MagnetTelemetryRow,
	MagnetTelemetrySummary,
} from '../schemas/MagnetTelemetry.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';
import { getSiteConfig } from '../models/site_config';
import {
	applySampleQuota,
	MAX_SAMPLE_WINDOWS_PER_DAY,
	sanitizeMagnetTelemetry,
} from '../util/magnet_telemetry';

/**
 * Field study of magnet lift-to-start across phone models. Writes are gated on the
 * `magnet_telemetry_enabled` site flag so the study can be opened and closed without a
 * deploy. Same shape as SmartCubeTelemetry.resolver.ts.
 */
@Resolver()
export class MagnetTelemetryResolver {
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => MagnetTelemetryResult)
	async recordMagnetTelemetry(
		@Arg('events', () => [MagnetTelemetryInput]) events: MagnetTelemetryInput[],
		@Ctx() context: GraphQLContext
	): Promise<MagnetTelemetryResult> {
		try {
			const config = await getSiteConfig();
			if (!config?.magnet_telemetry_enabled) {
				// Accept and drop. `enabled: false` tells the client to stop collecting until
				// the next launch instead of flushing into a closed study every minute.
				return { accepted: 0, enabled: false };
			}

			let rows = sanitizeMagnetTelemetry(events, context.user.id);
			if (!rows.length) return { accepted: 0, enabled: true };

			if (rows.some((row) => row.samples)) {
				// Only calls that carry a raw window pay for the count.
				const counted = await context.prisma.$queryRawUnsafe<{ n: number }[]>(
					`SELECT COUNT(*)::int AS n FROM magnet_telemetry
					 WHERE user_id = $1 AND samples IS NOT NULL AND created_at > NOW() - interval '1 day'`,
					context.user.id
				);
				const used = Number(counted?.[0]?.n || 0);
				rows = applySampleQuota(rows, MAX_SAMPLE_WINDOWS_PER_DAY - used);
			}

			await context.prisma.magnetTelemetry.createMany({ data: rows as any });
			return { accepted: rows.length, enabled: true };
		} catch (error) {
			// Telemetry must never break a solve. Swallow and report zero.
			console.error('[MagnetTelemetry] record failed:', error);
			return { accepted: 0, enabled: true };
		}
	}

	@Authorized([Role.ADMIN])
	@Query(() => [MagnetTelemetryRow])
	async magnetTelemetryRows(
		@Arg('limit', () => Int, { nullable: true }) limit: number,
		@Arg('offset', () => Int, { nullable: true }) offset: number,
		@Arg('username', { nullable: true }) username: string,
		@Arg('eventType', { nullable: true }) eventType: string,
		@Arg('deviceModel', { nullable: true }) deviceModel: string,
		@Arg('newestFirst', () => Boolean, { nullable: true }) newestFirst: boolean,
		@Ctx() context: GraphQLContext
	): Promise<MagnetTelemetryRow[]> {
		try {
			const where: any = {};
			if (eventType) where.event_type = eventType;
			if (deviceModel) where.device_model = deviceModel;
			if (username) {
				// Case-insensitive at the database, not in JS: a Turkish locale lowercases
				// "I" to a dotless i and would stop matching an ASCII username.
				where.user = { username: { contains: username, mode: 'insensitive' } };
			}

			const rows = await context.prisma.magnetTelemetry.findMany({
				where: Object.keys(where).length ? where : undefined,
				// Oldest first by default with a stable order: the CSV export pages through
				// this, and newest first would reshuffle pages as new rows land mid-export.
				orderBy: newestFirst
					? [{ created_at: 'desc' }, { id: 'desc' }]
					: [{ created_at: 'asc' }, { id: 'asc' }],
				skip: Math.max(0, offset || 0),
				take: Math.min(limit || 500, 5000),
				// Everything but the raw window, which can be ~10 KB a row.
				select: {
					id: true,
					platform: true,
					device_model: true,
					os_version: true,
					sensor_name: true,
					event_type: true,
					detail: true,
					delta_ut: true,
					latency_ms: true,
					rest_ms: true,
					approach_ms: true,
					sigma: true,
					rate_hz: true,
					reversed: true,
					app_version: true,
					created_at: true,
					user: { select: { username: true } },
				},
			});

			const ids = rows.map((r) => r.id);
			const withSamples = ids.length
				? await context.prisma.$queryRawUnsafe<{ id: string }[]>(
						'SELECT id FROM magnet_telemetry WHERE id = ANY($1::text[]) AND samples IS NOT NULL',
						ids
				  )
				: [];
			const sampled = new Set(withSamples.map((r) => r.id));

			return rows.map((r) => ({
				id: r.id,
				username: r.user?.username || undefined,
				platform: r.platform,
				device_model: r.device_model,
				os_version: r.os_version || undefined,
				sensor_name: r.sensor_name || undefined,
				event_type: r.event_type,
				detail: r.detail || undefined,
				delta_ut: r.delta_ut ?? undefined,
				latency_ms: r.latency_ms ?? undefined,
				rest_ms: r.rest_ms ?? undefined,
				approach_ms: r.approach_ms ?? undefined,
				sigma: r.sigma ?? undefined,
				rate_hz: r.rate_hz ?? undefined,
				reversed: r.reversed,
				has_samples: sampled.has(r.id),
				app_version: r.app_version || undefined,
				created_at: r.created_at,
			}));
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch magnet telemetry rows');
		}
	}

	/**
	 * One row's raw window as a test fixture (JSON string). Dropped into
	 * client/util/magnet-start/__tests__/fixtures it replays through the detector unchanged.
	 */
	@Authorized([Role.ADMIN])
	@Query(() => String, { nullable: true })
	async magnetTelemetrySamples(
		@Arg('id') id: string,
		@Ctx() context: GraphQLContext
	): Promise<string | null> {
		try {
			const row = await context.prisma.magnetTelemetry.findUnique({
				where: { id },
				select: { samples: true, device_model: true, event_type: true, detail: true },
			});
			if (!row?.samples) return null;
			const label = [row.event_type, row.detail].filter(Boolean).join(' ');
			return JSON.stringify({
				...(row.samples as any),
				source: `Zkt Timer field study, ${row.device_model}, ${label}`,
			});
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch magnet telemetry samples');
		}
	}

	/**
	 * Rollup per phone model, computed in SQL rather than pulled into memory: a study can
	 * outgrow anything an admin page should hold.
	 */
	@Authorized([Role.ADMIN])
	@Query(() => [MagnetTelemetrySummary])
	async magnetTelemetrySummary(
		@Arg('days', () => Int, { nullable: true }) days: number,
		@Ctx() context: GraphQLContext
	): Promise<MagnetTelemetrySummary[]> {
		try {
			const windowDays = Math.min(Math.max(days || 7, 1), 90);

			// Fresh placements are near rows without a detail: 'replaced' (the cube slid
			// along the edge) and 'resumed' (left at the hot spot through a stop) are not
			// someone putting the cube down.
			const rows = await context.prisma.$queryRawUnsafe<any[]>(
				`
				SELECT
					platform,
					device_model,
					MAX(sensor_name)                                                                         AS sensor_name,
					COUNT(DISTINCT user_id)                                                                  AS distinct_users,
					COUNT(*) FILTER (WHERE event_type = 'near' AND detail IS NULL)                           AS placements,
					COALESCE(MIN(delta_ut) FILTER (WHERE event_type = 'near' AND detail IS NULL), 0)         AS min_near_ut,
					COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_ut)
						FILTER (WHERE event_type = 'near' AND detail IS NULL), 0)                            AS median_near_ut,
					COUNT(*) FILTER (WHERE event_type = 'lift')                                              AS lifts,
					COUNT(*) FILTER (WHERE event_type = 'lift' AND detail LIKE 'start%')                     AS started,
					COUNT(*) FILTER (WHERE event_type = 'lift' AND detail LIKE 'none:%')                     AS refused,
					COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY latency_ms)
						FILTER (WHERE event_type = 'lift'), 0)                                               AS median_latency_ms,
					COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY latency_ms)
						FILTER (WHERE event_type = 'lift'), 0)                                               AS p95_latency_ms,
					COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY approach_ms)
						FILTER (WHERE event_type = 'near' AND approach_ms IS NOT NULL), 0)                   AS median_approach_ms,
					COUNT(*) FILTER (WHERE event_type = 'reject')                                            AS rejects,
					COUNT(*) FILTER (WHERE event_type = 'unsupported')                                       AS unsupported,
					COUNT(*) FILTER (WHERE event_type = 'hint' AND detail = 'unknown')                       AS unknown_hints,
					COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sigma)
						FILTER (WHERE event_type IN ('near', 'device') AND sigma IS NOT NULL), 0)            AS median_sigma,
					COALESCE(MAX(rate_hz) FILTER (WHERE event_type IN ('device', 'unsupported')), 0)         AS rate_hz
				FROM magnet_telemetry
				WHERE created_at > NOW() - ($1 || ' days')::interval
				GROUP BY platform, device_model
				ORDER BY placements DESC, lifts DESC
				`,
				String(windowDays)
			);

			const round1 = (n: unknown) => Math.round(Number(n || 0) * 10) / 10;
			return rows.map((r) => ({
				platform: r.platform,
				device_model: r.device_model,
				sensor_name: r.sensor_name || undefined,
				distinct_users: Number(r.distinct_users || 0),
				placements: Number(r.placements || 0),
				min_near_ut: round1(r.min_near_ut),
				median_near_ut: round1(r.median_near_ut),
				lifts: Number(r.lifts || 0),
				started: Number(r.started || 0),
				refused: Number(r.refused || 0),
				median_latency_ms: Math.round(Number(r.median_latency_ms || 0)),
				p95_latency_ms: Math.round(Number(r.p95_latency_ms || 0)),
				median_approach_ms: Math.round(Number(r.median_approach_ms || 0)),
				rejects: Number(r.rejects || 0),
				unsupported: Number(r.unsupported || 0),
				unknown_hints: Number(r.unknown_hints || 0),
				median_sigma: round1(r.median_sigma),
				rate_hz: round1(r.rate_hz),
			}));
		} catch (error) {
			console.error('[MagnetTelemetry] summary failed:', error);
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to build magnet telemetry summary');
		}
	}
}
