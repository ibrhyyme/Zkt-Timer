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
import { initSolveDb, initSolvesCollection } from '../../db/solves/init';
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

export async function initAllSolves(take?: number) {
	const query = gql`
		${MICRO_SOLVE_FRAGMENT}

		query Query($take: Int) {
			solves(take: $take) {
				...MicroSolveFragment
			}
		}
	`;

	try {
		const res = await gqlQuery<{ solves: Solve[] }>(query, { take: take || 500 });
		const solves = res.data.solves;

		initSolveDb(solves);
	} catch (e) {
		console.error("Failed to load solves", e);
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

	const res = await gqlQuery<{ sessions: Session[] }>(query);
	initSessionDb(res.data.sessions);
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

	const backendSettings = (await gqlQuery<{ settings: Setting }>(query)).data.settings;

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
