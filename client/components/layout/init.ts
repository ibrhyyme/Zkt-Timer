import { gql } from '@apollo/client';
import {
	MICRO_SOLVE_FRAGMENT,
	MINI_FRIENDSHIP_FRAGMENT,
	SESSION_FRAGMENT,
	SETTING_FRAGMENT,
	STATS_MODULE_BLOCK_FRAGMENT,
} from '../../util/graphql/fragments';
import { gqlQuery, removeTypename } from '../api';
import { initSessionCollection, initSessionDb } from '../../db/sessions/init';
import { Dispatch } from 'redux';
import { addFriendships } from '../../actions/account';
import { clearOfflineData, initOfflineData, updateOfflineHash } from './offline';
import { initSettingsDb, SettingValue } from '../../db/settings/init';
import { getDefaultSettings } from '../../db/settings/query';
import { getLokiDb, initLokiDb } from '../../db/lokijs';
import { appendSolvesToDb, getSolveDb, initSolveDb, initSolvesCollection } from '../../db/solves/init';
import { getNewScramble } from '../timer/helpers/scramble';
import { Solve } from '../../../server/schemas/Solve.schema';
import { StatsModule } from '../../../server/schemas/StatsModule.schema';
import { initStatsModuleStore } from '../../actions/stats';
import { Session } from '../../../server/schemas/Session.schema';
import { Setting } from '../../../server/schemas/Setting.schema';
import { Friendship } from '../../../server/schemas/Friendship.schema';
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

		if (!passed) {
			if (needsMigration) {
				deleteLocalStorage('wasBasicUser');
			}

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

			// LokiJS IndexedDB adapter'inin catalog'unu on-initialize et.
			// Adapter'in saveDatabase metodu catalog null iken lazy-init yapiyor ama
			// recursive cagridaki callback wrapping bug'i yuzunden save her zaman basarisiz oluyor.
			// getDatabaseList catalog'u initialize eder ama veri yuklemez (loadDatabase'den farki bu).
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
				await initAllSolves();
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
		}

		bgPromises.push(getStatsModule(dispatch));
		bgPromises.push(getAllFriends(dispatch));
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
	return new Promise((resolve) => {
		getNewScramble('333');
		resolve(null);
	});
}

const SYNC_SOLVE_COUNT = 500;
const VISIBILITY_SYNC_DEBOUNCE_MS = 10_000;

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

		syncNewSolves().then(() => updateOfflineHash()).catch(() => {});
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
		initSessionDb(res.data.sessions);
	} catch (error) {
		console.warn('Offline: Could not fetch sessions', error);
		initSessionDb([]);
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
			setting.value = backendSettings[key];
			setting.local = false;
		} else if (localSettings[key] !== undefined && localSettings[key] !== null) {
			setting.value = localSettings[key];
		}

		settings.push(setting);
	}

	initSettingsDb(settings);
}

async function getAllFriends(dispatch) {
	const query = gql`
		${MINI_FRIENDSHIP_FRAGMENT}

		query Query {
			allFriendships {
				...MiniFriendshipFragment
			}
		}
	`;

	const res = await gqlQuery<{ allFriendships: Friendship[] }>(query);
	return dispatch(addFriendships(res.data.allFriendships));
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
