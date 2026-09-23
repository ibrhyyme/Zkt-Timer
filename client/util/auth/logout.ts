import { gql } from '@apollo/client';
import { gqlMutate } from '../../components/api';
import { clearOfflineData } from '../../components/layout/offline';
import { clearCachedMe } from './cached-me';
import { clearSessionToken } from './session-token';
import { clearAllSolveTombstones } from '../solve-tombstones';
import { requestQueueFlush } from '../offline-sync';
import { clearAccountCaches } from './clear-account-cache';
import { cancelPersist } from '../../db/persist';

// Logout must not hang on a sync that never settles
const LOGOUT_FLUSH_TIMEOUT_MS = 10_000;

export async function logOut() {
	// Whatever is still queued goes out while this session can still authenticate it. The
	// local database is wiped below, so anything left unsent is gone for good after this.
	await Promise.race([
		requestQueueFlush('logout').catch(() => {}),
		new Promise((resolve) => setTimeout(resolve, LOGOUT_FLUSH_TIMEOUT_MS)),
	]);

	const query = gql`
		mutation Mutate {
			logOut {
				id
			}
		}
	`;

	await gqlMutate(query);

	// Offline auth flag'ini temizle
	localStorage.removeItem('zkt_has_auth');
	clearCachedMe();
	// Native Bearer token (Faz 2): revoke happened server-side in the mutation above;
	// drop the local copy too.
	await clearSessionToken().catch(() => {});
	localStorage.removeItem('rememberedEmail');
	localStorage.removeItem('wasBasicUser');
	localStorage.removeItem('offlineHash');
	// Tombstones are per-account: the next account on this browser must not inherit
	// deletions it never made.
	clearAllSolveTombstones();
	await clearAccountCaches();
	// A save still scheduled would write this account's data back into the database
	// that is about to be deleted.
	cancelPersist();
	clearOfflineData().catch(() => {});

	window.location.href = '/welcome';
}
