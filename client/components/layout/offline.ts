import { deleteLocalStorage, getLocalStorage, setLocalStorage } from '../../util/data/local_storage';
import { gql } from '@apollo/client';
import { gqlMutate } from '../api';
import { UserAccount } from '../../@types/generated/graphql';
import { v4 as uuid } from 'uuid';
import { getLokiDb, initLokiDb } from '../../db/lokijs';
import { initSolvesCollection } from '../../db/solves/init';

export async function initOfflineData(me, callback) {
	const offlineData = !(await shouldFetchDataFromDb(me));

	if (!offlineData) {
		callback(false);
		return;
	}

	// If for whatever reason this is not resolved, fallback to db
	const fallbackTimeout = setTimeout(async () => {
		callback(false);
	}, 5000);

	initLokiDb({ autoload: true });

	getLokiDb().loadDatabase(undefined, (err) => {
		clearTimeout(fallbackTimeout);

		const requiredCollections = ['solves', 'trainer', 'settings', 'sessions'];
		const requiredCollectionsExist = requiredCollections.every((name) => !!getLokiDb().getCollection(name));

		if (!err && requiredCollectionsExist) {
			callback(true);
		} else {
			callback(false);
		}
	});
}

export async function shouldFetchDataFromDb(me: UserAccount): Promise<boolean> {
	if (typeof indexedDB === 'undefined' || typeof localStorage === 'undefined') {
		return true;
	}

	const offlineHash = getLocalStorage('offlineHash');

	return me.offline_hash !== offlineHash;
}

export async function updateOfflineHash(nonInternal = false) {
	setTimeout(() => {
		try {
			const db = getLokiDb();
			if (db) {
				if (nonInternal) {
					db.saveDatabase((err) => {
						if (err) console.error("Error saving database (non-internal):", err);
					});
				} else {
					// @ts-ignore - saveDatabaseInternal might be private or missing in types
					if (typeof db.saveDatabaseInternal === 'function') {
						// @ts-ignore
						db.saveDatabaseInternal((err) => {
							if (err) console.error("Error saving database (internal):", err);
						});
					} else {
						db.saveDatabase((err) => {
							if (err) console.error("Error saving database (fallback):", err);
						});
					}
				}
			}
		} catch (e) {
			console.error("Failed to save database:", e);
		}
	});

	const query = gql`
		mutation Mutate($hash: String!) {
			updateOfflineHash(hash: $hash)
		}
	`;

	try {
		const hash = uuid();
		setLocalStorage('offlineHash', hash);

		await gqlMutate(query, {
			hash,
		});
	} catch (e) {
		console.error(e);
	}
}

export async function clearOfflineData() {
	return new Promise((resolve) => {
		deleteLocalStorage('offlineHash');
		if (getLokiDb() && getLokiDb().listCollections().length) {
			getLokiDb().deleteDatabase(() => {
				resolve(null);
			});
		} else {
			resolve(null);
		}
	});
}
