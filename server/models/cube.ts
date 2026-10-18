import type {PrismaClient} from '@prisma/client';
import {logger} from '../services/logger';
import {brandFromBleName, MAX_CUBES_PER_USER, smartCubeDefaultName} from '../util/cube_validation';

/**
 * Prisma access for My Cubes (Cube.resolver.ts). Counts come from one groupBy per request,
 * never one query per cube. Design: .feedback/designs/magnet-cubes.md section 3.
 */

type Prisma = Pick<PrismaClient, 'cube' | 'cubeMain' | 'cubeCalibration' | 'solve' | '$transaction'>;

/** Every Cube column the GraphQL type exposes. A column missing here comes back null (CLAUDE.md, select consistency). */
export const CUBE_SELECT = {
	id: true,
	user_id: true,
	puzzle: true,
	name: true,
	brand: true,
	is_smart: true,
	ble_device_id: true,
	ble_name: true,
	legacy_smart_device_ids: true,
	archived_at: true,
	created_at: true,
	updated_at: true,
} as const;

export const CUBE_CALIBRATION_SELECT = {
	id: true,
	cube_id: true,
	platform: true,
	device_model: true,
	os_version: true,
	app_version: true,
	sensor_name: true,
	peak_ut: true,
	rest_ut: true,
	noise_ut: true,
	near_min_ut: true,
	far_max_ut: true,
	quality: true,
	sample_count: true,
	sweep_ms: true,
	rate_hz: true,
	algo_version: true,
	measured_at: true,
	created_at: true,
	updated_at: true,
} as const;

export interface CubeUsage {
	solve_count: number;
	first_used_at: Date | null;
	last_used_at: Date | null;
}

const NO_USAGE: CubeUsage = {solve_count: 0, first_used_at: null, last_used_at: null};

/**
 * Solve count and first / last use per cube, one grouped scan of the user's solves (the
 * user_id index narrows it; the largest account holds ~40k rows).
 */
export async function getCubeUsage(prisma: Prisma, userId: string, cubeIds?: string[]): Promise<Map<string, CubeUsage>> {
	const usage = new Map<string, CubeUsage>();
	if (cubeIds && !cubeIds.length) return usage;
	const groups = await prisma.solve.groupBy({
		by: ['cube_id'],
		where: {
			user_id: userId,
			cube_id: cubeIds ? {in: cubeIds} : {not: null},
		},
		_count: {_all: true},
		_min: {created_at: true},
		_max: {created_at: true},
	});
	for (const group of groups as any[]) {
		if (!group.cube_id) continue;
		usage.set(group.cube_id, {
			solve_count: group._count?._all ?? 0,
			first_used_at: group._min?.created_at ?? null,
			last_used_at: group._max?.created_at ?? null,
		});
	}
	return usage;
}

/** One cube in the GraphQL shape, with its usage and its calibrations. */
export async function getCubeForUser(prisma: Prisma, userId: string, cubeId: string) {
	const cube = await prisma.cube.findFirst({
		where: {id: cubeId, user_id: userId},
		select: {
			...CUBE_SELECT,
			calibrations: {where: {user_id: userId}, select: CUBE_CALIBRATION_SELECT, orderBy: {measured_at: 'desc'}},
		},
	});
	if (!cube) return null;
	const usage = (await getCubeUsage(prisma, userId, [cube.id])).get(cube.id) || NO_USAGE;
	return {...cube, ...usage};
}

/** Everything the client keeps: cubes (archived included), their usage and calibrations, mains. */
export async function getMyCubeState(prisma: Prisma, userId: string) {
	const [cubes, mains, usage] = await Promise.all([
		prisma.cube.findMany({
			where: {user_id: userId},
			select: {
				...CUBE_SELECT,
				calibrations: {where: {user_id: userId}, select: CUBE_CALIBRATION_SELECT, orderBy: {measured_at: 'desc'}},
			},
			orderBy: [{created_at: 'asc'}, {id: 'asc'}],
		}),
		prisma.cubeMain.findMany({
			where: {user_id: userId},
			select: {puzzle: true, cube_id: true, set_at: true},
		}),
		getCubeUsage(prisma, userId),
	]);

	return {
		cubes: cubes.map((cube) => ({...cube, ...(usage.get(cube.id) || NO_USAGE)})),
		mains,
	};
}

export function countCubes(prisma: Prisma, userId: string): Promise<number> {
	return prisma.cube.count({where: {user_id: userId}});
}

/**
 * set_at of a main the server picked by itself (the first cube of a puzzle, the migration's
 * most used smart cube). Deliberately old: any choice a person makes, on any device and with
 * any clock, is newer and wins the merge (design 4.2, 7.2 step 7).
 */
export const AUTO_MAIN_SET_AT = new Date('2000-01-01T00:00:00.000Z');

/**
 * Makes `cubeId` the main of its puzzle when the puzzle has none yet (the first cube of a
 * puzzle). `chosenAt` given: the person asked for it (the form's "make it my main" box), so it
 * replaces an existing main unless that one was chosen later.
 */
export async function ensureMainForNewCube(
	prisma: Pick<PrismaClient, 'cubeMain'>,
	userId: string,
	puzzle: string,
	cubeId: string,
	chosenAt: Date | null
): Promise<void> {
	if (chosenAt) {
		const current = await prisma.cubeMain.findUnique({
			where: {user_id_puzzle: {user_id: userId, puzzle}},
			select: {set_at: true},
		});
		if (current && current.set_at.getTime() >= chosenAt.getTime()) return;
		await prisma.cubeMain.upsert({
			where: {user_id_puzzle: {user_id: userId, puzzle}},
			create: {user_id: userId, puzzle, cube_id: cubeId, set_at: chosenAt},
			update: {cube_id: cubeId, set_at: chosenAt},
		});
		return;
	}
	const setAt = AUTO_MAIN_SET_AT;
	const existing = await prisma.cubeMain.findUnique({
		where: {user_id_puzzle: {user_id: userId, puzzle}},
		select: {cube_id: true},
	});
	if (existing) return;
	try {
		await prisma.cubeMain.create({data: {user_id: userId, puzzle, cube_id: cubeId, set_at: setAt}});
	} catch (error: any) {
		// Another request made a main for this puzzle in between: that one stays.
		if (error?.code !== 'P2002') throw error;
	}
}

interface LegacyDeviceRow {
	id: string;
	user_id: string;
	name: string;
	device_id: string;
}

/**
 * The cube a smart device row registered through the legacy `addNewSmartDevice` belongs to,
 * created when missing (design 2.7, 3.2): an app still on an older OTA bundle keeps feeding
 * My Cubes. The new cube takes the device row's id, so that app's solves (which carry
 * smart_device_id) map onto it directly. Never throws: the legacy mutation must keep working
 * even if this part fails.
 */
export async function ensureCubeForLegacyDevice(prisma: Prisma, row: LegacyDeviceRow) {
	if (!row?.id || !row.user_id) return null;
	try {
		const existing = await prisma.cube.findFirst({
			where: {
				user_id: row.user_id,
				OR: [
					{id: row.id},
					{legacy_smart_device_ids: {has: row.id}},
					...(row.device_id ? [{ble_device_id: row.device_id}] : []),
				],
			},
			select: {id: true, legacy_smart_device_ids: true},
		});
		if (existing) {
			if (!existing.legacy_smart_device_ids.includes(row.id)) {
				await prisma.cube.update({
					where: {id: existing.id},
					data: {legacy_smart_device_ids: {push: row.id}},
				});
			}
			return existing;
		}

		if ((await countCubes(prisma, row.user_id)) >= MAX_CUBES_PER_USER) return null;

		const created = await prisma.cube.create({
			data: {
				id: row.id,
				user_id: row.user_id,
				puzzle: '333',
				name: smartCubeDefaultName(row.name),
				brand: brandFromBleName(row.name),
				is_smart: true,
				ble_device_id: row.device_id || null,
				ble_name: row.name || null,
				legacy_smart_device_ids: [row.id],
			},
			select: {id: true, legacy_smart_device_ids: true},
		});
		await ensureMainForNewCube(prisma, row.user_id, '333', created.id, null);
		return created;
	} catch (error: any) {
		logger.warn('Cube for legacy smart device not created', {userId: row.user_id, deviceRowId: row.id, error});
		return null;
	}
}
