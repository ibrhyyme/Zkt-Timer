import { deleteLocalStorage, getLocalStorage, setLocalStorage } from '../../util/data/local_storage';
import { gql } from '@apollo/client';
import { gqlMutate } from '../api';
import { UserAccount } from '../../@types/generated/graphql';
import { v4 as uuid } from 'uuid';
import { getLokiDb, initLokiDb } from '../../db/lokijs';
import { initSolvesCollection } from '../../db/solves/init';

export async function initOfflineData(me, callback) {
	const shouldFetch = await shouldFetchDataFromDb(me);
	const offlineData = !shouldFetch;

	if (!offlineData && navigator.onLine) {
		callback(false);
		return;
	}

	// If for whatever reason this is not resolved, fallback to db
	const fallbackTimeout = setTimeout(async () => {
		callback(false);
	}, 2000);

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

export async function updateOfflineHash() {
	// DB'yi IndexedDB'ye kaydet ve TAMAMLANMASINI bekle
	const dbSaved = await new Promise<boolean>((resolve) => {
		try {
			const db = getLokiDb();
			if (!db) {
				console.warn('[Offline] DB save skipped: no db instance');
				resolve(false);
				return;
			}

			const timeout = setTimeout(() => {
				console.warn('[Offline] DB save timed out after 5s');
				resolve(false);
			}, 5000);

			db.saveDatabase((err) => {
				clearTimeout(timeout);
				if (err) {
					console.error('[Offline] DB save failed:', err);
					resolve(false);
				} else {
					console.log('[Offline] DB saved successfully');
					resolve(true);
				}
			});
		} catch (e) {
			console.error('[Offline] DB save exception:', e);
			resolve(false);
		}
	});

	// DB kaydedilemezse hash'i guncelleme — tutarsizlik onlenir
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
		// Offline — hash güncellenmez, sonraki online'da tekrar denenecek
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
