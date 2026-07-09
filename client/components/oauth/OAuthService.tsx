import React, {useEffect, useState} from 'react';
import {gqlMutate} from '../api';
import {gql} from '@apollo/client';
import {useRouteMatch} from 'react-router-dom';
import {toastError} from '../../util/toast';
import {useMe} from '../../util/hooks/useMe';
import {useTranslation} from 'react-i18next';
import {LINKED_SERVICES} from '../../../shared/integration';
import {IntegrationType} from '../../../shared/integration';
import {isNativeRelayState, buildNativeRelayDeepLink, stripNativeOAuthState} from '../../util/oauth-native';
import {isNative} from '../../util/platform';
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
	const [relayLink, setRelayLink] = useState<string | null>(null);

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

		// Native relay: linking flow started from the local-bundle app; this page runs
		// in the external browser. Hand code+state back via the deep link (the shell
		// re-runs this route and unwraps the state below).
		if (!isNative() && isNativeRelayState(urlParams.get('state'))) {
			const link = buildNativeRelayDeepLink(`/oauth/${integrationType}`, urlParams);
			setRelayLink(link);
			window.location.href = link;
			return;
		}

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
				window.location.href = safeRedirectTarget(stripNativeOAuthState(urlParams.get('state')));
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
					window.location.href = safeRedirectTarget(stripNativeOAuthState(urlParams.get('state')));
					return;
				}
				toastError(msg || t('integration.oauth_error'));
				// On error also redirect — don't leave overlay stuck
				setTimeout(() => {
					window.location.href = '/account/linked-accounts';
				}, 2000);
			});
	}, []);

	if (relayLink) {
		return (
			<div
				style={{
					minHeight: '100vh',
					display: 'flex',
					flexDirection: 'column',
					alignItems: 'center',
					justifyContent: 'center',
					gap: '20px',
					background: '#12141C',
					color: '#ffffff',
					padding: '2rem',
					textAlign: 'center',
				}}
			>
				<span style={{fontSize: '1.05rem', fontWeight: 600}}>{t('common.oauth_relay_returning')}</span>
				<button
					type="button"
					onClick={() => {
						window.location.href = relayLink;
					}}
					style={{
						backgroundColor: '#6C63FF',
						color: '#ffffff',
						border: 'none',
						padding: '0.85rem 2.25rem',
						borderRadius: '10px',
						fontSize: '1rem',
						fontWeight: 600,
						cursor: 'pointer',
					}}
				>
					{t('common.oauth_relay_open_app')}
				</button>
			</div>
		);
	}

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
