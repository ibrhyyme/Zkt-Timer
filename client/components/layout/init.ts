import { gql } from '@apollo/client';
import {
	MICRO_SOLVE_FRAGMENT,
	SESSION_FRAGMENT,
	SETTING_FRAGMENT,
	STATS_MODULE_BLOCK_FRAGMENT,
} from '../../util/graphql/fragments';
import { gqlMutate, gqlQuery, removeTypename } from '../api';
import { ensureLocalDefaultSession, initSessionCollection, initSessionDb, reconcileSessionDb } from '../../db/sessions/init';
import { Dispatch } from 'redux';
import { clearOfflineData, initOfflineData, saveLokiDb, setDbLoadDegraded, updateOfflineHash } from './offline';
import { initSettingsDb, SettingValue } from '../../db/settings/init';
import { getDefaultSettings, isMobileViewport, AllSettings, isGlobalSetting, isLocalOnlySetting } from '../../db/settings/query';
import { getLokiDb, initLokiDb } from '../../db/lokijs';
import { appendSolvesToDb, getSolveDb, initSolveDb, initSolvesCollection } from '../../db/solves/init';
import { getNewScrambleAsync } from '../timer/helpers/scramble';
import { Solve } from '../../../server/schemas/Solve.schema';
import { StatsModule } from '../../../server/schemas/StatsModule.schema';
import { initStatsModuleStore } from '../../actions/stats';
import { Session } from '../../../server/schemas/Session.schema';
import { Setting } from '../../../server/schemas/Setting.schema';
import { UserAccount } from '../../../server/schemas/UserAccount.schema';
import { getAllLocalSettings } from '../../db/settings/local';
import { syncPlatformPrefs } from '../../db/settings/update';
import { deleteLocalStorage, getLocalStorage, setLocalStorage, setLocalStorageObject } from '../../util/data/local_storage';
import { getStore } from '../store';
import { setGeneral } from '../../actions/general';
import { generateId } from '../../../shared/code';
import { emitEvent } from '../../util/event_handler';
import { syncDailyGoalsFromServer } from '../daily-goal/helpers/storage';
import { onVisibilityChange } from '../../util/app-visibility';
import { isPro, isProEnabled } from '../../lib/pro';
import { canReadSync, canWriteSync } from '../../lib/sync-gate';
import { importSessionsInChunks, importSolvesInChunks } from '../settings/data/import_data/review_import/chunked_import';
import { getAllQueued } from '../../util/offline-queue';
import { getSolveTombstones } from '../../util/solve-tombstones';
import * as Sentry from '@sentry/browser';

// Every boot fetcher below already falls back to local data when its request
// FAILS. What none of them survive is a request that never settles at all: a
// mobile connection that keeps the socket open and answers nothing leaves the
// await pending forever, `callback()` is never reached, and the LoadingCover
// spins with no escape (Sentry sees nothing, because nothing threw). Racing
// every boot-path query against a deadline turns that dead end into the
// already-written offline path.
const BOOT_QUERY_TIMEOUT_MS = 20_000;
// Full solve/session payloads are legitimately large on a slow connection, so
// they get a longer leash than the small metadata queries.
const BOOT_BULK_TIMEOUT_MS = 45_000;

class BootTimeoutError extends Error {
	constructor(label: string, ms: number) {
		super(`[Boot] ${label} timed out after ${ms}ms`);
		this.name = 'BootTimeoutError';
	}
}

function withBootTimeout<T>(promise: Promise<T>, label: string, ms: number = BOOT_QUERY_TIMEOUT_MS): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => {
			reportBootTimeout(label, ms);
			reject(new BootTimeoutError(label, ms));
		}, ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			}
		);
	});
}

// A boot timeout is invisible in the current telemetry: the app simply hangs.
// Report it so the real-world frequency of this failure becomes measurable
// instead of depending on users reporting it by hand.
function reportBootTimeout(label: string, ms: number) {
	console.warn(`[Boot] ${label} timed out after ${ms}ms — falling back to local data`);
	if (typeof window === 'undefined') return;
	try {
		Sentry.withScope((scope) => {
			scope.setLevel(Sentry.Severity.Warning);
			scope.setTag('boot_stage', label);
			scope.setExtra('timeout_ms', ms);
			scope.setExtra('online', navigator.onLine);
			Sentry.captureMessage(`[Boot] ${label} timed out`);
		});
	} catch (e) {}
}

export function initAnonymousAppData(callback) {
	if (typeof window === 'undefined') {
		return;
	}

	initLokiDb({
		autoload: false,
		autosave: false,
		autosaveInterval: undefined,
		adapter: undefined,
		disableAdapter: true, // Don't persist data for anonymous users
	});

	const localSettings = getAllLocalSettings('_anon');
	const settingValues = Object.keys(localSettings).map((key) => ({
		id: key,
		local: true,
		value: localSettings[key],
	}));
	initSettingsDb(settingValues);
	initSessionCollection();
	initSolvesCollection(true);
	ensureLocalDefaultSession();

	callback();
}

export async function initAppData(me: UserAccount, dispatch: Dispatch<any>, callback): Promise<any> {
	if (typeof window === 'undefined') {
		return;
	}

	const canSyncUser = !isProEnabled() || isPro(me);

	await initOfflineData(me, async (passed) => {
		// Basic → Pro migration: upload local data to server.
		// Data loss prevention: don't delete flag before migration SUCCESS,
		// don't clear local IndexedDB — retry on next launch.
		const needsMigration = canSyncUser && getLocalStorage('wasBasicUser') === 'true';
		let migrationSkipped = false;

		if (needsMigration) {
			// passed=false → IndexedDB failed to load on initial loadDatabase (timeout/err/missing collection).
			// Retry loading; if failed, flag is PRESERVED.
			if (!passed) {
				passed = (await tryLoadExistingDb()) === 'loaded';
			}

			if (passed) {
				const migrationOk = await migrateLocalDataToServer();
				if (migrationOk) {
					deleteLocalStorage('wasBasicUser');
					// After migration, fresh fetch should occur
					passed = false;
				} else {
					// Migration failed — flag and local LokiDB are preserved,
					// user continues to see local data, retry on next launch.
					migrationSkipped = true;
				}
			} else {
				// IndexedDB failed to load; data truly missing or corrupted.
				// Keep flag (retry next launch), don't clear local DB.
				migrationSkipped = true;
			}
		}

		let hasLocalData = false;

		if (!passed) {
			// Delta sync: fetch only diff while preserving existing data in IndexedDB.
			// Attempt the local reload for EVERY user (Basic included) before deciding
			// to clear — a Basic user's local snapshot is their only in-app copy.
			let loadResult: LocalDbLoadResult = 'empty';
			if (!needsMigration) {
				loadResult = await tryLoadExistingDb();
			}
			hasLocalData = loadResult === 'loaded';

			if (!hasLocalData) {
				if (loadResult === 'error') {
					// Slow or failed load is not corruption: keep the disk snapshot
					// intact, lock persistence for this session and refetch into a
					// fresh in-memory instance.
					setDbLoadDegraded(true);
				} else if (!migrationSkipped && canSyncUser) {
					// Pro: clearing is safe — the server refetch below repopulates.
					// Basic users are intentionally NOT cleared: their local snapshot is
					// the only in-app copy and the server data is pulled back by
					// recoverBasicDataFromServer() below.
					// migrationSkipped: don't clear local IndexedDB (data will be retried next launch)
					try {
						await clearOfflineData();
					} catch (e) {
						console.error(e);
					}
					// Wait for IndexedDB delete transaction to fully close
					await new Promise(r => setTimeout(r, 100));
				}
				initLokiDb({
					autoload: false,
				});
				await initAdapterCatalog();
			}
		}

		const criticalPromises: Promise<any>[] = [];
		if (!passed && canSyncUser) {
			criticalPromises.push(getAllSessions());
		} else if (!passed && !hasLocalData) {
			// Basic with no local data — start empty; recoverBasicDataFromServer()
			// below pulls sessions + solves back from the server. A Basic user that
			// DID reload local (hasLocalData) keeps its sessions untouched.
			initSessionDb([]);
		}

		// For non-syncing users (Basic), guarantee local default session.
		// Pro/sync users already have session created server-side on signup.
		if (!canSyncUser) {
			ensureLocalDefaultSession();
		}

		criticalPromises.push(getAllSettings(me?.id));
		criticalPromises.push(initNewScramble());

		try {
			await Promise.all(criticalPromises);
			initSolvesCollection();

			if (!passed && canSyncUser) {
				if (hasLocalData) {
					// Delta sync: fetch only diff
					const deltaSuccess = await deltaSyncSolves();

					if (!deltaSuccess) {
						// Delta sync failed — fallback: full fetch
						initSolvesCollection(true);
						await initAllSolves();
					}
				} else {
					// First launch or corrupted DB: fetch all solves
					await initAllSolves();
				}
			}

			// Basic recovery: Basic users write to the server (canWriteSync) but do
			// NOT read from it, so a wiped/empty local IndexedDB shows no solves even
			// though the data is safe on the server. When local is empty, pull the
			// user's own sessions + solves back. Covers both a failed load this launch
			// and users whose local was already wiped by a prior bad launch.
			// An "is it empty" check alone was not enough: a recovery that dies partway
			// (dropped connection on a large account) leaves a non-empty local DB, and
			// this condition then never fires again — the user is stranded with whatever
			// fraction arrived. The marker below records that a recovery started, so an
			// interrupted one resumes on the next launch. Re-running is safe:
			// appendSolvesToDb skips ids that are already present.
			if (!canSyncUser && me?.id) {
				const solveDb = getSolveDb();
				const localEmpty = !solveDb || solveDb.count() === 0;
				const marker = getLocalStorage(BASIC_RECOVERY_KEY);

				if (localEmpty || marker === BASIC_RECOVERY_IN_PROGRESS) {
					await recoverBasicDataFromServer();
				} else if (!marker) {
					// Healthy existing account with local data and no marker: nothing to
					// recover, just record that so later launches skip this branch.
					setLocalStorage(BASIC_RECOVERY_KEY, BASIC_RECOVERY_DONE);
				}
			}

			// Background: backfill missing method_steps (should also work when passed=true)
			if (canSyncUser) {
				backfillMissingMethodSteps().catch((e) => {
					console.error('[Backfill] failed:', e);
				});
			}
		} catch (e) {
			console.error(e);
		}

		// UI is ready — hide LoadingCover immediately
		callback();

		// PHASE 2: Non-critical data — loads in background after UI is visible
		loadNonCriticalData(me, dispatch, passed, canSyncUser, migrationSkipped);
	});
}

async function loadNonCriticalData(_me: UserAccount, dispatch: Dispatch<any>, passedFromOffline: boolean, canSyncUser: boolean, migrationSkipped: boolean = false) {
	try {
		const bgPromises: Promise<any>[] = [];

		if (passedFromOffline && canSyncUser) {
			emitEvent('solveDbUpdatedEvent');
			// Migration skipped/failed (local data not yet on server): syncNewSolves would see
			// empty server and delete ALL local solves as "stale" — skip it.
			// syncNewSessions is safe and continues working.
			if (!migrationSkipped) {
				// Launch is the right moment for a full reconcile: deletes made on
				// other devices land here, and the id fetch is paid once per session.
				bgPromises.push(syncNewSolves(true));
			}
			bgPromises.push(syncNewSessions());
		}

		bgPromises.push(getStatsModule(dispatch));
		bgPromises.push(syncDailyGoalsFromServer());

		await Promise.all(bgPromises);

		if (canSyncUser) {
			await updateOfflineHash();
		}
	} catch (e) {
		console.error(e);
	}

	// Full-sync backfill: push local solves/sessions not yet on the server.
	// Runs for every logged-in user (Basic included), idempotent via id-diff + skipDuplicates.
	if (canWriteSync()) {
		backfillLocalDataToServer().catch((e) => console.error('[Backfill] failed:', e));
	}

	// Clean up stale solves when tab becomes visible
	if (canSyncUser) {
		initVisibilitySyncListener();
	}
}

/**
 * This may seem out of place but scrambo takes 300ms to load and its best to load it as early as possible
 * (with everything else)
 */
async function initNewScramble() {
	// Load via Worker in background on main thread — prevents blocking.
	// The async generators run inside a web worker whose script is fetched over
	// the network; if that fetch stalls the promise never settles, so this must
	// not be able to hold the boot chain. The timer generates its own scramble
	// on mount anyway, making this purely a warm-up.
	try {
		await withBootTimeout(getNewScrambleAsync('333'), 'initial_scramble');
	} catch (e) {
		console.warn('[Boot] initial scramble warm-up skipped:', e);
	}
}

const SYNC_SOLVE_COUNT = 500;
const DELTA_SYNC_BATCH_SIZE = 500;
const VISIBILITY_SYNC_DEBOUNCE_MS = 10_000;
// Reconcile pulls the full server id list, so it runs far less often than the
// lightweight "fetch recent solves" pass that every tab focus triggers.
const RECONCILE_INTERVAL_MS = 5 * 60_000;
const RECENT_SOLVE_GRACE_MS = 2 * 60_000;

type LocalDbLoadResult = 'loaded' | 'empty' | 'error';

/**
 * Attempts to load data from existing IndexedDB into LokiJS.
 * Used to preserve old data even on cache MISS (before delta sync).
 *
 * Distinguishes "genuinely no local data" ('empty') from "load failed or timed
 * out" ('error') — callers must only clear the disk on 'empty'. A slow load is
 * not corruption.
 */
async function tryLoadExistingDb(): Promise<LocalDbLoadResult> {
	try {
		initLokiDb({ autoload: false });

		return await new Promise<LocalDbLoadResult>((resolve) => {
			const timeout = setTimeout(() => resolve('error'), 15000);

			getLokiDb().loadDatabase(undefined, (err) => {
				clearTimeout(timeout);
				if (err) {
					resolve('error');
					return;
				}

				const solves = getLokiDb().getCollection('solves');
				const sessions = getLokiDb().getCollection('sessions');
				if (solves && sessions && solves.count() > 0) {
					resolve('loaded');
				} else {
					resolve('empty');
				}
			});
		});
	} catch (e) {
		console.error('[DeltaSync] tryLoadExistingDb failed:', e);
		return 'error';
	}
}

/**
 * Delta sync: fetch only solve ID list from server, compare with local,
 * apply only diff (fetch new solves, remove deleted solves).
 */
async function deltaSyncSolves(): Promise<boolean> {
	try {
		// 1. Fetch all solve IDs from server (only id field).
		// `mySolveIds` selects nothing but the id column. The `solves` query used to
		// stand here: it always reads every solve column plus the whole
		// solve_method_steps relation, and its `take: 0` was falsy so no limit was
		// ever applied. The entire dataset was read from the DB on every launch
		// only for GraphQL to discard it and return the ids.
		const idsQuery = gql`
			query Query {
				mySolveIds
			}
		`;
		const idsRes = await withBootTimeout(gqlQuery<{ mySolveIds: string[] }>(idsQuery), 'delta_solve_ids');
		// A missing payload is a failed read, not "the server has no solves". Coercing
		// it to [] here would let step 5 below delete local solves. Bail out instead
		// so the caller falls back to a full fetch, matching the previous behaviour
		// where a malformed response threw.
		const serverIdList = idsRes.data?.mySolveIds;
		if (!serverIdList) return false;
		const serverIds = new Set(serverIdList);

		// 2. Get local solve IDs
		const solveDb = getSolveDb();
		if (!solveDb) return false;
		const localSolves = solveDb.find();
		const localIds = new Set(localSolves.map((s) => s.id));

		// An empty id list alongside substantial local data is a suspicious
		// response — skip reconciliation instead of deleting everything local.
		// Genuine local-only solves are uploaded later by backfillLocalDataToServer.
		if (serverIds.size === 0 && localIds.size > 50) {
			console.error(`[DeltaSync] Server returned 0 ids while ${localIds.size} local solves exist — skipping`);
			return true;
		}

		// 3. Get pending mutations from offline queue (race condition prevention)
		const {pendingCreateIds, pendingDeleteIds} = await getPendingSolveMutationIds();

		// Solves this device deleted must not be pulled back in: another device that
		// hasn't reconciled yet can re-upload them via its own backfill.
		const tombstoned = getSolveTombstones();

		// 4. Calculate diff
		const toFetch: string[] = [];
		const resurrected: string[] = [];
		for (const id of serverIds) {
			if (localIds.has(id) || pendingDeleteIds.has(id)) continue;
			if (tombstoned.has(id)) {
				resurrected.push(id);
				continue;
			}
			toFetch.push(id);
		}

		// Re-issue the delete for anything that came back from the dead.
		if (resurrected.length) {
			void redeleteResurrectedSolves(resurrected);
		}

		const toRemove: string[] = [];
		for (const id of localIds) {
			if (!serverIds.has(id) && !pendingCreateIds.has(id)) {
				toRemove.push(id);
			}
		}

		// 5. Remove deleted solves from local
		if (toRemove.length > 0) {
			const toRemoveSet = new Set(toRemove);
			const solvesToRemove = solveDb.find().filter((s) => toRemoveSet.has(s.id));
			solvesToRemove.forEach((s) => solveDb.remove(s));
		}

		// 6. Fetch new solves in batches (solvesByIds query)
		if (toFetch.length > 0) {
			await withBootTimeout(fetchSolvesByIds(toFetch), 'delta_solve_fetch', BOOT_BULK_TIMEOUT_MS);
		}

		// 7. Emit event if changes occurred
		if (toFetch.length > 0 || toRemove.length > 0) {
			emitEvent('solveDbUpdatedEvent');
		}

		return true;
	} catch (e) {
		console.error('[DeltaSync] Failed:', e);
		return false;
	}
}

/**
 * Pre-initialize LokiJS IndexedDB adapter catalog.
 * The adapter's saveDatabase method does lazy-init when catalog is null, but
 * due to callback wrapping bug in recursive calls, save always fails.
 */
async function initAdapterCatalog(): Promise<void> {
	await new Promise<void>((resolve) => {
		const adapter = getLokiDb().persistenceAdapter as any;
		const timeout = setTimeout(() => resolve(), 3000);
		if (adapter?.getDatabaseList) {
			adapter.getDatabaseList(() => {
				clearTimeout(timeout);
				resolve();
			});
		} else {
			clearTimeout(timeout);
			resolve();
		}
	});
}

let visibilityListenerRegistered = false;
let lastSyncTime = 0;
let lastReconcileTime = Date.now(); // launch already reconciles

function initVisibilitySyncListener() {
	if (visibilityListenerRegistered) return;
	visibilityListenerRegistered = true;

	onVisibilityChange((visible) => {
		if (!visible) return;
		if (!canReadSync()) return;

		const now = Date.now();
		if (now - lastSyncTime < VISIBILITY_SYNC_DEBOUNCE_MS) return;
		lastSyncTime = now;

		const reconcile = now - lastReconcileTime >= RECONCILE_INTERVAL_MS;
		if (reconcile) {
			lastReconcileTime = now;
		}

		Promise.all([syncNewSolves(reconcile), syncNewSessions()])
			.then(() => updateOfflineHash())
			.catch(() => {});
	});
}

/**
 * Reads the offline queue and returns the solve ids with an unsent create/delete.
 * Reconciliation must never act on these: a pending create doesn't exist server-side
 * yet (deleting it locally loses the solve), and a pending delete still exists
 * server-side (fetching it back resurrects it).
 */
async function getPendingSolveMutationIds(): Promise<{pendingCreateIds: Set<string>; pendingDeleteIds: Set<string>}> {
	const pendingCreateIds = new Set<string>();
	const pendingDeleteIds = new Set<string>();

	try {
		const pendingMutations = await getAllQueued();
		for (const m of pendingMutations) {
			if (m.mutationName === 'createSolve' && m.variables?.input?.id) {
				pendingCreateIds.add(m.variables.input.id);
			}
			if (m.mutationName === 'deleteSolve' && m.variables?.id) {
				pendingDeleteIds.add(m.variables.id);
			}
			if (m.mutationName === 'deleteSolves' && m.variables?.ids) {
				for (const id of m.variables.ids) {
					pendingDeleteIds.add(id);
				}
			}
		}
	} catch (e) {
		// If offline queue can't be read, continue without pending protection
	}

	return {pendingCreateIds, pendingDeleteIds};
}

/**
 * A tombstoned solve that is still on the server was re-uploaded by a device that
 * hadn't reconciled yet. Push the delete again so it actually sticks.
 */
async function redeleteResurrectedSolves(ids: string[]): Promise<void> {
	const mutation = gql`
		mutation Mutate($ids: [String!]!) {
			deleteSolves(ids: $ids)
		}
	`;

	try {
		await gqlMutate(mutation, { ids });
		console.log(`[Sync] Re-deleted ${ids.length} resurrected solves`);
	} catch (e) {
		console.error('[Sync] Failed to re-delete resurrected solves', e);
	}
}

/**
 * Pulls solves created on other devices and (when `reconcile`) removes the ones
 * deleted elsewhere.
 *
 * Reconciliation compares the FULL server id set, not a recency window. The old
 * window used `started_at` while the server orders by `created_at` — a single solve
 * whose two timestamps disagree (offline queue replay, imported data) widened the
 * window by months, and every local solve inside it that wasn't in the last 500
 * was deleted as "stale" even though the server still had it.
 */
async function syncNewSolves(reconcile = false) {
	const query = gql`
		${MICRO_SOLVE_FRAGMENT}

		query Query($take: Int, $skip: Int) {
			solves(take: $take, skip: $skip) {
				...MicroSolveFragment
			}
		}
	`;

	try {
		const res = await gqlQuery<{ solves: Solve[] }>(query, { take: SYNC_SOLVE_COUNT, skip: 0 });
		const serverSolves = res.data.solves;

		const {pendingCreateIds, pendingDeleteIds} = await getPendingSolveMutationIds();
		const tombstoned = getSolveTombstones();

		// Don't re-insert a solve this device deleted or is about to delete.
		const incoming = serverSolves.filter((s) => !pendingDeleteIds.has(s.id) && !tombstoned.has(s.id));
		if (incoming.length) {
			appendSolvesToDb(incoming);
		}

		const resurrected = serverSolves.filter((s) => tombstoned.has(s.id)).map((s) => s.id);
		if (resurrected.length) {
			void redeleteResurrectedSolves(resurrected);
		}

		if (!reconcile) return;

		const solveDb = getSolveDb();
		if (!solveDb) return;

		// Full id set — the only way to detect a solve deleted on another device
		// without guessing at a time window.
		const idsRes = await gqlQuery<{ mySolveIds: string[] }>(gql`
			query Query {
				mySolveIds
			}
		`);
		const serverIds = new Set(idsRes.data?.mySolveIds || []);

		// An empty response is indistinguishable from a failed/partial one —
		// never treat it as "server has no solves" and wipe local data.
		if (serverIds.size === 0) return;

		// A solve finished seconds ago can still have its createSolve mutation in
		// flight: not on the server yet, not in the offline queue either. Give recent
		// solves a grace period so reconciliation never deletes a solve mid-upload.
		const graceCutoff = Date.now() - RECENT_SOLVE_GRACE_MS;
		const stale = solveDb.find().filter((s) => {
			if (serverIds.has(s.id) || pendingCreateIds.has(s.id)) return false;
			const startedAt = parseInt(String(s.started_at), 10);
			return !(startedAt >= graceCutoff);
		});

		// Guard against partial server responses: deleting a large share of the
		// local DB in one sweep is almost certainly a bad payload, not real deletes.
		const localCount = solveDb.count();
		if (stale.length > 50 && stale.length > localCount * 0.2) {
			console.error(`[Sync] Refusing to delete ${stale.length}/${localCount} local solves — suspicious server response`);
			return;
		}

		if (stale.length > 0) {
			stale.forEach((s) => solveDb.remove(s));
			emitEvent('solveDbUpdatedEvent');
		}

		// The id set also reveals server solves this device is missing OUTSIDE the
		// most-recent-500 window — e.g. rows a previous buggy reconcile deleted, or
		// old solves synced from another device. Pull them back.
		const localIds = new Set(solveDb.find().map((s) => s.id));
		const missing: string[] = [];
		for (const id of serverIds) {
			if (!localIds.has(id) && !pendingDeleteIds.has(id) && !tombstoned.has(id)) {
				missing.push(id);
			}
		}

		if (missing.length > 0) {
			await fetchSolvesByIds(missing);
			emitEvent('solveDbUpdatedEvent');
		}
	} catch (e) {
		console.error('Failed to sync new solves', e);
	}
}

/**
 * Batch-fetches full solve rows by id and appends them to LokiJS. Shared by delta
 * sync and reconciliation; callers emit `solveDbUpdatedEvent` themselves.
 */
async function fetchSolvesByIds(ids: string[]): Promise<void> {
	const fetchQuery = gql`
		${MICRO_SOLVE_FRAGMENT}

		query Query($ids: [String]!) {
			solvesByIds(ids: $ids) {
				...MicroSolveFragment
			}
		}
	`;

	for (let i = 0; i < ids.length; i += DELTA_SYNC_BATCH_SIZE) {
		const batch = ids.slice(i, i + DELTA_SYNC_BATCH_SIZE);
		const res = await gqlQuery<{ solvesByIds: Solve[] }>(fetchQuery, { ids: batch });
		if (res.data.solvesByIds.length) {
			appendSolvesToDb(res.data.solvesByIds, true);
		}
	}
}

/**
 * Old synced smart cube solves (before method_steps added to MICRO_SOLVE_FRAGMENT)
 * may exist in LokiJS without solve_method_steps. This function detects and backfills them.
 */
async function backfillMissingMethodSteps(): Promise<void> {
	const db = getSolveDb();
	if (!db) return;

	const smartSolves = db.find({ is_smart_cube: true });
	const missingIds = smartSolves
		.filter((s) => !s.solve_method_steps || s.solve_method_steps.length === 0)
		.map((s) => s.id);

	if (!missingIds.length) return;

	console.log(`[Backfill] ${missingIds.length} smart cube solves missing method_steps, fetching...`);

	const fetchQuery = gql`
		${MICRO_SOLVE_FRAGMENT}

		query Query($ids: [String]!) {
			solvesByIds(ids: $ids) {
				...MicroSolveFragment
			}
		}
	`;

	let updated = 0;

	for (let i = 0; i < missingIds.length; i += DELTA_SYNC_BATCH_SIZE) {
		const batch = missingIds.slice(i, i + DELTA_SYNC_BATCH_SIZE);
		try {
			const res = await gqlQuery<{ solvesByIds: Solve[] }>(fetchQuery, { ids: batch });
			for (const fetched of res.data.solvesByIds) {
				const existing = db.findOne({ id: fetched.id });
				if (!existing) continue;

				// Server downgraded is_smart_cube flag — sync it
				if (typeof fetched.is_smart_cube === 'boolean' && fetched.is_smart_cube !== existing.is_smart_cube) {
					existing.is_smart_cube = fetched.is_smart_cube;
				}
				if (fetched.solve_method_steps && fetched.solve_method_steps.length) {
					existing.solve_method_steps = fetched.solve_method_steps;
				}
				db.update(existing);
				updated++;
			}
		} catch (e) {
			console.error('[Backfill] Batch fetch failed:', e);
		}
	}

	if (updated > 0) {
		console.log(`[Backfill] ${updated} solves updated`);
		emitEvent('solveDbUpdatedEvent');
	}
}

// Solves are pulled a page at a time rather than in one request. `take: 0` was
// falsy server-side, so this query used to mean "every solve, with every method
// step, in a single response" — tens of megabytes for a heavy user, which the
// server had to buffer whole and a phone had to parse whole. Paging keeps each
// response small enough to succeed and lets a late failure keep the pages that
// already arrived.
const SOLVE_PAGE_SIZE = 2500;
// Tracks whether a Basic-tier restore ran to completion, so one interrupted
// halfway resumes instead of leaving the account permanently short.
const BASIC_RECOVERY_KEY = 'zkt_basic_recovery';
const BASIC_RECOVERY_IN_PROGRESS = 'in_progress';
const BASIC_RECOVERY_DONE = 'done';
// Hard ceiling so a server that keeps returning full pages can never spin here
// forever. 400 pages is far beyond any real account (the largest today is ~40k).
const MAX_SOLVE_PAGES = 400;

export async function initAllSolves() {
	const query = gql`
		${MICRO_SOLVE_FRAGMENT}

		query Query($take: Int, $skip: Int) {
			solves(take: $take, skip: $skip) {
				...MicroSolveFragment
			}
		}
	`;

	const all: Solve[] = [];
	try {
		for (let page = 0; page < MAX_SOLVE_PAGES; page++) {
			const res = await withBootTimeout(
				gqlQuery<{ solves: Solve[] }>(query, { take: SOLVE_PAGE_SIZE, skip: page * SOLVE_PAGE_SIZE }),
				'all_solves',
				BOOT_BULK_TIMEOUT_MS
			);
			const batch = res.data?.solves || [];
			all.push(...batch);
			emitEvent('bootProgressEvent', { loadedSolves: all.length });
			if (batch.length < SOLVE_PAGE_SIZE) break;
		}

		initSolveDb(all);
		// Full dataset is in RAM — safe to persist again.
		setDbLoadDegraded(false);
	} catch (e) {
		console.error("Failed to load solves", e);
		// Keep whatever is already in RAM and leave persistence locked: wiping
		// here would let the next save overwrite the disk with an empty set.
		setDbLoadDegraded(true);
		initSolvesCollection();
	}
}

/**
 * Basic-tier recovery: repopulate local from the server when local is empty.
 * Basic users write to the server (canWriteSync) but the READ path is Pro-gated, so
 * a wiped local IndexedDB shows nothing even though the data is safe server-side.
 * Sessions use the [LOGGED_IN] `sessions` query; solves use the [LOGGED_IN]
 * `recoverMySolves` query (`solves` stays Pro-gated for the live cross-device
 * feature). Only ever invoked when local has 0 solves, so no overwrite/duplication.
 */
async function recoverBasicDataFromServer() {
	try {
		await getAllSessions();
	} catch (e) {
		console.error('[BasicRecovery] session recovery failed:', e);
	}

	const query = gql`
		${MICRO_SOLVE_FRAGMENT}

		query Query($take: Int, $skip: Int) {
			recoverMySolves(take: $take, skip: $skip) {
				...MicroSolveFragment
			}
		}
	`;

	// Paged for the same reason as initAllSolves: this query selects every method
	// step alongside every solve, so an unpaged recovery on a heavy account was the
	// single largest response the app ever asked for. Each page is appended as it
	// lands, so a failure halfway still leaves the user with real data.
	let restored = 0;
	let completed = false;
	setLocalStorage(BASIC_RECOVERY_KEY, BASIC_RECOVERY_IN_PROGRESS);
	try {
		for (let page = 0; page < MAX_SOLVE_PAGES; page++) {
			const res = await withBootTimeout(
				gqlQuery<{ recoverMySolves: Solve[] }>(query, { take: SOLVE_PAGE_SIZE, skip: page * SOLVE_PAGE_SIZE }),
				'basic_recovery',
				BOOT_BULK_TIMEOUT_MS
			);
			const batch = res.data?.recoverMySolves || [];
			if (batch.length) {
				appendSolvesToDb(batch);
				restored += batch.length;
				emitEvent('bootProgressEvent', { loadedSolves: restored });
			}
			if (batch.length < SOLVE_PAGE_SIZE) {
				// A short page is the end of the data, i.e. the whole set arrived.
				completed = true;
				break;
			}
		}
	} catch (e) {
		console.error('[BasicRecovery] solve recovery failed:', e);
	}

	if (completed) {
		setLocalStorage(BASIC_RECOVERY_KEY, BASIC_RECOVERY_DONE);
	}

	if (restored > 0) {
		// Data is in RAM — safe to persist to IndexedDB again.
		setDbLoadDegraded(false);
		try {
			await saveLokiDb();
		} catch (e) {
			console.error('[BasicRecovery] persist failed:', e);
		}
		emitEvent('solveDbUpdatedEvent');
		console.log(`[BasicRecovery] restored ${restored} solves from server`);
	}
}

export function setBrowserSessionId(dispatch: Dispatch<any>) {
	const currentId = getStore().getState()?.general?.browserSessionId;

	if (currentId) {
		return;
	}

	const newSessionId = generateId();
	dispatch(setGeneral('browser_session_id', newSessionId));
}

async function getAllSessions() {
	const query = gql`
		${SESSION_FRAGMENT}

		query Query {
			sessions {
				...SessionFragment
			}
		}
	`;

	try {
		const res = await withBootTimeout(gqlQuery<{ sessions: Session[] }>(query), 'sessions');
		initSessionCollection();
		reconcileSessionDb(res.data.sessions);
		emitEvent('sessionsDbUpdatedEvent');
	} catch (error) {
		// Fetch failed — don't touch local cache, just ensure collection.
		// Auto-create removed, so "empty session" won't create phantom session;
		// worst case user sees empty list, page refresh fixes it.
		console.error('[getAllSessions] Failed to fetch sessions, keeping local cache as-is:', error);
		initSessionCollection();
	}
}

async function syncNewSessions() {
	const query = gql`
		${SESSION_FRAGMENT}

		query Query {
			sessions {
				...SessionFragment
			}
		}
	`;

	try {
		const res = await gqlQuery<{ sessions: Session[] }>(query);
		const changed = reconcileSessionDb(res.data.sessions);
		if (changed) {
			emitEvent('sessionsDbUpdatedEvent');
		}
	} catch (e) {
		console.error('Failed to sync sessions', e);
	}
}

async function getStatsModule(disatch: Dispatch<any>) {
	const query = gql`
		${STATS_MODULE_BLOCK_FRAGMENT}

		query Query {
			statsModule {
				blocks {
					...StatsModuleBlockFragment
				}
			}
		}
	`;

	const res = await gqlQuery<{ statsModule: StatsModule }>(query);
	disatch(initStatsModuleStore(removeTypename(res.data.statsModule)));
}

async function getAllSettings(userId: string) {
	const query = gql`
		${SETTING_FRAGMENT}

		query Query {
			settings {
				...SettingsFragment
			}
		}
	`;

	let backendSettings: any = {};
	try {
		const res = await withBootTimeout(gqlQuery<{ settings: Setting }>(query), 'settings');
		backendSettings = res.data.settings;

		// Back up server settings to localStorage (offline fallback)
		if (backendSettings && Object.keys(backendSettings).length > 0) {
			const allSettingsVal = getLocalStorage('settings') || {};
			if (!allSettingsVal[userId]) {
				allSettingsVal[userId] = {};
			}
			for (const key of Object.keys(backendSettings)) {
				allSettingsVal[userId][key] = backendSettings[key];
			}
			setLocalStorageObject('settings', allSettingsVal);
		}
	} catch (error) {
		console.warn('Offline: Could not fetch settings, using defaults', error);
	}

	// Active platform's prefs blob (desktop_prefs / mobile_prefs)
	const platformPrefsKey = isMobileViewport() ? 'mobile_prefs' : 'desktop_prefs';
	let platformPrefs: Record<string, any> | null = null;
	const rawPrefs = backendSettings?.[platformPrefsKey];
	if (rawPrefs) {
		try {
			platformPrefs = JSON.parse(rawPrefs);
		} catch {
			platformPrefs = null;
		}
	}
	const hasBackend = backendSettings && Object.keys(backendSettings).length > 0;
	// Old user whose prefs blob for THIS platform hasn't been seeded yet.
	const needsPlatformMigration = hasBackend && !platformPrefs;

	const settings: SettingValue[] = [];
	const localSettings = getAllLocalSettings(userId);
	const defaultSettings = { ...getDefaultSettings() };

	for (const key of Object.keys(defaultSettings)) {
		const setting: SettingValue = {
			id: key,
			local: true,
			value: defaultSettings[key],
		};
		const k = key as keyof AllSettings;
		const hasLocal = localSettings[key] !== undefined && localSettings[key] !== null;
		const hasBackendCol = key in backendSettings && backendSettings[key] !== undefined && backendSettings[key] !== null;

		if (isLocalOnlySetting(k)) {
			// Device-only transient state — never synced.
			if (hasLocal) setting.value = localSettings[key];
		} else if (isGlobalSetting(k)) {
			// Shared across all devices — from backend column.
			if (hasBackendCol) {
				setting.value = backendSettings[key];
				setting.local = false;
			} else if (hasLocal) {
				setting.value = localSettings[key];
			}
		} else {
			// Platform setting — from the active platform's prefs blob, with
			// migration fallback to old column value, then device localStorage.
			if (platformPrefs && key in platformPrefs && platformPrefs[key] !== undefined && platformPrefs[key] !== null) {
				setting.value = platformPrefs[key];
				setting.local = false;
			} else if (hasBackendCol) {
				setting.value = backendSettings[key];
				setting.local = false;
			} else if (hasLocal) {
				setting.value = localSettings[key];
				setting.local = false;
			}
		}

		settings.push(setting);
	}

	initSettingsDb(settings);

	// First-time platform migration: seed this platform's prefs on the server
	// from the values just resolved (old columns + localStorage). Runs once per
	// platform — guarded by the server-side null prefs check.
	if (needsPlatformMigration) {
		try {
			await syncPlatformPrefs();
		} catch (e) {
			console.warn('Platform prefs migration failed (will retry next launch):', e);
		}
	}
}

/**
 * Basic → Pro migration: upload local data to server.
 * Should be called after initOfflineData passed=true (LokiDB already loaded).
 * Return: true (success or already empty), false (error — flag should be preserved).
 *
 * Safety: if server already has any SOLVE, skip migration. This prevents re-pushing
 * local data when Pro user's cache goes stale and 'wasBasicUser' flag is accidentally set.
 * In a real Basic→Pro transition, server has no solves (Basic doesn't sync).
 * NOTE: Don't check session count — server-side default session created on signup
 * (every user, Basic included, has at least 1 session). Checking sessions would
 * accidentally skip migration every time, causing data loss with solves never moved.
 */
async function migrateLocalDataToServer(): Promise<boolean> {
	const solveCollection = getLokiDb().getCollection('solves');
	const sessionCollection = getLokiDb().getCollection('sessions');

	const localSessions = sessionCollection ? sessionCollection.find() : [];
	const localSolves = solveCollection ? solveCollection.find() : [];

	if (!localSessions.length && !localSolves.length) return true;

	// Defensive check: if server already has SOLVE, don't start migration.
	// This means user was Pro; flag was just set wrong.
	// Don't check session count — server-side default created on signup,
	// checking sessions would accidentally skip migration (data loss).
	try {
		// Id-only existence check. `mySolveIds` reads just the id column instead of
		// pulling every solve with its method steps (see deltaSyncSolves).
		const query = gql`
			query Query {
				mySolveIds
			}
		`;
		const res = await withBootTimeout(gqlQuery<{ mySolveIds: string[] }>(query), 'migration_solve_check');
		// Same rule as deltaSyncSolves: an absent list means the check did not run.
		// Treating it as "server is empty" would start a migration that duplicates
		// data already on the server, so abort and retry on the next launch.
		if (!res.data?.mySolveIds) {
			console.error('[Migration] Server solve check returned no data, aborting');
			return false;
		}
		if (res.data.mySolveIds.length > 0) {
			console.log('[Migration] Server already has solves, skipping (incorrect wasBasicUser flag)');
			return true;
		}
	} catch (e) {
		console.error('[Migration] Server solve check failed, aborting:', e);
		return false; // preserve flag, retry on next launch
	}

	console.log(`[Migration] Uploading ${localSessions.length} sessions, ${localSolves.length} solves`);

	try {
		// First upload sessions (solves depend on session_id)
		if (localSessions.length > 0) {
			const sessionInputs = localSessions.map((s) => ({
				id: s.id,
				name: s.name || 'Session',
				order: s.order || 0,
			}));
			const sessionResult = await importSessionsInChunks(sessionInputs, () => {});
			// Silent fail protection: if any chunk fails, mark migration failed.
			// Flag is preserved, local DB not cleared, retry on next launch.
			if (sessionResult.failureCount > 0) {
				console.error(`[Migration] ${sessionResult.failureCount} session chunks failed — preserving flag`, sessionResult.errors);
				return false;
			}
		}

		// Then upload solves (only send SolveInput fields)
		if (localSolves.length > 0) {
			const solveInputs = localSolves.map((s) => ({
				id: s.id,
				time: s.time,
				raw_time: s.raw_time,
				cube_type: s.cube_type,
				scramble: s.scramble,
				session_id: s.session_id,
				started_at: s.started_at,
				ended_at: s.ended_at,
				dnf: s.dnf,
				plus_two: s.plus_two,
				bulk: s.bulk,
				notes: s.notes,
				from_timer: s.from_timer ?? true,
				trainer_name: s.trainer_name,
				is_smart_cube: s.is_smart_cube,
				training_session_id: s.training_session_id,
				smart_device_id: s.smart_device_id,
				smart_turn_count: s.smart_turn_count,
				smart_turns: s.smart_turns,
				smart_put_down_time: s.smart_put_down_time,
				smart_pick_up_time: s.smart_pick_up_time,
				inspection_time: s.inspection_time,
			}));
			const solveResult = await importSolvesInChunks(solveInputs, () => {});
			// Silent fail protection: if solve chunk fails, migration failed.
			// Otherwise flag deleted + fresh fetch would lose local solves.
			if (solveResult.failureCount > 0) {
				console.error(`[Migration] ${solveResult.failureCount} solve chunks failed — preserving flag`, solveResult.errors);
				return false;
			}
		}

		console.log('[Migration] Upload complete');
		return true;
	} catch (e) {
		console.error('[Migration] Failed:', e);
		return false;
	}
}

/**
 * Full-sync backfill: uploads local sessions/solves that don't yet exist on the server.
 * Runs on every launch for any logged-in user (Basic included). Idempotent: diffs against
 * server ids (mySessionIds/mySolveIds) and uses bulk mutations with skipDuplicates.
 * Sessions go first (solve FK depends on session_id); on session failure, solve backfill
 * is skipped to avoid orphan FK violations.
 */
async function backfillLocalDataToServer(): Promise<void> {
	const sessionCollection = getLokiDb().getCollection('sessions');
	const solveCollection = getLokiDb().getCollection('solves');

	const localSessions = sessionCollection ? sessionCollection.find() : [];
	const localSolves = solveCollection ? solveCollection.find() : [];
	if (!localSessions.length && !localSolves.length) return;

	// Fetch server-side ids (lightweight, id-only, LOGGED_IN-gated — no content exposure)
	let serverSessionIds: Set<string>;
	let serverSolveIds: Set<string>;
	try {
		const sesQuery = gql`
			query Query {
				mySessionIds
			}
		`;
		const solQuery = gql`
			query Query {
				mySolveIds
			}
		`;
		const sesRes = await gqlQuery<{ mySessionIds: string[] }>(sesQuery);
		const solRes = await gqlQuery<{ mySolveIds: string[] }>(solQuery);
		serverSessionIds = new Set(sesRes.data.mySessionIds || []);
		serverSolveIds = new Set(solRes.data.mySolveIds || []);
	} catch (e) {
		console.error('[Backfill] Could not fetch server ids, skipping:', e);
		return;
	}

	// Upload missing sessions first (FK dependency)
	const missingSessions = localSessions.filter((s) => !serverSessionIds.has(s.id));
	if (missingSessions.length > 0) {
		const sessionInputs = missingSessions.map((s) => ({
			id: s.id,
			name: s.name || 'Session',
			order: s.order || 0,
		}));
		const result = await importSessionsInChunks(sessionInputs, () => {});
		if (result.failureCount > 0) {
			console.error('[Backfill] Session chunks failed, skipping solve backfill', result.errors);
			return;
		}
	}

	// Upload missing solves (only SolveInput fields).
	// Tombstoned ids are excluded: "local but not on server" is ambiguous, and without
	// this check a solve deleted on another device gets re-uploaded here forever.
	const tombstoned = getSolveTombstones();
	const missingSolves = localSolves.filter((s) => !serverSolveIds.has(s.id) && !tombstoned.has(s.id));
	if (missingSolves.length > 0) {
		const solveInputs = missingSolves.map((s) => ({
			id: s.id,
			time: s.time,
			raw_time: s.raw_time,
			cube_type: s.cube_type,
			scramble_subset: s.scramble_subset,
			scramble: s.scramble,
			session_id: s.session_id,
			started_at: s.started_at,
			ended_at: s.ended_at,
			dnf: s.dnf,
			plus_two: s.plus_two,
			bulk: s.bulk,
			notes: s.notes,
			from_timer: s.from_timer ?? true,
			trainer_name: s.trainer_name,
			is_smart_cube: s.is_smart_cube,
			training_session_id: s.training_session_id,
			smart_device_id: s.smart_device_id,
			smart_turn_count: s.smart_turn_count,
			smart_turns: s.smart_turns,
			smart_put_down_time: s.smart_put_down_time,
			smart_pick_up_time: s.smart_pick_up_time,
			inspection_time: s.inspection_time,
		}));
		const result = await importSolvesInChunks(solveInputs, () => {});
		if (result.failureCount > 0) {
			console.error('[Backfill] Solve chunks failed', result.errors);
		}
	}

	if (missingSessions.length > 0 || missingSolves.length > 0) {
		console.log(`[Backfill] Uploaded ${missingSessions.length} sessions, ${missingSolves.length} solves`);
	}
}
