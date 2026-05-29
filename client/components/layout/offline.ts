import { deleteLocalStorage, getLocalStorage, setLocalStorage } from '../../util/data/local_storage';
import { gql } from '@apollo/client';
import { gqlMutate } from '../api';
import { UserAccount } from '../../@types/generated/graphql';
import { v4 as uuid } from 'uuid';
import { getLokiDb, initLokiDb } from '../../db/lokijs';
import { initSolvesCollection } from '../../db/solves/init';
import { isProEnabled } from '../../lib/pro';

export async function initOfflineData(me, callback) {
	const shouldFetch = await shouldFetchDataFromDb(me);
	const offlineData = !shouldFetch;

	if (!offlineData && navigator.onLine) {
		callback(false);
		return;
	}

	// Guard: prevent callback from being called more than once.
	// If loadDatabase takes longer than 2s, fallback timeout fires, then when loadDatabase
	// completes, callback is called again — this would run all init logic twice.
	let callbackFired = false;
	const safeCallback = (passed: boolean) => {
		if (callbackFired) return;
		callbackFired = true;
		callback(passed);
	};

	// If for whatever reason this is not resolved, fallback to db
	const fallbackTimeout = setTimeout(async () => {
		safeCallback(false);
	}, 2000);

	initLokiDb({ autoload: false });

	getLokiDb().loadDatabase(undefined, (err) => {
		clearTimeout(fallbackTimeout);

		if (err) {
			console.error('[Offline] loadDatabase error:', err);
		}

		const requiredCollections = ['solves', 'settings', 'sessions'];
		const requiredCollectionsExist = requiredCollections.every((name) => !!getLokiDb().getCollection(name));

		if (!err && requiredCollectionsExist) {
			safeCallback(true);
		} else {
			safeCallback(false);
		}
	});
}

export async function shouldFetchDataFromDb(me: UserAccount): Promise<boolean> {
	if (typeof indexedDB === 'undefined' || typeof localStorage === 'undefined') {
		return true;
	}

	// Basic users don't compare hash with server,
	// always try to load from local IndexedDB
	if (isProEnabled() && !me?.is_pro && !me?.is_premium) {
		setLocalStorage('wasBasicUser', 'true');
		return false;
	}

	// New Pro user (was Basic before) - load local data first, migration will be done
	if (isProEnabled() && (me?.is_pro || me?.is_premium) && getLocalStorage('wasBasicUser') === 'true') {
		return false;
	}

	const offlineHash = getLocalStorage('offlineHash');

	// If both hashes are null/undefined, fetch from server (new user or clean state)
	if (!me.offline_hash && !offlineHash) {
		return true;
	}

	return me.offline_hash !== offlineHash;
}

/**
 * Save LokiJS DB to IndexedDB.
 * Should work for both Basic and Pro users.
 */
export async function saveLokiDb(): Promise<boolean> {
	return new Promise<boolean>((resolve) => {
		try {
			const db = getLokiDb();
			if (!db || !db.persistenceAdapter) {
				resolve(false);
				return;
			}

			// throttledSaves bypass — prevent queue blockage from previous failed saves
			const origThrottled = db.throttledSaves;
			db.throttledSaves = false;

			const timeout = setTimeout(() => {
				console.warn('[Offline] DB save timed out after 5s');
				db.throttledSaves = origThrottled;
				resolve(false);
			}, 5000);

			db.saveDatabase((err) => {
				clearTimeout(timeout);
				db.throttledSaves = origThrottled;
				if (err) {
					console.error('[Offline] DB save error:', err);
				}
				resolve(!err);
			});
		} catch (e) {
			console.error('[Offline] DB save exception:', e);
			resolve(false);
		}
	});
}

export async function updateOfflineHash() {
	const dbSaved = await saveLokiDb();

	// Don't update hash if DB couldn't be saved — prevents inconsistency
	if (!dbSaved) {
		console.warn('[Offline] Skipping hash update because DB save failed');
		return;
	}

	const query = gql`
		mutation Mutate($hash: String!) {
			updateOfflineHash(hash: $hash)
		}
	`;

	try {
		const hash = uuid();

		await gqlMutate(query, {
			hash,
		});

		setLocalStorage('offlineHash', hash);
		console.log('[Offline] Hash updated successfully');
	} catch (e) {
		// Offline — hash won't be updated, will retry next time we go online
	}
}

export async function clearOfflineData() {
	console.log('[Offline] clearOfflineData: start');
	return new Promise((resolve) => {
		deleteLocalStorage('offlineHash');
		const db = getLokiDb();
		if (db && db.listCollections().length) {
			db.deleteDatabase(() => {
				console.log('[Offline] clearOfflineData: done');
				resolve(null);
			});
		} else {
			console.log('[Offline] clearOfflineData: nothing to clear');
			resolve(null);
		}
	});
}
