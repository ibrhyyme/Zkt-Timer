import React, { useEffect, useRef, useState } from 'react';
import { gql } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { gqlMutate } from '../api';
import { toastError } from '../../util/toast';
import { consumeAndValidateOAuthState } from '../../util/oauth_state';
import { isNativeRelayState, buildNativeRelayDeepLink } from '../../util/oauth-native';
import { isNative } from '../../util/platform';
import ZktAuthScene from '../login/zkt_auth/ZktAuthScene';

const AUTHENTICATE_WITH_WCA = gql`
	mutation Mutate($code: String!) {
		authenticateWithWca(code: $code) {
			success
			needsUsername
			wcaName
			wcaEmail
			wcaId
		}
	}
`;

const STEP_COUNT = 4;
const AUTO_ADVANCE_MS = 1400;

export default function WcaLoginCallback() {
	const { t } = useTranslation();
	const [step, setStep] = useState(0);
	const [relayLink, setRelayLink] = useState<string | null>(null);
	const advancedToFinalRef = useRef(false);

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get('code');
		const state = urlParams.get('state');

		if (!code) {
			toastError(t('wca_signup.session_expired'));
			window.location.href = '/login';
			return;
		}

		// Native relay: this page is running in the EXTERNAL browser on behalf of the
		// local-bundle app (state carries the zktnative marker). Hand code+state back
		// via the zkttimer:// deep link; the shell re-runs this route natively with
		// its sessionStorage (and thus the stored state) intact. Must run BEFORE the
		// state validation — this browser context has no stored state.
		if (!isNative() && isNativeRelayState(state)) {
			const link = buildNativeRelayDeepLink('/oauth/wca/login', urlParams);
			setRelayLink(link);
			window.location.href = link;
			return;
		}

		if (!consumeAndValidateOAuthState(state)) {
			toastError(t('wca_signup.session_expired'));
			setTimeout(() => {
				window.location.href = '/login';
			}, 1500);
			return;
		}

		// Auto-advance fallback: backend tek mutation yapar, gercek 4 sinyal yok.
		// 1400ms araliklarla step ilerlet, gercek sonuc geldiginde clear.
		const interval = setInterval(() => {
			setStep((s) => {
				if (advancedToFinalRef.current) return s;
				return Math.min(s + 1, STEP_COUNT - 2);
			});
		}, AUTO_ADVANCE_MS);

		// Mutation baslat → step 1 (Yetki alindi) hizla
		setStep(1);

		gqlMutate(AUTHENTICATE_WITH_WCA, { code })
			.then((res) => {
				const result = res?.data?.authenticateWithWca;
				clearInterval(interval);
				advancedToFinalRef.current = true;
				setStep(STEP_COUNT - 1);

				setTimeout(() => {
					if (result?.success && !result?.needsUsername) {
						localStorage.setItem('zkt_has_auth', 'true');
						window.location.href = '/timer';
					} else if (result?.needsUsername) {
						const params = new URLSearchParams();
						if (result.wcaName) params.set('name', result.wcaName);
						if (result.wcaEmail) params.set('email', result.wcaEmail);
						if (result.wcaId) params.set('wcaId', result.wcaId);
						window.location.href = `/wca-signup?${params.toString()}`;
					} else {
						window.location.href = '/login';
					}
				}, 800);
			})
			.catch((e) => {
				console.error('WCA login error:', e);
				clearInterval(interval);
				const errorMessage =
					e?.graphQLErrors?.[0]?.extensions?.exception?.message ||
					e?.graphQLErrors?.[0]?.message ||
					e?.message ||
					t('wca_signup.session_expired');
				toastError(errorMessage);
				setTimeout(() => {
					window.location.href = '/login';
				}, 2000);
			});

		return () => clearInterval(interval);
	}, [t]);

	if (relayLink) {
		// Relay page shown in the external browser: auto-redirect already fired above;
		// the button is the user-gesture fallback for browsers that block scheme
		// navigation without interaction.
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

	return <ZktAuthScene initialMode="wca-callback" wcaStep={step} />;
}
