import { gql } from '@apollo/client';
import {
	MICRO_SOLVE_FRAGMENT,
	SESSION_FRAGMENT,
	SETTING_FRAGMENT,
	STATS_MODULE_BLOCK_FRAGMENT,
} from '../../util/graphql/fragments';
import { gqlQuery, removeTypename } from '../api';
import { initSessionCollection, initSessionDb, reconcileSessionDb } from '../../db/sessions/init';
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
import { canSync } from '../../lib/sync-gate';
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
		disableAdapter: true, // Demo modunda veri saklanmasın
	});

	const localSettings = getAllLocalSettings('demo');
	const settingValues = Object.keys(localSettings).map((key) => ({
		id: key,
		local: true,
		value: localSettings[key],
	}));
	initSettingsDb(settingValues);
	initSessionCollection();
	initSolvesCollection(true);

	callback();
}

export async function initAppData(me: UserAccount, dispatch: Dispatch<any>, callback): Promise<any> {
	if (typeof window === 'undefined') {
		return;
	}

	const canSyncUser = !isProEnabled() || isPro(me);

	await initOfflineData(me, async (passed) => {
		// Basic → Pro gecisi: lokal verileri sunucuya aktar
		const needsMigration = canSyncUser && getLocalStorage('wasBasicUser') === 'true';
		if (needsMigration && passed) {
			// passed=true → IndexedDB'den LokiJS'e yuklendi, veriler hazir
			try {
				await migrateLocalDataToServer();
			} catch (e) {
				console.error('[Migration] Failed:', e);
			}
			deleteLocalStorage('wasBasicUser');
			// Migration sonrasi fresh fetch yapilmali
			passed = false;
		}

		let hasLocalData = false;

		if (!passed) {
			if (needsMigration) {
				deleteLocalStorage('wasBasicUser');
			}

			// Delta sync: IndexedDB'deki mevcut veriyi koruyarak sadece farki cek
			if (canSyncUser && !needsMigration) {
				hasLocalData = await tryLoadExistingDb();
			}

			if (!hasLocalData) {
				try {
					await clearOfflineData();
				} catch (e) {
					console.error(e);
				}
				// IndexedDB delete transaction'in tamamen kapanmasi icin bekle
				await new Promise(r => setTimeout(r, 100));
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
			// Basic kullanici: bos session collection olustur
			initSessionDb([]);
		}

		criticalPromises.push(getAllSettings(me?.id));
		criticalPromises.push(initNewScramble());

		try {
			await Promise.all(criticalPromises);
			initSolvesCollection();

			if (!passed && canSyncUser) {
				if (hasLocalData) {
					// Delta sync: sadece farki cek
					const deltaSuccess = await deltaSyncSolves();

					if (!deltaSuccess) {
						// Delta sync basarisiz — fallback: full fetch
						initSolvesCollection(true);
						await initAllSolves();
					}
				} else {
					// Ilk acilis veya bozuk DB: tum solve'lari cek
					await initAllSolves();
				}
			}

			// Background: eksik method_steps'leri backfill et (passed=true durumunda da calismali)
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
		loadNonCriticalData(me, dispatch, passed, canSyncUser);
	});
}

async function loadNonCriticalData(_me: UserAccount, dispatch: Dispatch<any>, passedFromOffline: boolean, canSyncUser: boolean) {
	try {
		const bgPromises: Promise<any>[] = [];

		if (passedFromOffline && canSyncUser) {
			emitEvent('solveDbUpdatedEvent');
			bgPromises.push(syncNewSolves());
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

	// Tab gorunur oldugunda stale solve'lari temizle
	if (canSyncUser) {
		initVisibilitySyncListener();
	}
}

/**
 * This may seem out of place but scrambo takes 300ms to load and its best to load it as early as possible
 * (with everything else)
 */
async function initNewScramble() {
	// Worker uzerinden arka planda — main thread bloke olmaz
	await getNewScrambleAsync('333');
}

const SYNC_SOLVE_COUNT = 500;
const DELTA_SYNC_BATCH_SIZE = 500;
const VISIBILITY_SYNC_DEBOUNCE_MS = 10_000;

/**
 * Mevcut IndexedDB'den LokiJS'e veri yuklemeyi dener.
 * Cache MISS durumunda bile eski veriyi korumak icin kullanilir (delta sync oncesi).
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
 * Delta sync: sunucudan sadece solve ID listesini cek, local ile karsilastir,
 * sadece farki uygula (yeni solve'lari cek, silinen solve'lari kaldir).
 */
async function deltaSyncSolves(): Promise<boolean> {
	try {
		// 1. Sunucudan tum solve ID'lerini cek (sadece id field'i)
		const idsQuery = gql`
			query Query($take: Int, $skip: Int) {
				solves(take: $take, skip: $skip) {
					id
				}
			}
		`;
		const idsRes = await gqlQuery<{ solves: { id: string }[] }>(idsQuery, { take: 0, skip: 0 });
		const serverIds = new Set(idsRes.data.solves.map((s) => s.id));

		// 2. Local solve ID'lerini al
		const solveDb = getSolveDb();
		if (!solveDb) return false;
		const localSolves = solveDb.find();
		const localIds = new Set(localSolves.map((s) => s.id));

		// 3. Offline queue'daki pending mutation'lari al (race condition onleme)
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
			// Offline queue okunamadiysa devam et, sadece pending korumasi olmaz
		}

		// 4. Diff hesapla
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

		// 5. Silinenleri local'den kaldir
		if (toRemove.length > 0) {
			const toRemoveSet = new Set(toRemove);
			const solvesToRemove = solveDb.find().filter((s) => toRemoveSet.has(s.id));
			solvesToRemove.forEach((s) => solveDb.remove(s));
		}

		// 6. Yenileri batch'ler halinde cek (solvesByIds query'si)
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

		// 7. Degisiklik varsa event emit et
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
 * LokiJS IndexedDB adapter catalog'unu on-initialize et.
 * Adapter'in saveDatabase metodu catalog null iken lazy-init yapiyor ama
 * recursive cagridaki callback wrapping bug'i yuzunden save her zaman basarisiz oluyor.
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
		if (!canSync()) return;

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

		// Stale solve'lari tespit et ve sil (baska cihazdan silinmis olabilir)
		const serverIds = new Set(serverSolves.map((s) => s.id));
		const solveDb = getSolveDb();
		if (!solveDb) return;

		let stale: Solve[];
		if (serverSolves.length < SYNC_SOLVE_COUNT) {
			// Sunucuda 500'den az solve var — tum local solve'lari kontrol et
			stale = solveDb.find().filter((s) => !serverIds.has(s.id));
		} else {
			// Sunucuda 500+ solve var — sadece son 500'un zaman araligindakileri kontrol et
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
 * Eski sync edilmis smart cube solve'lar (MICRO_SOLVE_FRAGMENT'a method_steps eklenmeden once)
 * solve_method_steps olmadan LokiJS'te bulunabilir. Bu fonksiyon onlari tespit edip backfill eder.
 */
async function backfillMissingMethodSteps(): Promise<void> {
	const db = getSolveDb();
	if (!db) return;

	const smartSolves = db.find({ is_smart_cube: true });
	const missingIds = smartSolves
		.filter((s) => !s.solve_method_steps || s.solve_method_steps.length === 0)
		.map((s) => s.id);

	if (!missingIds.length) return;

	console.log(`[Backfill] ${missingIds.length} smart cube solve'un method_steps'i eksik, fetch ediliyor...`);

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

				// Server downgrade ettiyse is_smart_cube'i sync et
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
		console.log(`[Backfill] ${updated} solve guncellendi`);
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
		console.warn('Offline: Could not fetch sessions', error);
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

		// Sunucu settings'lerini localStorage'a yedekle (offline fallback)
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
			// Mobilde viewport-dependent ayarlari backend'den alma — cihaza ozel kalsin
			if (isMobileViewport() && viewportDependentKeys.has(key as keyof AllSettings)) {
				if (localSettings[key] !== undefined && localSettings[key] !== null) {
					setting.value = localSettings[key];
				}
				// else: mobile-aware default zaten yuklendi (getDefaultSettings'ten)
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
 * Basic → Pro gecisinde lokal verileri sunucuya aktar.
 * initOfflineData passed=true olduktan sonra cagirilmali (LokiDB zaten yuklu).
 */
async function migrateLocalDataToServer() {
	const solveCollection = getLokiDb().getCollection('solves');
	const sessionCollection = getLokiDb().getCollection('sessions');

	const localSessions = sessionCollection ? sessionCollection.find() : [];
	const localSolves = solveCollection ? solveCollection.find() : [];

	if (!localSessions.length && !localSolves.length) return;

	console.log(`[Migration] ${localSessions.length} session, ${localSolves.length} solve aktarilacak`);

	// Once session'lari yukle (solve'lar session_id'ye bagimli)
	if (localSessions.length > 0) {
		const sessionInputs = localSessions.map((s) => ({
			id: s.id,
			name: s.name || 'Sezon',
			order: s.order || 0,
		}));
		await importSessionsInChunks(sessionInputs, () => {});
	}

	// Sonra solve'lari yukle (sadece SolveInput alanlarini gonder)
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
		await importSolvesInChunks(solveInputs, () => {});
	}

	console.log('[Migration] Aktarim tamamlandi');
}
