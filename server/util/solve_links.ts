import type {PrismaClient} from '@prisma/client';
import {logger} from '../services/logger';
import {puzzleOfBucket} from '../../shared/cube_puzzle';
import {sanitizeSmartDeviceLinks, SmartDeviceLinkRow} from './solve/smart_device_link';

/**
 * Which physical cube (Cube.id) and which smart device row a solve may point at.
 *
 * `solve.cube_id` is a plain column with no foreign key on purpose (design magnet-cubes.md 2.3):
 * the solve table is large, and a stale id from the offline queue must never fail a write the
 * way `smart_device_id` did. Integrity is kept here instead, on every path that writes either
 * column (createSolve, bulkCreateSolves, updateSolve):
 *
 * - smart_device_id first, by the rules in ./solve/smart_device_link.ts;
 * - a cube_id that names one of the caller's cubes of the solve's puzzle is kept. Anything else
 *   (unknown id, another account's cube, a 3x3 cube on a 7x7 solve, an empty string, a trainer
 *   solve) is stored as null. A solve is never refused over this field: the link is a label;
 * - a solve without a cube_id but with a valid smart_device_id (an app still on an older OTA
 *   bundle, which knows nothing about cubes) gets the cube that device was migrated into: the
 *   cube whose id is that device row id, or whose legacy_smart_device_ids holds it. Same
 *   puzzle rule. Old clients' smart solves then still count on the cube's profile.
 *
 * Two queries at most per request, never one per row.
 */

export interface SolveLinkRow extends SmartDeviceLinkRow {
	cube_id?: string | null;
	cube_type?: string | null;
	scramble_subset?: string | null;
	trainer_name?: string | null;
}

/** One of the caller's cubes, as much of it as the decision needs. */
export interface OwnedCube {
	id: string;
	puzzle: string;
	legacy_smart_device_ids?: string[] | null;
}

export interface CubeLinkReport {
	/** Solves whose cube_id matched none of the caller's cubes of that puzzle and was cleared. */
	cleared: (string | null)[];
	/** Solves that got their cube from their smart device link. */
	derived: (string | null)[];
}

export interface ResolveLinksOptions {
	/**
	 * Fill a missing cube_id from the smart device link. On create always; on update only when the
	 * request did not name a cube itself (an explicit null there means "unlink").
	 */
	deriveFromSmartDevice?: boolean;
}

function nonEmpty(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0;
}

function wantsDerivation(row: SolveLinkRow, derive: boolean): boolean {
	return derive && (row.cube_id === undefined || row.cube_id === null || row.cube_id === '') && nonEmpty(row.smart_device_id);
}

/** The distinct cube ids and (already validated) smart device ids worth looking up. */
export function requestedCubeLookups(
	rows: SolveLinkRow[],
	options: ResolveLinksOptions = {}
): {cubeIds: string[]; smartDeviceIds: string[]} {
	const derive = options.deriveFromSmartDevice !== false;
	const cubeIds = new Set<string>();
	const smartDeviceIds = new Set<string>();
	for (const row of rows) {
		if (!row || row.trainer_name) continue;
		if (nonEmpty(row.cube_id)) cubeIds.add(row.cube_id);
		else if (wantsDerivation(row, derive)) smartDeviceIds.add(row.smart_device_id as string);
	}
	return {cubeIds: [...cubeIds], smartDeviceIds: [...smartDeviceIds]};
}

function byIdOrder(a: OwnedCube, b: OwnedCube): number {
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Writes the resolved cube ids onto the rows, in place. Pure; `owned` must hold the caller's
 * cubes only, which is what makes another account's cube come out as null. A row whose cube_id
 * is undefined and that has nothing to derive from is left alone (on an update that means
 * "unchanged").
 */
export function applyCubeLinks(rows: SolveLinkRow[], owned: OwnedCube[], options: ResolveLinksOptions = {}): CubeLinkReport {
	const derive = options.deriveFromSmartDevice !== false;
	const report: CubeLinkReport = {cleared: [], derived: []};

	const byId = new Map<string, OwnedCube>();
	for (const cube of owned) byId.set(cube.id, cube);

	// A device row id names the cube that kept it as its own id first, then a cube that lists it
	// among its merged duplicates. Should two cubes ever list the same id, the lowest id wins, so
	// every solve of that device lands on the same cube.
	const bySmartDevice = new Map<string, OwnedCube>();
	for (const cube of [...owned].sort(byIdOrder)) {
		for (const legacy of cube.legacy_smart_device_ids || []) {
			if (nonEmpty(legacy) && !bySmartDevice.has(legacy)) bySmartDevice.set(legacy, cube);
		}
	}
	for (const cube of owned) bySmartDevice.set(cube.id, cube);

	for (const row of rows) {
		if (!row) continue;
		const value = row.cube_id;

		if (row.trainer_name) {
			// Trainer drills never count on a cube's profile (design K-3).
			if (value !== undefined && value !== null) {
				row.cube_id = null;
				if (nonEmpty(value)) report.cleared.push(row.id ?? null);
			}
			continue;
		}

		const puzzle = puzzleOfBucket(row.cube_type, row.scramble_subset);

		if (nonEmpty(value)) {
			const cube = byId.get(value);
			if (!cube || !puzzle || cube.puzzle !== puzzle) {
				row.cube_id = null;
				report.cleared.push(row.id ?? null);
			}
			continue;
		}

		if (wantsDerivation(row, derive)) {
			const cube = bySmartDevice.get(row.smart_device_id as string);
			if (cube && puzzle && cube.puzzle === puzzle) {
				row.cube_id = cube.id;
				report.derived.push(row.id ?? null);
				continue;
			}
		}

		// An empty string is not an id; stored as no link.
		if (value === '') row.cube_id = null;
	}

	return report;
}

/** At most this many solve ids go into one log line. */
const LOGGED_SOLVE_IDS = 20;

/** Clears every cube link of the rows: the fallback when the cube lookup itself failed. */
function clearCubeLinks(rows: SolveLinkRow[]): void {
	for (const row of rows) {
		if (row && row.cube_id !== undefined && row.cube_id !== null) row.cube_id = null;
	}
}

/**
 * The whole pass: smart device links first (one query), then cube links (one query), rows
 * corrected in place. Asks nothing of the database when no row carries a value. `source` names
 * the mutation in the log line. Never throws over the cube lookup: a failure there stores the
 * solves without a cube rather than failing them.
 */
export async function resolveOwnedLinks(
	prisma: Pick<PrismaClient, 'smartDevice' | 'cube'>,
	userId: string,
	rows: SolveLinkRow[],
	source: string,
	options: ResolveLinksOptions = {}
): Promise<CubeLinkReport> {
	await sanitizeSmartDeviceLinks(prisma, userId, rows, source);

	const {cubeIds, smartDeviceIds} = requestedCubeLookups(rows, options);

	let owned: OwnedCube[] = [];
	if (cubeIds.length || smartDeviceIds.length) {
		try {
			const ids = [...new Set([...cubeIds, ...smartDeviceIds])];
			owned = await prisma.cube.findMany({
				where: {
					user_id: userId,
					OR: [
						{id: {in: ids}},
						...(smartDeviceIds.length ? [{legacy_smart_device_ids: {hasSome: smartDeviceIds}}] : []),
					],
				},
				select: {id: true, puzzle: true, legacy_smart_device_ids: true},
			});
		} catch (error) {
			logger.warn('Solve cube lookup failed, cube links cleared', {userId, source, error});
			clearCubeLinks(rows);
			return {cleared: [], derived: []};
		}
	}

	const report = applyCubeLinks(rows, owned, options);

	if (report.cleared.length) {
		// Expected now and then (a cube deleted while its solves sat in the offline queue); the
		// line shows how often and for whom.
		logger.warn('Solve cube link repaired', {
			userId,
			source,
			clearedCount: report.cleared.length,
			derivedCount: report.derived.length,
			solveIds: report.cleared.slice(0, LOGGED_SOLVE_IDS),
		});
	}

	return report;
}
