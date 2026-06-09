import React, {useEffect, useState} from 'react';
import {gqlMutate} from '../api';
import {gql} from '@apollo/client';
import {useRouteMatch} from 'react-router-dom';
import {toastError} from '../../util/toast';
import {useMe} from '../../util/hooks/useMe';
import {useTranslation} from 'react-i18next';
import {LINKED_SERVICES} from '../../../shared/integration';
import {IntegrationType} from '../../../shared/integration';
import ZktAuthScene from '../login/zkt_auth/ZktAuthScene';

interface ConflictData {
	ownerUsername: string | null;
}

export default function OAuthService() {
	const me = useMe();
	const {t} = useTranslation();
	const match = useRouteMatch() as any;
	const integrationType = match?.params?.integrationType as IntegrationType;
	const service = LINKED_SERVICES[integrationType];
	const [conflict, setConflict] = useState<ConflictData | null>(null);

	// Only allow internal-path redirects from the OAuth `state` param — an attacker can craft
	// the authorize URL with state=https://evil.com (or javascript:...) and the victim's own
	// consent round-trips it back here. Reject anything that isn't a same-origin path.
	function safeRedirectTarget(state: string | null): string {
		const fallback = '/account/linked-accounts';
		if (!state || !state.startsWith('/') || state.startsWith('//')) {
			return fallback;
		}
		return state;
	}

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
				window.location.href = safeRedirectTarget(urlParams.get('state'));
			})
			.catch((e) => {
				const msg = e?.graphQLErrors?.[0]?.message || e?.message || '';

				// Structured conflict payload — show dedicated scene, don't redirect
				try {
					const parsed = JSON.parse(msg);
					if (parsed?.code === 'WCA_ACCOUNT_ALREADY_LINKED') {
						setConflict({ownerUsername: parsed.ownerUsername ?? null});
						return;
					}
				} catch {
					// Not JSON, continue to normal toast path
				}

				// If already linked, silently redirect
				if (msg.includes('already linked')) {
					window.location.href = safeRedirectTarget(urlParams.get('state'));
					return;
				}
				toastError(msg || t('integration.oauth_error'));
				// On error also redirect — don't leave overlay stuck
				setTimeout(() => {
					window.location.href = '/account/linked-accounts';
				}, 2000);
			});
	}, []);

	if (conflict) {
		return <ZktAuthScene initialMode="wca-conflict" wcaConflictData={conflict} />;
	}

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
