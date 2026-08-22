import { Resolver, Query, Mutation, Arg, Ctx, Authorized, Int } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import {
	SmartCubeTelemetryInput,
	SmartCubeTelemetryResult,
	SmartCubeTelemetryRow,
	SmartCubeTelemetrySummary,
} from '../schemas/SmartCubeTelemetry.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';
import { getSiteConfig } from '../models/site_config';

/** Guards against a client bug turning one flush into an unbounded insert. */
const MAX_EVENTS_PER_CALL = 50;

const ALLOWED_SURFACES = new Set(['timer', 'room', 'trainer']);
const ALLOWED_EVENTS = new Set([
	'solve',
	'out_of_sync',
	'late_scramble_move',
	'scan_error',
	'disconnect',
]);

function clampInt(value: number | undefined | null, max: number): number | null {
	if (value == null || !Number.isFinite(value)) return null;
	const rounded = Math.round(value);
	if (rounded < 0) return 0;
	return rounded > max ? max : rounded;
}

/**
 * Field study of smart cube behaviour across models. Writes are gated on the
 * `smart_telemetry_enabled` site flag so the study can be opened for a few days and closed
 * again without a deploy.
 */
@Resolver()
export class SmartCubeTelemetryResolver {
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => SmartCubeTelemetryResult)
	async recordSmartCubeTelemetry(
		@Arg('events', () => [SmartCubeTelemetryInput]) events: SmartCubeTelemetryInput[],
		@Ctx() context: GraphQLContext
	): Promise<SmartCubeTelemetryResult> {
		try {
			const config = await getSiteConfig();
			if (!config?.smart_telemetry_enabled) {
				// Silently accept and drop: clients keep flushing on a schedule and should
				// not have to care whether the study is currently open.
				return { accepted: 0 };
			}

			const rows = (events || [])
				.slice(0, MAX_EVENTS_PER_CALL)
				.filter((e) => ALLOWED_SURFACES.has(e.surface) && ALLOWED_EVENTS.has(e.event_type))
				.map((e) => ({
					user_id: context.user.id,
					// Advertised names are short; truncate rather than reject so a firmware
					// with an unusual name still contributes a row.
					device_name: String(e.device_name || 'unknown').slice(0, 64),
					cube_type: String(e.cube_type || 'unknown').slice(0, 32),
					surface: e.surface,
					event_type: e.event_type,
					detection_source: e.detection_source ? String(e.detection_source).slice(0, 32) : null,
					detection_lag_ms: clampInt(e.detection_lag_ms, 600000),
					time_ms: clampInt(e.time_ms, 3600000),
					turn_count: clampInt(e.turn_count, 10000),
					battery_level: clampInt(e.battery_level, 100),
					time_correction_ms: clampInt(e.time_correction_ms, 600000),
					is_native: !!e.is_native,
					app_version: e.app_version ? String(e.app_version).slice(0, 32) : null,
				}));

			if (!rows.length) return { accepted: 0 };

			await context.prisma.smartCubeTelemetry.createMany({ data: rows });
			return { accepted: rows.length };
		} catch (error) {
			// Telemetry must never break a solve. Swallow and report zero.
			console.error('[SmartCubeTelemetry] record failed:', error);
			return { accepted: 0 };
		}
	}

	@Authorized([Role.ADMIN])
	@Query(() => [SmartCubeTelemetryRow])
	async smartCubeTelemetryRows(
		@Arg('limit', () => Int, { nullable: true }) limit: number,
		@Arg('cubeType', { nullable: true }) cubeType: string,
		@Arg('offset', () => Int, { nullable: true }) offset: number,
		@Ctx() context: GraphQLContext
	): Promise<SmartCubeTelemetryRow[]> {
		try {
			const rows = await context.prisma.smartCubeTelemetry.findMany({
				where: cubeType ? { cube_type: cubeType } : undefined,
				// Oldest first with a stable order: the CSV export pages through this, and a
				// newest-first order would reshuffle pages as new solves land mid-export.
				orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
				skip: Math.max(0, offset || 0),
				take: Math.min(limit || 500, 5000),
				include: { user: { select: { username: true } } },
			});

			return rows.map((r) => ({
				id: r.id,
				user_id: r.user_id || undefined,
				username: r.user?.username || undefined,
				device_name: r.device_name,
				cube_type: r.cube_type,
				surface: r.surface,
				event_type: r.event_type,
				detection_source: r.detection_source || undefined,
				detection_lag_ms: r.detection_lag_ms ?? undefined,
				time_ms: r.time_ms ?? undefined,
				turn_count: r.turn_count ?? undefined,
				battery_level: r.battery_level ?? undefined,
				time_correction_ms: r.time_correction_ms ?? undefined,
				is_native: r.is_native,
				app_version: r.app_version || undefined,
				created_at: r.created_at,
			}));
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch telemetry rows');
		}
	}

	/**
	 * Rollup per advertised device name. Computed in SQL rather than pulled into memory:
	 * a few days of a busy study is more rows than an admin page should ever hold.
	 */
	@Authorized([Role.ADMIN])
	@Query(() => [SmartCubeTelemetrySummary])
	async smartCubeTelemetrySummary(
		@Arg('days', () => Int, { nullable: true }) days: number,
		@Ctx() context: GraphQLContext
	): Promise<SmartCubeTelemetrySummary[]> {
		try {
			const windowDays = Math.min(Math.max(days || 7, 1), 90);

			const rows = await context.prisma.$queryRawUnsafe<any[]>(
				`
				SELECT
					cube_type,
					device_name,
					COUNT(*) FILTER (WHERE event_type = 'solve')                                   AS solves,
					COUNT(DISTINCT user_id)                                                        AS distinct_users,
					COUNT(*) FILTER (WHERE detection_source = 'tracker')                           AS via_tracker,
					COUNT(*) FILTER (WHERE detection_source = 'facelets-grace')                    AS via_grace,
					COUNT(*) FILTER (WHERE detection_source = 'facelets-poll')                     AS via_poll,
					COUNT(*) FILTER (WHERE event_type = 'out_of_sync')                             AS out_of_sync_events,
					COUNT(*) FILTER (WHERE event_type = 'late_scramble_move')                      AS late_scramble_events,
					COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY detection_lag_ms), 0)     AS median_lag_ms,
					COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY detection_lag_ms), 0)    AS p95_lag_ms,
					COALESCE(AVG(battery_level) FILTER (WHERE detection_source = 'tracker'), 0)     AS avg_battery_clean,
					COALESCE(AVG(battery_level) FILTER (WHERE detection_source LIKE 'facelets%'), 0) AS avg_battery_recovered,
					COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (
						ORDER BY time_correction_ms) FILTER (WHERE time_correction_ms > 0), 0)   AS median_time_correction_ms
				FROM smart_cube_telemetry
				WHERE created_at > NOW() - ($1 || ' days')::interval
				GROUP BY cube_type, device_name
				ORDER BY solves DESC
				`,
				String(windowDays)
			);

			return rows.map((r) => ({
				cube_type: r.cube_type,
				device_name: r.device_name,
				solves: Number(r.solves || 0),
				distinct_users: Number(r.distinct_users || 0),
				via_tracker: Number(r.via_tracker || 0),
				via_grace: Number(r.via_grace || 0),
				via_poll: Number(r.via_poll || 0),
				out_of_sync_events: Number(r.out_of_sync_events || 0),
				late_scramble_events: Number(r.late_scramble_events || 0),
				median_lag_ms: Math.round(Number(r.median_lag_ms || 0)),
				p95_lag_ms: Math.round(Number(r.p95_lag_ms || 0)),
				avg_battery_clean: Math.round(Number(r.avg_battery_clean || 0)),
				avg_battery_recovered: Math.round(Number(r.avg_battery_recovered || 0)),
				median_time_correction_ms: Math.round(Number(r.median_time_correction_ms || 0)),
			}));
		} catch (error) {
			console.error('[SmartCubeTelemetry] summary failed:', error);
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to build telemetry summary');
		}
	}
}
