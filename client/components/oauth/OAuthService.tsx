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
				const state = urlParams.get('state');
				window.location.href = state || '/account/linked-accounts';
			})
			.catch((e) => {
				const msg = e?.graphQLErrors?.[0]?.message || e?.message || '';
				// Zaten bagli ise sessizce redirect yap
				if (msg.includes('already linked')) {
					const state = urlParams.get('state');
					window.location.href = state || '/account/linked-accounts';
					return;
				}
				toastError(msg || t('integration.oauth_error'));
				// Hata durumunda da geri yonlendir — overlay takilı kalmasın
				setTimeout(() => {
					window.location.href = '/account/linked-accounts';
				}, 2000);
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
