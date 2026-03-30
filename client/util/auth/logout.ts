import { gql } from '@apollo/client';
import { gqlMutate } from '../../components/api';
import { clearOfflineData } from '../../components/layout/offline';

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
	localStorage.removeItem('rememberedEmail');
	localStorage.removeItem('wasBasicUser');
	localStorage.removeItem('offlineHash');
	clearOfflineData().catch(() => {});

	window.location.href = '/welcome';
}
