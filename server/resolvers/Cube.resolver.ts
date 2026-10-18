import { Arg, Authorized, Ctx, FieldResolver, Int, Mutation, Query, Resolver, Root } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { isPro, isProEnabled } from '../lib/pro';
import { logger } from '../services/logger';
import {
	AdminCubeCalibrationRow,
	AdminCubeCalibrationSummary,
	Cube,
	CubeCalibration,
	CubeCalibrationInput,
	CubeInput,
	CubeMain,
	CubeUpdateInput,
	MyCubeState,
	SolveCube,
} from '../schemas/Cube.schema';
import { Solve } from '../schemas/Solve.schema';
import {
	brandFromBleName,
	calibrationErrorKey,
	calibrationText,
	checkCalibration,
	checkCubeCreate,
	checkCubePuzzle,
	checkCubeUpdate,
	checkSmartCubeIdentity,
	clampSetAt,
	CUBE_ERROR_KEYS,
	CubeErrorKey,
	isDistinctiveBleName,
	MAX_CUBES_PER_USER,
	smartCubeDefaultName,
} from '../util/cube_validation';
import {
	CUBE_CALIBRATION_SELECT,
	CUBE_SELECT,
	countCubes,
	ensureMainForNewCube,
	getCubeForUser,
	getMyCubeState,
} from '../models/cube';
import { isBuiltinPuzzleKey } from '../../shared/cube_puzzle';
import {
	CALIBRATION_LIMITS,
	deriveThresholdsFromRow,
	isCalibrationPlatform,
	isNoisy,
} from '../../shared/magnet_calibration';

/**
 * My Cubes (design .feedback/designs/magnet-cubes.md, section 3).
 *
 * Open to every signed-in user (owner decision Q1). Magnet calibration is Pro, checked inside
 * saveCubeCalibration rather than with Role.PRO: that role leaves out admins, who use the
 * Magnet Timer without a subscription (same rule as client/lib/magnet-start-access.ts).
 *
 * Errors carry `extensions.i18nKey` (cube_errors.*) so the client shows a sentence, not a code.
 */

function cubeError(key: CubeErrorKey, code: ErrorCode = ErrorCode.BAD_INPUT, extra?: Record<string, unknown>) {
	return new GraphQLError(code, `Cube: ${key}`, { i18nKey: CUBE_ERROR_KEYS[key], ...(extra || {}) });
}

/** The caller's custom cube type ids, fetched only when a puzzle key is not a built-in one. */
async function customTypeIdsFor(context: GraphQLContext, puzzle: unknown): Promise<Set<string>> {
	if (typeof puzzle !== 'string' || isBuiltinPuzzleKey(puzzle)) return new Set();
	const rows = await context.prisma.customCubeType.findMany({
		where: { user_id: context.user.id },
		select: { id: true },
	});
	return new Set(rows.map((r) => r.id));
}

async function requireOwnCube(context: GraphQLContext, id: string) {
	const cube = typeof id === 'string' && id
		? await context.prisma.cube.findFirst({ where: { id, user_id: context.user.id }, select: CUBE_SELECT })
		: null;
	if (!cube) throw cubeError('notFound', ErrorCode.NOT_FOUND);
	return cube;
}

async function cubeResponse(context: GraphQLContext, id: string) {
	const cube = await getCubeForUser(context.prisma, context.user.id, id);
	if (!cube) throw cubeError('notFound', ErrorCode.NOT_FOUND);
	return cube;
}

/** Whether the caller may use the Magnet Timer (and so calibrate): Pro, Premium or admin. */
export function canCalibrate(user: GraphQLContext['user']): boolean {
	return !isProEnabled() || isPro(user) || !!user?.admin;
}

const round1 = (n: unknown) => Math.round(Number(n || 0) * 10) / 10;

@Resolver()
export class CubeResolver {
	/** Cubes (archived included), mains, own calibrations and usage. One request at launch. */
	@Authorized()
	@Query(() => MyCubeState)
	async myCubeState(@Ctx() context: GraphQLContext) {
		return getMyCubeState(context.prisma, context.user.id);
	}

	@Authorized()
	@Mutation(() => Cube)
	async createCube(@Ctx() context: GraphQLContext, @Arg('input', () => CubeInput) input: CubeInput) {
		const { prisma, user } = context;
		const checked = checkCubeCreate(input, await customTypeIdsFor(context, input?.puzzle));
		if (checked.ok === false) throw cubeError(checked.error);
		const fields = checked.value;

		// A create sent twice (offline retry, double tap) makes one cube.
		if (fields.id) {
			const existing = await prisma.cube.findUnique({ where: { id: fields.id }, select: { user_id: true } });
			if (existing) {
				if (existing.user_id !== user.id) throw cubeError('id');
				return cubeResponse(context, fields.id);
			}
		}

		if ((await countCubes(prisma, user.id)) >= MAX_CUBES_PER_USER) throw cubeError('limit');

		let created;
		try {
			created = await prisma.cube.create({
				data: {
					...(fields.id ? { id: fields.id } : {}),
					user_id: user.id,
					puzzle: fields.puzzle,
					name: fields.name,
					brand: fields.brand,
					is_smart: fields.is_smart,
				},
				select: { id: true },
			});
		} catch (error: any) {
			if (error?.code === 'P2002' && fields.id) {
				const raced = await prisma.cube.findFirst({ where: { id: fields.id, user_id: user.id }, select: { id: true } });
				if (raced) return cubeResponse(context, fields.id);
			}
			throw error;
		}

		// The first cube of a puzzle becomes its main; the form's box makes any cube main, at
		// the client's time of the choice so the merge rule treats it like any other choice.
		const chosenAt = input?.make_main === true ? clampSetAt(input.set_at ?? new Date()) || new Date() : null;
		await ensureMainForNewCube(prisma, user.id, fields.puzzle, created.id, chosenAt);

		return cubeResponse(context, created.id);
	}

	@Authorized()
	@Mutation(() => Cube)
	async updateCube(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string,
		@Arg('input', () => CubeUpdateInput) input: CubeUpdateInput
	) {
		const cube = await requireOwnCube(context, id);
		const checked = checkCubeUpdate(input || {});
		if (checked.ok === false) throw cubeError(checked.error);

		if (Object.keys(checked.value).length) {
			await context.prisma.cube.update({ where: { id: cube.id }, data: checked.value });
		}
		return cubeResponse(context, cube.id);
	}

	/** Archiving a main cube leaves its puzzle without a main (the user picks the next one). */
	@Authorized()
	@Mutation(() => Cube)
	async setCubeArchived(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string,
		@Arg('archived', () => Boolean) archived: boolean
	) {
		const { prisma, user } = context;
		const cube = await requireOwnCube(context, id);

		if (archived) {
			await prisma.$transaction([
				prisma.cube.update({ where: { id: cube.id }, data: { archived_at: cube.archived_at || new Date() } }),
				prisma.cubeMain.deleteMany({ where: { user_id: user.id, cube_id: cube.id } }),
			]);
		} else if (cube.archived_at) {
			await prisma.cube.update({ where: { id: cube.id }, data: { archived_at: null } });
		}
		return cubeResponse(context, cube.id);
	}

	/**
	 * Real delete, in one transaction: the cube's solves stay but lose the link, the smart
	 * device rows it was migrated from go too (so the migration script, run again, cannot bring
	 * it back; design 7.3), then the cube (mains and calibrations cascade).
	 */
	@Authorized()
	@Mutation(() => Boolean)
	async deleteCube(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const { prisma, user } = context;
		const cube = await requireOwnCube(context, id);
		const legacyIds = (cube.legacy_smart_device_ids || []).filter(Boolean);

		await prisma.$transaction([
			prisma.solve.updateMany({ where: { user_id: user.id, cube_id: cube.id }, data: { cube_id: null } }),
			...(legacyIds.length
				? [prisma.smartDevice.deleteMany({ where: { user_id: user.id, id: { in: legacyIds } } })]
				: []),
			prisma.cube.delete({ where: { id: cube.id } }),
		]);
		return true;
	}

	/**
	 * The newer choice wins (design 4.2): a `set_at` older than the stored one changes nothing
	 * and the stored choice comes back. `cube_id` null removes the main.
	 */
	@Authorized()
	@Mutation(() => CubeMain)
	async setMainCube(
		@Ctx() context: GraphQLContext,
		@Arg('puzzle') puzzle: string,
		@Arg('set_at') setAtInput: Date,
		@Arg('cube_id', () => String, { nullable: true }) cubeId?: string | null
	) {
		const { prisma, user } = context;
		const puzzleChecked = checkCubePuzzle(puzzle, await customTypeIdsFor(context, puzzle));
		if (puzzleChecked.ok === false) throw cubeError(puzzleChecked.error);
		const setAt = clampSetAt(setAtInput);
		if (!setAt) throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid set_at');

		const where = { user_id_puzzle: { user_id: user.id, puzzle } };
		const current = await prisma.cubeMain.findUnique({ where, select: { puzzle: true, cube_id: true, set_at: true } });
		if (current && current.set_at.getTime() >= setAt.getTime()) return current;

		if (!cubeId) {
			if (current) await prisma.cubeMain.deleteMany({ where: { user_id: user.id, puzzle } });
			return { puzzle, cube_id: null, set_at: setAt };
		}

		const cube = await requireOwnCube(context, cubeId);
		if (cube.puzzle !== puzzle) throw cubeError('wrongPuzzle');
		if (cube.archived_at) throw cubeError('archived');

		const write = () =>
			prisma.cubeMain.upsert({
				where,
				create: { user_id: user.id, puzzle, cube_id: cube.id, set_at: setAt },
				update: { cube_id: cube.id, set_at: setAt },
				select: { puzzle: true, cube_id: true, set_at: true },
			});
		try {
			return await write();
		} catch (error: any) {
			// Two devices choosing at once: the row now exists, the update path settles it.
			if (error?.code === 'P2002') return write();
			throw error;
		}
	}

	/**
	 * The cube a smart cube that just connected belongs to, created on first sight (one request
	 * instead of the old list + register pair). Matched by BLE id; then, for a name that carries
	 * a serial ("GANi3_F568"), by name, which follows a cube to the new BLE id an iOS reinstall
	 * or a browser gives it. Otherwise a new 3x3 smart cube.
	 */
	@Authorized()
	@Mutation(() => Cube)
	async ensureSmartCube(
		@Ctx() context: GraphQLContext,
		@Arg('ble_device_id') bleDeviceId: string,
		@Arg('ble_name', () => String, { nullable: true }) bleName?: string | null
	) {
		const { prisma, user } = context;
		const checked = checkSmartCubeIdentity(bleDeviceId, bleName);
		if (checked.ok === false) throw cubeError(checked.error);
		const identity = checked.value;

		const byBleId = await prisma.cube.findFirst({
			where: { user_id: user.id, ble_device_id: identity.bleDeviceId },
			select: { id: true },
		});
		if (byBleId) return cubeResponse(context, byBleId.id);

		if (isDistinctiveBleName(identity.bleName)) {
			const byName = await prisma.cube.findFirst({
				where: {
					user_id: user.id,
					is_smart: true,
					ble_name: { equals: identity.bleName, mode: 'insensitive' },
				},
				orderBy: [{ archived_at: { sort: 'asc', nulls: 'first' } }, { created_at: 'asc' }],
				select: { id: true },
			});
			if (byName) {
				try {
					await prisma.cube.update({ where: { id: byName.id }, data: { ble_device_id: identity.bleDeviceId } });
				} catch (error: any) {
					if (error?.code !== 'P2002') throw error;
				}
				return cubeResponse(context, byName.id);
			}
		}

		if ((await countCubes(prisma, user.id)) >= MAX_CUBES_PER_USER) throw cubeError('limit');

		let created;
		try {
			created = await prisma.cube.create({
				data: {
					user_id: user.id,
					puzzle: '333',
					name: smartCubeDefaultName(identity.bleName),
					brand: brandFromBleName(identity.bleName),
					is_smart: true,
					ble_device_id: identity.bleDeviceId,
					ble_name: identity.bleName,
				},
				select: { id: true },
			});
		} catch (error: any) {
			// The same cube connecting on two screens at once: one row, both get it.
			if (error?.code === 'P2002') {
				const raced = await prisma.cube.findFirst({
					where: { user_id: user.id, ble_device_id: identity.bleDeviceId },
					select: { id: true },
				});
				if (raced) return cubeResponse(context, raced.id);
			}
			throw error;
		}
		await ensureMainForNewCube(prisma, user.id, '333', created.id, null);
		return cubeResponse(context, created.id);
	}

	/**
	 * Upserts the calibration of (cube, platform, phone model). The newer measurement wins: an
	 * upload whose measured_at is not newer than the stored one changes nothing and the stored
	 * row comes back. Everything is re-checked here (design 6.5); the client is never trusted.
	 */
	@Authorized()
	@Mutation(() => CubeCalibration)
	async saveCubeCalibration(
		@Ctx() context: GraphQLContext,
		@Arg('input', () => CubeCalibrationInput) input: CubeCalibrationInput
	) {
		const { prisma, user } = context;
		if (!canCalibrate(user)) throw cubeError('proRequired', ErrorCode.FORBIDDEN);
		if (!input) throw cubeError('calibrationInvalid');

		const checked = checkCalibration(input);
		if (checked.ok === false) {
			throw cubeError(calibrationErrorKey(checked.reason), ErrorCode.BAD_INPUT, { reason: checked.reason });
		}

		const cube = await requireOwnCube(context, input.cube_id);
		if (cube.archived_at) throw cubeError('archived');

		const key = {
			cube_id_platform_device_model: {
				cube_id: cube.id,
				platform: checked.platform,
				device_model: checked.deviceModel,
			},
		};
		const existing = await prisma.cubeCalibration.findUnique({
			where: key,
			select: { ...CUBE_CALIBRATION_SELECT, user_id: true },
		});
		if (existing && existing.measured_at.getTime() >= checked.measuredAt.getTime()) {
			const { user_id, ...row } = existing;
			return row;
		}

		// Saves per user per day: rows touched in the last 24 h. Re-saving a row already counted
		// today is not a new one.
		const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		if (!existing || existing.updated_at <= dayAgo) {
			const today = await prisma.cubeCalibration.count({ where: { user_id: user.id, updated_at: { gt: dayAgo } } });
			if (today >= CALIBRATION_LIMITS.dailySavesPerUser) throw cubeError('calibrationDailyLimit');
		}

		const data = {
			user_id: user.id,
			os_version: calibrationText(input.os_version, 32),
			app_version: calibrationText(input.app_version, 32),
			sensor_name: calibrationText(input.sensor_name, 64),
			peak_ut: input.peak_ut,
			rest_ut: input.rest_ut ?? null,
			noise_ut: input.noise_ut,
			near_min_ut: input.near_min_ut,
			far_max_ut: input.far_max_ut,
			quality: input.quality,
			sample_count: input.sample_count,
			sweep_ms: input.sweep_ms,
			rate_hz: input.rate_hz,
			algo_version: input.algo_version,
			measured_at: checked.measuredAt,
		};

		const write = () =>
			prisma.cubeCalibration.upsert({
				where: key,
				create: { ...data, cube_id: cube.id, platform: checked.platform, device_model: checked.deviceModel },
				update: data,
				select: CUBE_CALIBRATION_SELECT,
			});
		try {
			return await write();
		} catch (error: any) {
			if (error?.code === 'P2002') return write();
			throw error;
		}
	}

	/** Removes one phone model's calibration of one of the caller's cubes. False when it was already gone. */
	@Authorized()
	@Mutation(() => Boolean)
	async deleteCubeCalibration(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const result = await context.prisma.cubeCalibration.deleteMany({
			where: { id: typeof id === 'string' ? id : '', user_id: context.user.id },
		});
		return result.count > 0;
	}

	/** Every stored calibration with what the current formula makes of it (design 6.6). Paged for CSV. */
	@Authorized([Role.ADMIN])
	@Query(() => [AdminCubeCalibrationRow])
	async adminCubeCalibrations(
		@Ctx() context: GraphQLContext,
		@Arg('limit', () => Int, { nullable: true }) limit?: number,
		@Arg('offset', () => Int, { nullable: true }) offset?: number,
		@Arg('username', () => String, { nullable: true }) username?: string,
		@Arg('puzzle', () => String, { nullable: true }) puzzle?: string,
		@Arg('platform', () => String, { nullable: true }) platform?: string,
		@Arg('deviceModel', () => String, { nullable: true }) deviceModel?: string
	): Promise<AdminCubeCalibrationRow[]> {
		const { prisma } = context;
		const where: any = {};
		if (platform) where.platform = platform;
		if (deviceModel) where.device_model = deviceModel;
		if (puzzle) where.cube = { puzzle };
		if (username) {
			// Case-insensitive at the database: a Turkish locale would lowercase "I" to a dotless i.
			where.user = { username: { contains: username, mode: 'insensitive' } };
		}

		const rows = await prisma.cubeCalibration.findMany({
			where: Object.keys(where).length ? where : undefined,
			// Stable order: the CSV export pages through this while rows may still arrive.
			orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
			skip: Math.max(0, offset || 0),
			take: Math.min(Math.max(limit || 500, 1), 5000),
			select: {
				...CUBE_CALIBRATION_SELECT,
				user_id: true,
				user: { select: { username: true, email: true } },
				cube: { select: { name: true, brand: true, puzzle: true } },
			},
		});

		const customPuzzles = [...new Set(rows.map((r) => r.cube?.puzzle).filter((p) => p && !isBuiltinPuzzleKey(p)))];
		const customNames = new Map<string, string>();
		if (customPuzzles.length) {
			const types = await prisma.customCubeType.findMany({
				where: { id: { in: customPuzzles } },
				select: { id: true, name: true },
			});
			for (const type of types) customNames.set(type.id, type.name);
		}

		return rows.map((r) => {
			const current = deriveThresholdsFromRow(r);
			return {
				id: r.id,
				user_id: r.user_id,
				username: r.user?.username || undefined,
				email: r.user?.email || undefined,
				cube_id: r.cube_id,
				cube_name: r.cube?.name || '',
				cube_brand: r.cube?.brand || undefined,
				puzzle: r.cube?.puzzle || '',
				puzzle_name: (r.cube?.puzzle && customNames.get(r.cube.puzzle)) || undefined,
				platform: r.platform,
				device_model: r.device_model,
				os_version: r.os_version || undefined,
				app_version: r.app_version || undefined,
				sensor_name: r.sensor_name || undefined,
				peak_ut: r.peak_ut,
				rest_ut: r.rest_ut ?? undefined,
				noise_ut: r.noise_ut,
				near_min_ut: r.near_min_ut,
				far_max_ut: r.far_max_ut,
				quality: r.quality,
				current_near_min_ut: current ? round1(current.nearMin) : undefined,
				current_far_max_ut: current ? round1(current.farMax) : undefined,
				current_quality: current?.quality,
				noisy: isCalibrationPlatform(r.platform) ? isNoisy(r.noise_ut, r.platform) : false,
				sample_count: r.sample_count,
				sweep_ms: r.sweep_ms,
				rate_hz: r.rate_hz,
				algo_version: r.algo_version,
				measured_at: r.measured_at,
				created_at: r.created_at,
				updated_at: r.updated_at,
			};
		});
	}

	/**
	 * Rollup per (puzzle, platform, phone model), computed in SQL, joined with the magnet field
	 * study grouped the same way (MagnetTelemetry.cube_puzzle).
	 */
	@Authorized([Role.ADMIN])
	@Query(() => [AdminCubeCalibrationSummary])
	async adminCubeCalibrationSummary(
		@Ctx() context: GraphQLContext,
		@Arg('days', () => Int, { nullable: true }) days?: number
	): Promise<AdminCubeCalibrationSummary[]> {
		const windowDays = String(Math.min(Math.max(days || 365, 1), 3650));
		try {
			const [calibrations, telemetry] = await Promise.all([
				context.prisma.$queryRawUnsafe<any[]>(
					`
					SELECT
						c.puzzle                                                                        AS puzzle,
						cc.platform                                                                     AS platform,
						cc.device_model                                                                 AS device_model,
						COUNT(*)                                                                        AS calibrations,
						COUNT(DISTINCT cc.user_id)                                                      AS distinct_users,
						COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cc.rest_ut)
							FILTER (WHERE cc.rest_ut IS NOT NULL), 0)                                   AS median_rest_ut,
						COALESCE(PERCENTILE_CONT(0.1) WITHIN GROUP (ORDER BY cc.rest_ut)
							FILTER (WHERE cc.rest_ut IS NOT NULL), 0)                                   AS p10_rest_ut,
						COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cc.peak_ut), 0)            AS median_peak_ut,
						COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cc.noise_ut), 0)           AS median_noise_ut,
						COALESCE(AVG(CASE WHEN cc.quality = 'weak' THEN 1.0 ELSE 0.0 END), 0)           AS weak_ratio
					FROM cube_calibration cc
					JOIN cube c ON c.id = cc.cube_id
					WHERE cc.updated_at > NOW() - ($1 || ' days')::interval
					GROUP BY c.puzzle, cc.platform, cc.device_model
					ORDER BY calibrations DESC, c.puzzle, cc.device_model
					`,
					windowDays
				),
				context.prisma.$queryRawUnsafe<any[]>(
					`
					SELECT
						cube_puzzle                                                                     AS puzzle,
						platform,
						device_model,
						COUNT(*) FILTER (WHERE event_type = 'near' AND detail IS NULL)                  AS placements,
						COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY delta_ut)
							FILTER (WHERE event_type = 'near' AND detail IS NULL), 0)                   AS median_near_ut,
						COUNT(*) FILTER (WHERE event_type = 'lift')                                     AS lifts,
						COUNT(*) FILTER (WHERE event_type = 'reject')                                   AS rejects
					FROM magnet_telemetry
					WHERE cube_puzzle IS NOT NULL AND created_at > NOW() - ($1 || ' days')::interval
					GROUP BY cube_puzzle, platform, device_model
					`,
					windowDays
				),
			]);

			const groupKey = (r: any) => `${r.puzzle}|${r.platform}|${r.device_model}`;
			const study = new Map<string, any>();
			for (const r of telemetry) study.set(groupKey(r), r);

			return calibrations.map((r) => {
				const t = study.get(groupKey(r));
				return {
					puzzle: r.puzzle,
					platform: r.platform,
					device_model: r.device_model,
					calibrations: Number(r.calibrations || 0),
					distinct_users: Number(r.distinct_users || 0),
					median_rest_ut: round1(r.median_rest_ut),
					p10_rest_ut: round1(r.p10_rest_ut),
					median_peak_ut: round1(r.median_peak_ut),
					median_noise_ut: Math.round(Number(r.median_noise_ut || 0) * 100) / 100,
					weak_ratio: Math.round(Number(r.weak_ratio || 0) * 1000) / 1000,
					telemetry_placements: Number(t?.placements || 0),
					telemetry_median_near_ut: round1(t?.median_near_ut),
					telemetry_lifts: Number(t?.lifts || 0),
					telemetry_rejects: Number(t?.rejects || 0),
				};
			});
		} catch (error) {
			logger.error('[CubeCalibration] summary failed', { error });
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to build cube calibration summary');
		}
	}
}

/**
 * Solve.cube: the cube's name and kind on a single solve view (share code, profile, someone
 * else's solve). One lookup per solve, so list fragments must not ask for it; a user's own
 * solves name their cube from the local cube list instead (design 9.4).
 */
@Resolver(() => Solve)
export class SolveCubeResolver {
	@FieldResolver(() => SolveCube, { nullable: true })
	async cube(@Root() solve: Solve, @Ctx() context: GraphQLContext): Promise<SolveCube | null> {
		if (!solve?.cube_id) return null;
		const cube = await context.prisma.cube.findUnique({
			where: { id: solve.cube_id },
			select: { id: true, name: true, brand: true, puzzle: true, is_smart: true, user_id: true },
		});
		// The column has no foreign key: only the solve owner's own cube is ever named.
		if (!cube || (solve.user_id && cube.user_id !== solve.user_id)) return null;
		return { id: cube.id, name: cube.name, brand: cube.brand || undefined, puzzle: cube.puzzle, is_smart: cube.is_smart };
	}
}
