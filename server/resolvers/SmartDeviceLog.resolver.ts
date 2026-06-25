import {Resolver, Query, Mutation, Arg, Ctx, Authorized, Int} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {SmartDeviceLog, LogSmartDeviceEventInput} from '../schemas/SmartDeviceLog.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {Role} from '../middlewares/auth';
import {logger} from '../services/logger';

/** Cap the stored debug blob so an abusive client can't bloat the table. */
const MAX_EXTRA_LENGTH = 4000;

/** Stringify a Prisma Json value back to a GraphQL string field (null-safe). */
function serializeExtra(extra: unknown): string | undefined {
	if (extra == null) return undefined;
	try {
		return typeof extra === 'string' ? extra : JSON.stringify(extra);
	} catch {
		return undefined;
	}
}

/** Parse the client's JSON-string `extra` into a Prisma Json value; fall back to a raw wrapper. */
function parseExtra(extra?: string | null): object | undefined {
	if (!extra) return undefined;
	const clipped = extra.length > MAX_EXTRA_LENGTH ? extra.slice(0, MAX_EXTRA_LENGTH) : extra;
	try {
		const parsed = JSON.parse(clipped);
		return parsed && typeof parsed === 'object' ? parsed : {value: parsed};
	} catch {
		return {raw: clipped};
	}
}

/**
 * Smart cube / BLE timer connection telemetry.
 *
 * `logSmartDeviceEvent` is intentionally unauthenticated — logged-out sessions still produce
 * useful disconnect data — so it attributes to the user only when a session exists. It is
 * fire-and-forget on the client and must never throw in a way that disrupts the BLE flow.
 *
 * `smartDeviceLogs` is admin-only and powers the debug view of who connected and why they dropped.
 */
@Resolver()
export class SmartDeviceLogResolver {
	@Mutation(() => Boolean)
	async logSmartDeviceEvent(
		@Arg('input', () => LogSmartDeviceEventInput) input: LogSmartDeviceEventInput,
		@Ctx() context: GraphQLContext
	): Promise<boolean> {
		try {
			if (!input.device_type || !input.platform || !input.event) {
				return false;
			}

			await context.prisma.smartDeviceLog.create({
				data: {
					user_email: context.user?.email ?? null,
					device_type: input.device_type,
					device_name: input.device_name ?? null,
					hardware_name: input.hardware_name ?? null,
					generation: input.generation ?? null,
					platform: input.platform,
					event: input.event,
					reason: input.reason ?? null,
					solve_count: input.solve_count ?? null,
					last_serial: input.last_serial ?? null,
					extra: parseExtra(input.extra) ?? undefined,
				},
			});

			// Also emit a one-line server log so it can be tailed live via `docker logs`
			// (grep for the [SmartCubeBLE] prefix), in addition to the persisted DB row.
			const device = [input.device_type, input.generation, input.hardware_name || input.device_name]
				.filter(Boolean)
				.join('/');
			logger.info(
				`[SmartCubeBLE] ${input.event}${input.reason ? ` (${input.reason})` : ''} | ${device} | ` +
					`user=${context.user?.email ?? 'anon'} | ${input.platform}` +
					`${input.last_serial != null ? ` | serial=${input.last_serial}` : ''}` +
					`${input.extra ? ` | ${input.extra}` : ''}`
			);

			return true;
		} catch (error) {
			// Telemetry must never break the connection flow — swallow and report failure.
			return false;
		}
	}

	@Authorized([Role.ADMIN])
	@Query(() => [SmartDeviceLog])
	async smartDeviceLogs(
		@Ctx() context: GraphQLContext,
		@Arg('deviceType', {nullable: true}) deviceType?: string,
		@Arg('reason', {nullable: true}) reason?: string,
		@Arg('event', {nullable: true}) event?: string,
		@Arg('userEmail', {nullable: true}) userEmail?: string,
		@Arg('limit', () => Int, {nullable: true}) limit?: number
	): Promise<SmartDeviceLog[]> {
		try {
			const take = Math.min(Math.max(limit ?? 100, 1), 500);

			const rows = await context.prisma.smartDeviceLog.findMany({
				where: {
					...(deviceType ? {device_type: deviceType} : {}),
					...(reason ? {reason} : {}),
					...(event ? {event} : {}),
					...(userEmail ? {user_email: {contains: userEmail, mode: 'insensitive'}} : {}),
				},
				orderBy: {created_at: 'desc'},
				take,
			});

			return rows.map((r) => ({
				id: r.id,
				user_email: r.user_email ?? undefined,
				device_type: r.device_type,
				device_name: r.device_name ?? undefined,
				hardware_name: r.hardware_name ?? undefined,
				generation: r.generation ?? undefined,
				platform: r.platform,
				event: r.event,
				reason: r.reason ?? undefined,
				solve_count: r.solve_count ?? undefined,
				last_serial: r.last_serial ?? undefined,
				extra: serializeExtra(r.extra),
				created_at: r.created_at,
			}));
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch smart device logs');
		}
	}
}
