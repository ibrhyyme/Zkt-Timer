import React, {useEffect, useRef, useState} from 'react';
import {gql} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import {gqlMutate} from '../api';
import {consumeAndValidateOAuthState} from '../../util/oauth_state';
import {isNativeRelayState, buildNativeRelayDeepLink} from '../../util/oauth-native';
import {isNative} from '../../util/platform';
import ZktAuthScene from '../login/zkt_auth/ZktAuthScene';

// Landing page for "sign in with Zeka Kupu Turkiye". Structurally the twin of
// WcaLoginCallback — same native relay hop, same state validation, same staged
// progress display — because it solves the same problem for the other provider.

const AUTHENTICATE_WITH_ZKT = gql`
	mutation Mutate($code: String!) {
		authenticateWithZkt(code: $code) {
			success
			needsUsername
			zktName
			zktEmail
			zktId
			sessionToken
		}
	}
`;

const STEP_COUNT = 4;
const AUTO_ADVANCE_MS = 1400;

export default function ZktLoginCallback() {
	const {t} = useTranslation();
	const [step, setStep] = useState(0);
	const [relayLink, setRelayLink] = useState<string | null>(null);
	// Set when the federation email already belongs to a password-holding
	// Zkt-Timer account. Renders an explanation instead of bouncing to /login.
	const [emailTaken, setEmailTaken] = useState<{email: string | null} | null>(null);
	// Any other failure. Rendered rather than toasted: a toast followed by a
	// redirect to /login is invisible, and left the flow looking like it simply
	// bounced the member back to the start for no reason.
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

		// The member declined on the federation's consent screen, or the request
		// was malformed. `error_description` is the federation's own wording.
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
			setFailure(tRef.current('zkt_signup.session_expired'));
			return;
		}

		// Native relay: this page is running in the EXTERNAL browser on behalf of
		// the local-bundle app. Hand code+state back over the deep link; the shell
		// re-runs this route with its own sessionStorage (and thus the stored
		// state) intact. Must run BEFORE state validation — this browser context
		// never stored one.
		if (!isNative() && isNativeRelayState(state)) {
			const link = buildNativeRelayDeepLink('/oauth/zkt/login', urlParams);
			setRelayLink(link);
			window.location.href = link;
			return;
		}

		if (!consumeAndValidateOAuthState(state)) {
			// The one-shot CSRF state did not match what this tab stored. Reloading
			// the callback URL or coming back to it later both land here, and the
			// old silent redirect made that indistinguishable from a server error.
			setFailure(tRef.current('auth_failure.state_mismatch'));
			return;
		}

		// Scrub the authorization code out of the address bar before doing anything
		// with it. It is single-use and short-lived, but until this runs it sits in
		// the browser history and in anything the member screenshots while the
		// progress steps are on screen.
		try {
			window.history.replaceState(null, '', '/oauth/zkt/login');
		} catch {
			// Non-fatal: an unsupported history API just leaves the URL as it was.
		}

		// The backend does this in a single call, so there are no real per-step
		// signals; advance on a timer and jump to the last step on the answer.
		const interval = setInterval(() => {
			setStep((s) => {
				if (advancedToFinalRef.current) return s;
				return Math.min(s + 1, STEP_COUNT - 2);
			});
		}, AUTO_ADVANCE_MS);
		setStep(1);

		gqlMutate(AUTHENTICATE_WITH_ZKT, {code})
			.then((res) => {
				const result = res?.data?.authenticateWithZkt;
				clearInterval(interval);
				advancedToFinalRef.current = true;
				setStep(STEP_COUNT - 1);

				setTimeout(() => {
					if (result?.success && !result?.needsUsername) {
						localStorage.setItem('zkt_has_auth', 'true');
						window.location.href = '/timer';
					} else if (result?.needsUsername) {
						const params = new URLSearchParams();
						if (result.zktName) params.set('name', result.zktName);
						if (result.zktEmail) params.set('email', result.zktEmail);
						if (result.zktId) params.set('zktId', result.zktId);
						window.location.href = `/zkt-signup?${params.toString()}`;
					} else {
						window.location.href = '/login';
					}
				}, 800);
			})
			.catch((e) => {
				clearInterval(interval);
				const errorMessage =
					e?.graphQLErrors?.[0]?.extensions?.exception?.message ||
					e?.graphQLErrors?.[0]?.message ||
					e?.message ||
					tRef.current('zkt_signup.session_expired');

				// Structured refusal: the member has an account, they just cannot be
				// merged into it automatically. That needs a page, not a toast.
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
				failureData={{detail: failure, provider: 'zkt'}}
			/>
		);
	}

	if (emailTaken) {
		return (
			<ZktAuthScene
				initialMode="email-taken"
				emailTakenData={{email: emailTaken.email, provider: 'zkt'}}
			/>
		);
	}

	if (relayLink) {
		// Shown in the external browser: the redirect above already fired, and the
		// button is the fallback for browsers that block scheme navigation without
		// a user gesture.
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

	return <ZktAuthScene initialMode="zkt-callback" zktStep={step} />;
}
