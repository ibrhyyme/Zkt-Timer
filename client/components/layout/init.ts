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
import { initLokiDb } from '../../db/lokijs';
import { appendSolvesToDb, initSolveDb, initSolvesCollection } from '../../db/solves/init';
import { getNewScramble } from '../timer/helpers/scramble';
import { Solve } from '../../../server/schemas/Solve.schema';
import { StatsModule } from '../../../server/schemas/StatsModule.schema';
import { initStatsModuleStore } from '../../actions/stats';
import { Session } from '../../../server/schemas/Session.schema';
import { Setting } from '../../../server/schemas/Setting.schema';
import { Friendship } from '../../../server/schemas/Friendship.schema';
import { UserAccount } from '../../../server/schemas/UserAccount.schema';
import { getAllLocalSettings } from '../../db/settings/local';
import { getStore } from '../store';
import { setGeneral } from '../../actions/general';
import { generateId } from '../../../shared/code';

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

	console.time('loadedFromOffline');
	await initOfflineData(me, async (passed) => {
		if (!passed) {
			try {
				await clearOfflineData();
			} catch (e) {
				console.error(e);
			}
			initLokiDb({
				autoload: false,
			});
		} else {
			console.timeEnd('loadedFromOffline');
		}

		// PHASE 1: Critical data only — blocks the loading screen
		// Timer only needs settings, sessions, and a scramble to render
		const criticalPromises: Promise<any>[] = [];
		if (!passed) {
			criticalPromises.push(getAllSessions());
		}
		criticalPromises.push(getAllSettings(me?.id));
		criticalPromises.push(initNewScramble());

		try {
			console.time('criticalDataLoaded');
			await Promise.all(criticalPromises);
			console.timeEnd('criticalDataLoaded');

			// Initialize solves collection (empty if not from cache) so timer can render
			initSolvesCollection();
		} catch (e) {
			console.error(e);
		}

		// UI is ready — hide LoadingCover immediately
		callback();

		// PHASE 2: Non-critical data — loads in background after UI is visible
		loadNonCriticalData(me, dispatch, passed);
	});
}

async function loadNonCriticalData(_me: UserAccount, dispatch: Dispatch<any>, _passedFromOffline: boolean) {
	try {
		const bgPromises: Promise<any>[] = [];

		// Always fetch solves (fresh from server or background sync after offline hydration)
		bgPromises.push(initAllSolves());
		bgPromises.push(getStatsModule(dispatch));
		bgPromises.push(getAllFriends(dispatch));

		await Promise.all(bgPromises);

		// Only call updateOfflineHash ONCE, after all background work completes
		updateOfflineHash(true);
	} catch (e) {
		console.error(e);
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

const SOLVE_BATCH_SIZE = 500;
const INITIAL_SOLVE_COUNT = 100;

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
		// First batch: load most recent solves quickly for immediate display
		const res = await gqlQuery<{ solves: Solve[] }>(query, { take: INITIAL_SOLVE_COUNT, skip: 0 });
		const solves = res.data.solves;
		initSolveDb(solves);

		// If we got less than requested, there are no more solves
		if (solves.length < INITIAL_SOLVE_COUNT) {
			return;
		}

		// Load remaining solves in background batches
		loadRemainingSolves(query);
	} catch (e) {
		console.error("Failed to load solves", e);
	}
}

async function loadRemainingSolves(query: ReturnType<typeof gql>) {
	let skip = INITIAL_SOLVE_COUNT;

	while (true) {
		try {
			const res = await gqlQuery<{ solves: Solve[] }>(query, { take: SOLVE_BATCH_SIZE, skip });
			const solves = res.data.solves;

			if (!solves.length) break;

			appendSolvesToDb(solves);
			skip += SOLVE_BATCH_SIZE;

			// If we got less than the batch size, we've loaded everything
			if (solves.length < SOLVE_BATCH_SIZE) break;
		} catch (e) {
			console.error("Failed to load solve batch at skip=" + skip, e);
			break;
		}
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
