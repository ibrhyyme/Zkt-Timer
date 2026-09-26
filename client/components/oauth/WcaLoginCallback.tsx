import React, { useEffect, useRef, useState } from 'react';
import { gql } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { gqlMutate } from '../api';
import { consumeAndValidateOAuthState } from '../../util/oauth_state';
import { isNativeRelayState, buildNativeRelayDeepLink } from '../../util/oauth-native';
import { isNative } from '../../util/platform';
import { storePendingSignupToken } from '../../util/auth/pending-signup';
import ZktAuthScene from '../login/zkt_auth/ZktAuthScene';

const AUTHENTICATE_WITH_WCA = gql`
	mutation Mutate($code: String!) {
		authenticateWithWca(code: $code) {
			success
			needsUsername
			wcaName
			wcaEmail
			wcaId
			sessionToken
			pendingToken
		}
	}
`;

const STEP_COUNT = 4;
const AUTO_ADVANCE_MS = 1400;

export default function WcaLoginCallback() {
	const { t } = useTranslation();
	const [step, setStep] = useState(0);
	const [relayLink, setRelayLink] = useState<string | null>(null);
	// Same refusal as the ZKT flow: a password-holding account with this email
	// must link manually, and that has to be explained rather than toasted.
	const [emailTaken, setEmailTaken] = useState<{email: string | null} | null>(null);
	// Same reasoning as the ZKT callback: show the reason instead of toasting it
	// and redirecting, which read as an unexplained bounce back to /login.
	const [failure, setFailure] = useState<string | null>(null);
	const advancedToFinalRef = useRef(false);
	// `t` in a ref, and the effect below runs on an EMPTY dependency list.
	//
	// It used to depend on [t], which looks harmless and is not: i18next swaps
	// the function identity once the locale bundle finishes loading, so the
	// effect ran a SECOND time. By then the one-shot OAuth state had already been
	// consumed by the first run, so the re-run failed its CSRF check and painted
	// "session mismatch" over whatever the real result was. The exchange itself
	// had succeeded — the screen was lying about it.
	const tRef = useRef(t);
	tRef.current = t;

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get('code');
		const state = urlParams.get('state');

		const oauthError = urlParams.get('error');
		if (oauthError) {
			// `access_denied` is not a fault, it is the member pressing "Vazgeç" on
			// the consent screen. Echoing the RFC code back at them would show a
			// technical string for a decision they made on purpose.
			setFailure(
				oauthError === 'access_denied'
					? tRef.current('auth_failure.access_denied')
					: urlParams.get('error_description') || oauthError
			);
			return;
		}
		if (!code) {
			setFailure(tRef.current('wca_signup.session_expired'));
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
			setFailure(tRef.current('auth_failure.state_mismatch'));
			return;
		}

		// Auto-advance fallback: backend tek mutation yapar, gercek 4 sinyal yok.
		// 1400ms araliklarla step ilerlet, gercek sonuc geldiginde clear.
		// Scrub the authorization code out of the address bar before doing anything
		// with it. It is single-use and short-lived, but until this runs it sits in
		// the browser history and in anything the member screenshots while the
		// progress steps are on screen.
		try {
			window.history.replaceState(null, '', '/oauth/wca/login');
		} catch {
			// Non-fatal: an unsupported history API just leaves the URL as it was.
		}

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
						// Native only (null on web, which clears any leftover): iOS
						// drops the pending cookie, the username page sends this instead.
						storePendingSignupToken('wca', result.pendingToken);
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
					tRef.current('wca_signup.session_expired');

				try {
					const parsed = JSON.parse(errorMessage);
					if (parsed?.code === 'EMAIL_ALREADY_REGISTERED') {
						setEmailTaken({email: parsed.email ?? null});
						return;
					}
				} catch {
					// Not JSON — fall through to the generic toast below.
				}

				setFailure(errorMessage);
			});

		return () => clearInterval(interval);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (failure) {
		return (
			<ZktAuthScene
				initialMode="auth-failure"
				failureData={{detail: failure, provider: 'wca'}}
			/>
		);
	}

	if (emailTaken) {
		return (
			<ZktAuthScene
				initialMode="email-taken"
				emailTakenData={{email: emailTaken.email, provider: 'wca'}}
			/>
		);
	}

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
