import { getSolveDb } from './init';
import { puzzleOfBucket } from '../../../shared/cube_puzzle';
import { legacySmartDeviceMap, LocalCube } from '../../lib/cubes/active_cube';
import { getCubeState } from '../../lib/cubes/store';
import { requestPersist } from '../persist';
import { emitEvent } from '../../util/event_handler';

/**
 * Local backfill of solve.cube_id (design .feedback/designs/magnet-cubes.md 4.5).
 *
 * The migration (scripts/migrations/cubes-from-smart-devices.sql) links old smart solves on the
 * server, but Basic accounts never read solves back (canReadSync), and a Pro account's sync only
 * fetches new ids, so rows already in LokiJS keep cube_id empty. This gives them the same link
 * the server made: smart_device_id is a cube's id or one of its legacy_smart_device_ids, and the
 * solve's bucket belongs to the cube's puzzle (puzzleOfBucket, the rule the SQL mirrors).
 *
 * Local only: nothing is queued, the server already holds the link. Idempotent: only rows
 * without a cube_id are touched. Solves with no device (SQL step 6) have no local match and stay
 * unlinked on this device; the profile count comes from the server and is right anyway.
 */

const DONE_PREFIX = 'zkt_cube_link:';

/** Links rows of the local solve table; returns how many changed. */
export function linkLocalSolvesToCubes(cubes: ReadonlyArray<LocalCube>): number {
	const db = getSolveDb();
	if (!db) return 0;
	const map = legacySmartDeviceMap(cubes);
	if (!map.size) return 0;

	const rows = db
		.chain()
		.find({ smart_device_id: { $in: [...map.keys()] } } as any)
		.where((solve: any) => !solve.cube_id)
		.data();

	let linked = 0;
	for (const solve of rows as any[]) {
		// Trainer solves never carry a cube (K-3, same rule as server/util/solve_links.ts).
		if (solve.trainer_name) continue;
		const cube = map.get(solve.smart_device_id);
		if (!cube) continue;
		if (puzzleOfBucket(solve.cube_type, solve.scramble_subset) !== cube.puzzle) continue;
		solve.cube_id = cube.id;
		db.update(solve);
		linked++;
	}
	return linked;
}

/**
 * A deleted cube: its local solves lose the link, as the server's deleteCube does with
 * updateMany. Local only, nothing is queued.
 */
export function unlinkLocalSolvesFromCube(cubeId: string): number {
	const db = getSolveDb();
	if (!db || !cubeId) return 0;
	const rows = db.chain().find({ cube_id: cubeId } as any).data();
	for (const solve of rows as any[]) {
		solve.cube_id = null;
		db.update(solve);
	}
	if (rows.length) {
		void requestPersist();
		emitEvent('solveDbUpdatedEvent');
	}
	return rows.length;
}

/** Short fingerprint of the old-device to cube mapping, so the pass reruns only when it changed. */
export function cubeLinkSignature(cubes: ReadonlyArray<LocalCube>): string {
	const pairs = [...legacySmartDeviceMap(cubes).entries()].map(([legacyId, cube]) => `${legacyId}>${cube.id}:${cube.puzzle}`).sort();
	let hash = 5381;
	const text = pairs.join('|');
	for (let i = 0; i < text.length; i++) {
		hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
	}
	return `${pairs.length}.${(hash >>> 0).toString(36)}`;
}

/**
 * Runs the backfill for the signed-in account when its cube list carries a mapping this device
 * has not applied yet (first load after the migration, a smart cube registered elsewhere).
 * Call after the solve table is loaded and the cube list is known. Returns rows changed.
 */
export function migrateCubeLink(): number {
	if (typeof window === 'undefined') return 0;
	const { userId, cubes } = getCubeState();
	if (!userId || !getSolveDb()) return 0;

	const signature = cubeLinkSignature(cubes);
	const key = DONE_PREFIX + userId;
	try {
		if (window.localStorage.getItem(key) === signature) return 0;
	} catch {
		// Storage unavailable: run every time, the pass is idempotent and cheap.
	}

	let linked = 0;
	try {
		linked = linkLocalSolvesToCubes(cubes);
	} catch (e) {
		console.error('[Cubes] local solve link failed:', e);
		return 0;
	}

	try {
		window.localStorage.setItem(key, signature);
	} catch {
		// See above.
	}

	if (linked > 0) {
		void requestPersist();
		emitEvent('solveDbUpdatedEvent');
	}
	return linked;
}
