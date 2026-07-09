import { gql } from '@apollo/client';
import { gqlMutate } from '../../components/api';
import { clearOfflineData } from '../../components/layout/offline';
import { clearCachedMe } from './cached-me';
import { clearSessionToken } from './session-token';

export async function logOut() {
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
	clearOfflineData().catch(() => {});

	window.location.href = '/welcome';
}
