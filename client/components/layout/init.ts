import { gql } from '@apollo/client';
import {
	MICRO_SOLVE_FRAGMENT,
	SESSION_FRAGMENT,
	SETTING_FRAGMENT,
	STATS_MODULE_BLOCK_FRAGMENT,
} from '../../util/graphql/fragments';
import { gqlQuery, removeTypename } from '../api';
import { ensureLocalDefaultSession, initSessionCollection, initSessionDb, reconcileSessionDb } from '../../db/sessions/init';
import { Dispatch } from 'redux';
import { clearOfflineData, initOfflineData, updateOfflineHash } from './offline';
import { initSettingsDb, SettingValue } from '../../db/settings/init';
import { getDefaultSettings, viewportDependentKeys, isMobileViewport, AllSettings } from '../../db/settings/query';
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
import { deleteLocalStorage, getLocalStorage, setLocalStorageObject } from '../../util/data/local_storage';
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
				passed = await tryLoadExistingDb();
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
			// Delta sync: fetch only diff while preserving existing data in IndexedDB
			if (canSyncUser && !needsMigration) {
				hasLocalData = await tryLoadExistingDb();
			}

			if (!hasLocalData) {
				// migrationSkipped: don't clear local IndexedDB (data will be retried next launch)
				if (!migrationSkipped) {
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
		} else if (!passed) {
			// Basic user: create empty session collection
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
				bgPromises.push(syncNewSolves());
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
	// Load via Worker in background on main thread — prevents blocking
	await getNewScrambleAsync('333');
}

const SYNC_SOLVE_COUNT = 500;
const DELTA_SYNC_BATCH_SIZE = 500;
const VISIBILITY_SYNC_DEBOUNCE_MS = 10_000;

/**
 * Attempts to load data from existing IndexedDB into LokiJS.
 * Used to preserve old data even on cache MISS (before delta sync).
 */
async function tryLoadExistingDb(): Promise<boolean> {
	try {
		initLokiDb({ autoload: false });

		const loaded = await new Promise<boolean>((resolve) => {
			const timeout = setTimeout(() => resolve(false), 2000);

			getLokiDb().loadDatabase(undefined, (err) => {
				clearTimeout(timeout);
				if (err) {
					resolve(false);
					return;
				}

				const solves = getLokiDb().getCollection('solves');
				const sessions = getLokiDb().getCollection('sessions');
				if (solves && sessions && solves.count() > 0) {
					resolve(true);
				} else {
					resolve(false);
				}
			});
		});

		return loaded;
	} catch (e) {
		console.error('[DeltaSync] tryLoadExistingDb failed:', e);
		return false;
	}
}

/**
 * Delta sync: fetch only solve ID list from server, compare with local,
 * apply only diff (fetch new solves, remove deleted solves).
 */
async function deltaSyncSolves(): Promise<boolean> {
	try {
		// 1. Fetch all solve IDs from server (only id field)
		const idsQuery = gql`
			query Query($take: Int, $skip: Int) {
				solves(take: $take, skip: $skip) {
					id
				}
			}
		`;
		const idsRes = await gqlQuery<{ solves: { id: string }[] }>(idsQuery, { take: 0, skip: 0 });
		const serverIds = new Set(idsRes.data.solves.map((s) => s.id));

		// 2. Get local solve IDs
		const solveDb = getSolveDb();
		if (!solveDb) return false;
		const localSolves = solveDb.find();
		const localIds = new Set(localSolves.map((s) => s.id));

		// 3. Get pending mutations from offline queue (race condition prevention)
		let pendingCreateIds = new Set<string>();
		let pendingDeleteIds = new Set<string>();
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

		// 4. Calculate diff
		const toFetch: string[] = [];
		for (const id of serverIds) {
			if (!localIds.has(id) && !pendingDeleteIds.has(id)) {
				toFetch.push(id);
			}
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
			const fetchQuery = gql`
				${MICRO_SOLVE_FRAGMENT}

				query Query($ids: [String]!) {
					solvesByIds(ids: $ids) {
						...MicroSolveFragment
					}
				}
			`;

			for (let i = 0; i < toFetch.length; i += DELTA_SYNC_BATCH_SIZE) {
				const batch = toFetch.slice(i, i + DELTA_SYNC_BATCH_SIZE);
				const res = await gqlQuery<{ solvesByIds: Solve[] }>(fetchQuery, { ids: batch });
				if (res.data.solvesByIds.length) {
					appendSolvesToDb(res.data.solvesByIds, true);
				}
			}
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

function initVisibilitySyncListener() {
	if (visibilityListenerRegistered) return;
	visibilityListenerRegistered = true;

	onVisibilityChange((visible) => {
		if (!visible) return;
		if (!canReadSync()) return;

		const now = Date.now();
		if (now - lastSyncTime < VISIBILITY_SYNC_DEBOUNCE_MS) return;
		lastSyncTime = now;

		Promise.all([syncNewSolves(), syncNewSessions()])
			.then(() => updateOfflineHash())
			.catch(() => {});
	});
}

async function syncNewSolves() {
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

		if (serverSolves.length) {
			appendSolvesToDb(serverSolves);
		}

		// Detect and delete stale solves (may have been deleted from another device)
		const serverIds = new Set(serverSolves.map((s) => s.id));
		const solveDb = getSolveDb();
		if (!solveDb) return;

		let stale: Solve[];
		if (serverSolves.length < SYNC_SOLVE_COUNT) {
			// Server has fewer than 500 solves — check all local solves
			stale = solveDb.find().filter((s) => !serverIds.has(s.id));
		} else {
			// Server has 500+ solves — only check recent 500's time range
			const oldestServerTime = parseInt(String(serverSolves[serverSolves.length - 1].started_at), 10);
			const recentLocal = solveDb.find({ started_at: { $gte: oldestServerTime } });
			stale = recentLocal.filter((s) => !serverIds.has(s.id));
		}

		if (stale.length > 0) {
			stale.forEach((s) => solveDb.remove(s));
			emitEvent('solveDbUpdatedEvent');
		}
	} catch (e) {
		console.error('Failed to sync new solves', e);
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

export async function initAllSolves() {
	const query = gql`
		${MICRO_SOLVE_FRAGMENT}

		query Query($take: Int, $skip: Int) {
			solves(take: $take, skip: $skip) {
				...MicroSolveFragment
			}
		}
	`;

	try {
		const res = await gqlQuery<{ solves: Solve[] }>(query, { take: 0, skip: 0 });
		const solves = res.data.solves;
		initSolveDb(solves);
	} catch (e) {
		console.error("Failed to load solves", e);
		initSolveDb([]);
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
		const res = await gqlQuery<{ sessions: Session[] }>(query);
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
		const res = await gqlQuery<{ settings: Setting }>(query);
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

	const settings: SettingValue[] = [];
	const localSettings = getAllLocalSettings(userId);
	const defaultSettings = { ...getDefaultSettings() };

	for (const key of Object.keys(defaultSettings)) {
		const setting = {
			id: key,
			local: true,
			value: defaultSettings[key],
		};

		if (key in backendSettings) {
			// On mobile, don't use viewport-dependent settings from backend — keep device-specific
			if (isMobileViewport() && viewportDependentKeys.has(key as keyof AllSettings)) {
				if (localSettings[key] !== undefined && localSettings[key] !== null) {
					setting.value = localSettings[key];
				}
				// else: mobile-aware default already loaded (from getDefaultSettings)
			} else {
				setting.value = backendSettings[key];
				setting.local = false;
			}
		} else if (localSettings[key] !== undefined && localSettings[key] !== null) {
			setting.value = localSettings[key];
		}

		settings.push(setting);
	}

	initSettingsDb(settings);
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
		const query = gql`
			query Query($take: Int, $skip: Int) {
				solves(take: $take, skip: $skip) { id }
			}
		`;
		const res = await gqlQuery<{ solves: { id: string }[] }>(query, { take: 0, skip: 0 });
		if (res.data.solves && res.data.solves.length > 0) {
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

	// Upload missing solves (only SolveInput fields)
	const missingSolves = localSolves.filter((s) => !serverSolveIds.has(s.id));
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
