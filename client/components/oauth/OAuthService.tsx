import React, {useEffect} from 'react';
import {gqlMutate} from '../api';
import {gql} from '@apollo/client';
import {useRouteMatch} from 'react-router-dom';
import {toastError} from '../../util/toast';
import {useMe} from '../../util/hooks/useMe';
import {useTranslation} from 'react-i18next';
import {LINKED_SERVICES} from '../../../shared/integration';
import {IntegrationType} from '../../../shared/integration';

export default function OAuthService() {
	const me = useMe();
	const {t} = useTranslation();
	const match = useRouteMatch() as any;
	const integrationType = match?.params?.integrationType as IntegrationType;
	const service = LINKED_SERVICES[integrationType];

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
				const errorMessage = e?.graphQLErrors?.[0]?.extensions?.exception?.message ||
									 e?.graphQLErrors?.[0]?.message ||
									 e?.message ||
									 'OAuth bağlantısı sırasında hata oluştu';
				toastError(errorMessage);
			});
	}, []);

	return (
		<div
			style={{
				position: 'fixed',
				top: 0,
				left: 0,
				right: 0,
				bottom: 0,
				backgroundColor: 'rgba(0, 0, 0, 0.7)',
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center',
				justifyContent: 'center',
				zIndex: 9999,
				gap: '16px',
			}}
		>
			{service && (
				<img
					src={service.logoSrc}
					alt={service.name}
					style={{width: '48px', height: '48px'}}
				/>
			)}
			<span style={{color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem'}}>
				{t('integration.linking_account')}
			</span>
		</div>
	);
}
