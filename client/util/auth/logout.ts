import { gql } from '@apollo/client';
import { gqlMutate } from '../../components/api';

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

	window.location.href = '/welcome';
}
