import React, {useEffect} from 'react';
import {gqlMutate} from '../api';
import {gql} from '@apollo/client';
import {useRouteMatch} from 'react-router-dom';
import {toastError} from '../../util/toast';
import {useMe} from '../../util/hooks/useMe';

export default function OAuthService() {
	const me = useMe();
	const match = useRouteMatch() as any;
	const integrationType = match?.params?.integrationType;

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get('code');

		const query = gql`
			mutation Mutate($code: String!, $integrationType: IntegrationType) {
				createIntegration(code: $code, integrationType: $integrationType) {
					id
				}
			}
		`;

		gqlMutate(query, {
			code,
			integrationType,
		})
			.then(() => {
				window.location.href = `/account/linked-accounts`;
			})
			.catch((e) => {
				console.error(e);
				// Extract error message from GraphQL error extensions or use the message
				const errorMessage = e?.graphQLErrors?.[0]?.extensions?.exception?.message || 
									 e?.graphQLErrors?.[0]?.message || 
									 e?.message || 
									 'OAuth bağlantısı sırasında hata oluştu';
				toastError(errorMessage);
			});
	}, []);

	return (
		<div>
			<p>Linking account...</p>
		</div>
	);
}
