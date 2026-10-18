import { puzzleOfBucket } from '../../../shared/cube_puzzle';

/**
 * My Cubes, client side: pure rules (design .feedback/designs/magnet-cubes.md, sections 4.1 to 4.3).
 * No storage, no network, no React here: store.ts keeps the state, sync.ts talks to the server.
 *
 * Dates are kept as epoch milliseconds so the state survives JSON (localStorage) unchanged.
 */

export interface LocalCalibration {
	/** Server row id. null for a measurement not uploaded yet. */
	id: string | null;
	cube_id: string;
	platform: string;
	device_model: string;
	os_version: string | null;
	app_version: string | null;
	sensor_name: string | null;
	peak_ut: number;
	rest_ut: number | null;
	noise_ut: number;
	near_min_ut: number;
	far_max_ut: number;
	quality: string;
	sample_count: number;
	sweep_ms: number;
	rate_hz: number;
	algo_version: number;
	measured_at: number;
	/** Measured on this device and not accepted by the server yet. */
	pending?: boolean;
}

/** A measurement waiting for upload (saveCubeCalibration). Same fields, no server id. */
export type PendingCalibration = Omit<LocalCalibration, 'id' | 'pending'>;

export interface LocalCube {
	id: string;
	puzzle: string;
	name: string;
	brand: string | null;
	is_smart: boolean;
	ble_device_id: string | null;
	ble_name: string | null;
	legacy_smart_device_ids: string[];
	archived_at: number | null;
	created_at: number | null;
	updated_at: number | null;
	solve_count: number;
	first_used_at: number | null;
	last_used_at: number | null;
	calibrations: LocalCalibration[];
}

/** The main cube of one puzzle (S-4). cube_id null: the person chose "no cube". */
export interface LocalMain {
	cube_id: string | null;
	set_at: number;
	/** Chosen on this device and not confirmed by the server yet. */
	pending?: boolean;
}

export type CubeMains = Record<string, LocalMain>;

export interface CubeState {
	cubes: LocalCube[];
	mains: CubeMains;
	pendingCalibrations: PendingCalibration[];
}

export interface SolveBucket {
	cube_type?: string | null;
	scramble_subset?: string | null;
}

/** Same instant as the server's AUTO_MAIN_SET_AT: an automatic main loses to any real choice. */
export const AUTO_MAIN_SET_AT_MS = Date.UTC(2000, 0, 1);

export function toMs(value: unknown): number | null {
	if (value === null || value === undefined || value === '') return null;
	const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : new Date(String(value)).getTime();
	return Number.isFinite(ms) ? ms : null;
}

const num = (value: unknown, fallback = 0): number => {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : fallback;
};

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null);

/** A calibration row from GraphQL (CubeCalibrationFragment) in local shape. */
export function normalizeCalibration(row: any): LocalCalibration | null {
	if (!row || !row.cube_id || !row.platform || !row.device_model) return null;
	return {
		id: str(row.id),
		cube_id: row.cube_id,
		platform: row.platform,
		device_model: row.device_model,
		os_version: str(row.os_version),
		app_version: str(row.app_version),
		sensor_name: str(row.sensor_name),
		peak_ut: num(row.peak_ut),
		rest_ut: row.rest_ut === null || row.rest_ut === undefined ? null : num(row.rest_ut),
		noise_ut: num(row.noise_ut),
		near_min_ut: num(row.near_min_ut),
		far_max_ut: num(row.far_max_ut),
		quality: row.quality || 'ok',
		sample_count: num(row.sample_count),
		sweep_ms: num(row.sweep_ms),
		rate_hz: num(row.rate_hz),
		algo_version: num(row.algo_version, 1),
		measured_at: toMs(row.measured_at) ?? 0,
	};
}

/** A cube from GraphQL (CubeFragment) in local shape. null for a row without id or puzzle. */
export function normalizeCube(row: any): LocalCube | null {
	if (!row || !row.id || !row.puzzle) return null;
	return {
		id: row.id,
		puzzle: row.puzzle,
		name: row.name || '',
		brand: str(row.brand),
		is_smart: !!row.is_smart,
		ble_device_id: str(row.ble_device_id),
		ble_name: str(row.ble_name),
		legacy_smart_device_ids: Array.isArray(row.legacy_smart_device_ids)
			? row.legacy_smart_device_ids.filter((id: unknown): id is string => typeof id === 'string' && !!id)
			: [],
		archived_at: toMs(row.archived_at),
		created_at: toMs(row.created_at),
		updated_at: toMs(row.updated_at),
		solve_count: num(row.solve_count),
		first_used_at: toMs(row.first_used_at),
		last_used_at: toMs(row.last_used_at),
		calibrations: Array.isArray(row.calibrations)
			? row.calibrations.map(normalizeCalibration).filter((c: LocalCalibration | null): c is LocalCalibration => !!c)
			: [],
	};
}

/**
 * Mains after a server read (4.2). Per puzzle the newer choice wins: a choice made on this
 * device and not sent yet stays when it is newer than the server's row, otherwise the server's
 * row stands. A confirmed local entry the server no longer has is dropped (the cube was
 * archived or deleted, or the main was cleared elsewhere).
 */
export function mergeMains(
	local: CubeMains,
	server: ReadonlyArray<{ puzzle?: string | null; cube_id?: string | null; set_at?: unknown } | null | undefined>
): CubeMains {
	const result: CubeMains = {};
	for (const row of server || []) {
		if (!row || !row.puzzle) continue;
		result[row.puzzle] = { cube_id: row.cube_id || null, set_at: toMs(row.set_at) ?? AUTO_MAIN_SET_AT_MS };
	}
	for (const [puzzle, entry] of Object.entries(local || {})) {
		if (!entry || !entry.pending) continue;
		const remote = result[puzzle];
		if (!remote || entry.set_at > remote.set_at) {
			result[puzzle] = { cube_id: entry.cube_id, set_at: entry.set_at, pending: true };
		}
	}
	return result;
}

export function cubeById(state: Pick<CubeState, 'cubes'>, id: string | null | undefined): LocalCube | null {
	if (!id) return null;
	return state.cubes.find((cube) => cube.id === id) || null;
}

/** The main cube of a puzzle, when it still exists, is not archived and belongs to that puzzle. */
export function mainCubeFor(puzzle: string | null | undefined, state: Pick<CubeState, 'cubes' | 'mains'>): LocalCube | null {
	if (!puzzle) return null;
	const entry = state.mains[puzzle];
	if (!entry || !entry.cube_id) return null;
	const cube = cubeById(state, entry.cube_id);
	if (!cube || cube.archived_at || cube.puzzle !== puzzle) return null;
	return cube;
}

/**
 * The cube a new timer solve in this bucket is made with: the main of the bucket's puzzle
 * (K-3: every bucket of the puzzle, subsets included). null for buckets without a physical
 * puzzle ('other') and for puzzles without a main. Smart cube solves do not use this: they are
 * stamped with the connected cube (design 4.3).
 */
export function activeCubeFor(bucket: SolveBucket | null | undefined, state: Pick<CubeState, 'cubes' | 'mains'>): LocalCube | null {
	if (!bucket) return null;
	return mainCubeFor(puzzleOfBucket(bucket.cube_type, bucket.scramble_subset), state);
}

export type CubeSort = 'default' | 'last_used' | 'solve_count' | 'name';

const byName = (a: LocalCube, b: LocalCube) =>
	a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);

const byLastUsed = (a: LocalCube, b: LocalCube) => (b.last_used_at ?? -1) - (a.last_used_at ?? -1);

/**
 * Cubes of one puzzle, sorted (S-3). `default`: main first, then last used, then name (My Cubes
 * page and the quick settings picker). The other sorts are what the page's sort picker offers
 * and do not lift the main. Archived cubes are left out unless asked for.
 */
export function cubesForPuzzle(
	puzzle: string | null | undefined,
	state: Pick<CubeState, 'cubes' | 'mains'>,
	sort: CubeSort = 'default',
	options: { includeArchived?: boolean } = {}
): LocalCube[] {
	if (!puzzle) return [];
	const list = state.cubes.filter((cube) => cube.puzzle === puzzle && (options.includeArchived || !cube.archived_at));
	const mainId = mainCubeFor(puzzle, state)?.id ?? null;

	let compare: (a: LocalCube, b: LocalCube) => number;
	switch (sort) {
		case 'name':
			compare = byName;
			break;
		case 'solve_count':
			compare = (a, b) => b.solve_count - a.solve_count || byLastUsed(a, b) || byName(a, b);
			break;
		case 'last_used':
			compare = (a, b) => byLastUsed(a, b) || byName(a, b);
			break;
		default:
			compare = (a, b) => Number(b.id === mainId) - Number(a.id === mainId) || byLastUsed(a, b) || byName(a, b);
	}
	return list.sort(compare);
}

/** Puzzle keys that have at least one cube, in no particular order. */
export function puzzlesWithCubes(state: Pick<CubeState, 'cubes'>, options: { includeArchived?: boolean } = {}): string[] {
	const keys = new Set<string>();
	for (const cube of state.cubes) {
		if (options.includeArchived || !cube.archived_at) keys.add(cube.puzzle);
	}
	return [...keys];
}

/** The smart cube registered with this BLE device id, if any. */
export function smartCubeByBleId(state: Pick<CubeState, 'cubes'>, bleDeviceId: string | null | undefined): LocalCube | null {
	if (!bleDeviceId) return null;
	return state.cubes.find((cube) => cube.is_smart && cube.ble_device_id === bleDeviceId) || null;
}

/**
 * Old smart_device ids mapped to the cube they became (design 4.5): the cube's own id (the
 * migration keeps the canonical SmartDevice id as Cube.id) and every id in
 * legacy_smart_device_ids (duplicates of the same physical cube).
 */
export function legacySmartDeviceMap(cubes: ReadonlyArray<LocalCube>): Map<string, LocalCube> {
	const map = new Map<string, LocalCube>();
	for (const cube of cubes) {
		if (!cube.is_smart && !cube.legacy_smart_device_ids.length) continue;
		for (const legacyId of cube.legacy_smart_device_ids) {
			if (!map.has(legacyId)) map.set(legacyId, cube);
		}
		if (cube.is_smart && !map.has(cube.id)) map.set(cube.id, cube);
	}
	return map;
}

type CalibrationKey = { cube_id: string; platform: string; device_model: string };

/** Same (cube, platform, phone model): the unique key of a calibration row. */
export function sameCalibrationKey(a: CalibrationKey, b: CalibrationKey): boolean {
	return a.cube_id === b.cube_id && a.platform === b.platform && a.device_model === b.device_model;
}

/**
 * The calibration of a cube on one phone model: the newer of the server's row and a measurement
 * from this device still waiting for upload (pending ones are used at once, 4.4). Thresholds are
 * never read from the row: callers derive them from the raw values (deriveThresholdsFromRow).
 */
export function calibrationFor(
	state: CubeState,
	cubeId: string | null | undefined,
	platform: string | null | undefined,
	deviceModel: string | null | undefined
): LocalCalibration | null {
	if (!cubeId || !platform || !deviceModel) return null;
	const key = { cube_id: cubeId, platform, device_model: deviceModel };
	const stored = cubeById(state, cubeId)?.calibrations.find((row) => sameCalibrationKey(row, key)) || null;
	const pending = state.pendingCalibrations.find((row) => sameCalibrationKey(row, key)) || null;
	if (pending && (!stored || pending.measured_at > stored.measured_at)) {
		return { ...pending, id: null, pending: true };
	}
	return stored;
}

/**
 * Pending measurements still worth sending after a server read: a newer row for the same
 * (cube, platform, model) on the server (made on another phone of the same model) replaces
 * them, and so does the cube disappearing.
 */
export function prunePendingCalibrations(
	pending: ReadonlyArray<PendingCalibration>,
	cubes: ReadonlyArray<LocalCube>
): PendingCalibration[] {
	return pending.filter((row) => {
		const cube = cubes.find((c) => c.id === row.cube_id);
		if (!cube) return false;
		const stored = cube.calibrations.find((c) => sameCalibrationKey(c, row));
		return !stored || row.measured_at > stored.measured_at;
	});
}

/** A calibration list with `row` in place of the one for the same phone model. */
export function withCalibration(list: ReadonlyArray<LocalCalibration>, row: LocalCalibration): LocalCalibration[] {
	return [...list.filter((c) => !sameCalibrationKey(c, row)), row];
}
