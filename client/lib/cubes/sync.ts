import { gqlMutateTyped, gqlQueryTyped } from '../../components/api';
import {
	CreateCubeDocument,
	CubeInput,
	CubeUpdateInput,
	DeleteCubeCalibrationDocument,
	DeleteCubeDocument,
	EnsureSmartCubeDocument,
	MyCubeStateDocument,
	SaveCubeCalibrationDocument,
	SetCubeArchivedDocument,
	SetMainCubeDocument,
	UpdateCubeDocument,
} from '../../@types/generated/graphql';
import { onVisibilityChange } from '../../util/app-visibility';
import { isConnectivityError } from '../../util/offline-replay';
import { canWriteSync } from '../sync-gate';
import { LocalCube, LocalMain, PendingCalibration } from './active_cube';
import {
	addPendingCalibration,
	applyServerCubeState,
	dropPendingCalibration,
	dropPendingMain,
	getCubeState,
	removeCalibration,
	removeCube,
	resolveCalibrationSent,
	resolveMainSent,
	setMainLocal,
	upsertCube,
} from './store';
import { migrateCubeLink, unlinkLocalSolvesFromCube } from '../../db/solves/migrate_cube_link';

/**
 * My Cubes server sync (design 4.1, 4.2, 4.4).
 *
 * - One read, myCubeState, at launch (after the offline queue's boot flush), when the app comes
 *   back to the front (at most every 5 minutes), when the network returns and when My Cubes opens.
 * - Choosing a main cube and saving a calibration work offline: applied locally at once, sent
 *   here, kept until the server answers.
 * - Creating, editing, archiving and deleting cubes need the network (no solve may point at a
 *   cube the server does not have). The *Online helpers throw; callers show the error
 *   (extensions.i18nKey, cube_errors.*) or, for isCubeConnectivityError, the offline sentence.
 *
 * Visitors: nothing here runs without a signed-in account.
 */

const REFRESH_INTERVAL_MS = 5 * 60_000;

let lastRefreshAttempt = 0;
let refreshInFlight: Promise<boolean> | null = null;
let pushInFlight: Promise<void> | null = null;
let pushAgain = false;
let listenersInstalled = false;

function signedIn(): boolean {
	return typeof window !== 'undefined' && canWriteSync() && !!getCubeState().userId;
}

/** True when a cube request failed for lack of a connection, not because the server refused it. */
export function isCubeConnectivityError(err: unknown): boolean {
	return isConnectivityError(err);
}

function errorCodes(err: any): { codes: string[]; keys: string[] } {
	const list: any[] = Array.isArray(err?.graphQLErrors) && err.graphQLErrors.length
		? err.graphQLErrors
		: Array.isArray(err?.networkError?.result?.errors)
			? err.networkError.result.errors
			: [];
	return {
		codes: list.map((e) => e?.extensions?.code).filter(Boolean),
		keys: list.map((e) => e?.extensions?.i18nKey).filter(Boolean),
	};
}

/**
 * Whether a refused pending change should be dropped: the server judged it (bad input, cube
 * gone, no Pro). A lost session, a server fault or the daily calibration limit are not about the
 * change itself, so it stays and goes out on a later run.
 */
function isFinalRefusal(err: any): boolean {
	if (isConnectivityError(err)) return false;
	const { codes, keys } = errorCodes(err);
	if (keys.includes('cube_errors.calibration_daily_limit')) return false;
	return codes.some((code) => code === 'BAD_INPUT' || code === 'NOT_FOUND' || code === 'FORBIDDEN');
}

function installListeners(): void {
	if (listenersInstalled || typeof window === 'undefined') return;
	listenersInstalled = true;
	onVisibilityChange((visible) => {
		if (visible) void refreshCubes();
	});
	window.addEventListener('online', () => {
		void refreshCubes({ force: true });
	});
}

/**
 * Reads myCubeState into the store, after sending pending changes (so the read already reflects
 * them). Throttled to once per 5 minutes unless `force`. Resolves false when nothing was read
 * (offline, signed out, throttled); never throws. Also links local solves to migrated smart
 * cubes when the mapping is new (migrate_cube_link.ts).
 */
export function refreshCubes(options: { force?: boolean } = {}): Promise<boolean> {
	if (!signedIn()) return Promise.resolve(false);
	installListeners();
	if (refreshInFlight) return refreshInFlight;

	const now = Date.now();
	if (!options.force && now - lastRefreshAttempt < REFRESH_INTERVAL_MS) return Promise.resolve(false);
	lastRefreshAttempt = now;

	const userId = getCubeState().userId;
	refreshInFlight = (async () => {
		try {
			await pushPendingCubeChanges();
			const result = await gqlQueryTyped(MyCubeStateDocument, {}, { fetchPolicy: 'no-cache' });
			const data = result?.data?.myCubeState;
			if (!data) return false;
			applyServerCubeState(userId, data.cubes || [], data.mains || []);
			migrateCubeLink();
			return true;
		} catch (e) {
			if (!isConnectivityError(e)) console.error('[Cubes] refresh failed:', e);
			return false;
		} finally {
			refreshInFlight = null;
		}
	})();
	return refreshInFlight;
}

async function pushMains(): Promise<'ok' | 'halt'> {
	const mains = getCubeState().mains;
	let refused = false;
	for (const [puzzle, entry] of Object.entries(mains) as [string, LocalMain][]) {
		if (!entry.pending) continue;
		const sentSetAt = entry.set_at;
		try {
			const result = await gqlMutateTyped(SetMainCubeDocument, {
				puzzle,
				cube_id: entry.cube_id,
				set_at: new Date(sentSetAt).toISOString(),
			});
			resolveMainSent(puzzle, sentSetAt, result?.data?.setMainCube || null);
		} catch (e) {
			if (isFinalRefusal(e)) {
				dropPendingMain(puzzle, sentSetAt);
				refused = true;
				continue;
			}
			return 'halt';
		}
	}
	// A refused choice leaves the puzzle without a local main until the next read; make it now.
	if (refused) lastRefreshAttempt = 0;
	return 'ok';
}

function calibrationInput(row: PendingCalibration) {
	return {
		cube_id: row.cube_id,
		platform: row.platform,
		device_model: row.device_model,
		os_version: row.os_version,
		app_version: row.app_version,
		sensor_name: row.sensor_name,
		peak_ut: row.peak_ut,
		rest_ut: row.rest_ut,
		noise_ut: row.noise_ut,
		near_min_ut: row.near_min_ut,
		far_max_ut: row.far_max_ut,
		quality: row.quality,
		sample_count: row.sample_count,
		sweep_ms: row.sweep_ms,
		rate_hz: row.rate_hz,
		algo_version: row.algo_version,
		measured_at: new Date(row.measured_at).toISOString(),
	};
}

async function pushCalibrations(): Promise<'ok' | 'halt'> {
	const pending = [...getCubeState().pendingCalibrations];
	for (const row of pending) {
		try {
			const result = await gqlMutateTyped(SaveCubeCalibrationDocument, { input: calibrationInput(row) });
			resolveCalibrationSent(row, result?.data?.saveCubeCalibration || null);
		} catch (e) {
			if (isFinalRefusal(e)) {
				console.error('[Cubes] calibration refused:', e);
				dropPendingCalibration(row);
				continue;
			}
			return 'halt';
		}
	}
	return 'ok';
}

/**
 * Sends pending main choices and calibrations. One run at a time; a call during a run makes the
 * run go once more. Stops at the first connectivity failure and keeps what is left.
 */
export function pushPendingCubeChanges(): Promise<void> {
	if (!signedIn()) return Promise.resolve();
	if (pushInFlight) {
		pushAgain = true;
		return pushInFlight;
	}
	pushInFlight = (async () => {
		try {
			do {
				pushAgain = false;
				if ((await pushMains()) === 'halt') break;
				if ((await pushCalibrations()) === 'halt') break;
			} while (pushAgain);
		} catch (e) {
			console.error('[Cubes] push failed:', e);
		} finally {
			pushInFlight = null;
		}
	})();
	return pushInFlight;
}

/**
 * The person picked the main cube of a puzzle (quick settings, My Cubes), or null for "no cube".
 * Works offline: the choice applies at once and is sent when possible (4.2).
 */
export function chooseMainCube(puzzle: string, cubeId: string | null): LocalMain | null {
	const entry = setMainLocal(puzzle, cubeId);
	if (entry) void pushPendingCubeChanges();
	return entry;
}

/**
 * A calibration measured on this device (T9). Used at once, uploaded when possible; the
 * server keeps whichever measurement of the same cube and phone model is newer.
 */
export function saveCubeCalibrationLocal(row: PendingCalibration): void {
	addPendingCalibration(row);
	void pushPendingCubeChanges();
}

/** createCube. `input.set_at` with `make_main` makes it the main unless a later choice exists. */
export async function createCubeOnline(input: CubeInput): Promise<LocalCube | null> {
	const setAt = input.make_main ? input.set_at ?? new Date().toISOString() : undefined;
	const result = await gqlMutateTyped(CreateCubeDocument, { input: { ...input, ...(setAt ? { set_at: setAt } : {}) } });
	const raw = result?.data?.createCube;
	const chosenMainAt = setAt ? new Date(setAt).getTime() : null;
	return raw ? upsertCube(raw, { chosenMainAt }) : null;
}

export async function updateCubeOnline(id: string, input: CubeUpdateInput): Promise<LocalCube | null> {
	const result = await gqlMutateTyped(UpdateCubeDocument, { id, input });
	const raw = result?.data?.updateCube;
	return raw ? upsertCube(raw) : null;
}

export async function setCubeArchivedOnline(id: string, archived: boolean): Promise<LocalCube | null> {
	const result = await gqlMutateTyped(SetCubeArchivedDocument, { id, archived });
	const raw = result?.data?.setCubeArchived;
	return raw ? upsertCube(raw) : null;
}

/** Deletes a cube. Its solves stay, unlinked, on the server and on this device. */
export async function deleteCubeOnline(id: string): Promise<boolean> {
	const result = await gqlMutateTyped(DeleteCubeDocument, { id });
	removeCube(id);
	unlinkLocalSolvesFromCube(id);
	return !!result?.data?.deleteCube;
}

/**
 * The cube a connected smart cube belongs to, created on first sight (design 3.2). Throws when
 * offline; the caller stamps nothing for that session (4.4).
 */
export async function ensureSmartCubeOnline(bleDeviceId: string, bleName?: string | null): Promise<LocalCube | null> {
	const result = await gqlMutateTyped(EnsureSmartCubeDocument, { ble_device_id: bleDeviceId, ble_name: bleName || null });
	const raw = result?.data?.ensureSmartCube;
	if (!raw) return null;
	const cube = upsertCube(raw);
	// A cube created from an old SmartDevice row maps that row's solves on this device.
	if (cube?.legacy_smart_device_ids.length) migrateCubeLink();
	return cube;
}

/** Removes one phone model's calibration of a cube (cube profile). */
export async function deleteCubeCalibrationOnline(id: string): Promise<boolean> {
	const result = await gqlMutateTyped(DeleteCubeCalibrationDocument, { id });
	removeCalibration(id);
	return !!result?.data?.deleteCubeCalibration;
}
