import React, { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../styles/bem';
import { useKeyboardInset } from '../../../util/hooks/useKeyboardInset';
import LanguageSwitcher from '../../common/language_switcher/LanguageSwitcher';
import AuthCard, { AuthMode } from './AuthCard';
import AuthCube from './AuthCube';
import LoginPane from './LoginPane';
import SignupPane from './SignupPane';
import WcaCallbackPane from './WcaCallbackPane';
import WcaConflictPane from './WcaConflictPane';
import EmailTakenPane from './EmailTakenPane';
import AuthFailurePane from './AuthFailurePane';
import WcaSection from './WcaSection';
import ZktSection from './ZktSection';
import { useChoreography } from './useChoreography';
import './zkt_auth.scss';

const b = block('zkt-auth');

/** Room kept between the field being typed into and the top of the keyboard. */
const KEYBOARD_GAP = 16;

interface Props {
	initialMode: AuthMode;
	wcaStep?: number;
	wcaConflictData?: { ownerUsername: string | null };
	/** Progress step for the ZKT sign-in callback, mirroring wcaStep. */
	zktStep?: number;
	zktConflictData?: { ownerUsername: string | null };
	/** Payload for the shared "this email already has an account" screen. */
	emailTakenData?: { email: string | null; provider: 'wca' | 'zkt' };
	/** Reason for a sign-in that failed with no dedicated screen. */
	failureData?: { detail: string | null; provider: 'wca' | 'zkt' };
	legacyChild?: ReactNode;
	legacyTitle?: string;
}

export default function ZktAuthScene({
	initialMode,
	wcaStep = 0,
	wcaConflictData,
	zktStep = 0,
	zktConflictData,
	emailTakenData,
	failureData,
	legacyChild,
	legacyTitle,
}: Props) {
	const { t } = useTranslation();
	const [mode, setMode] = useState<AuthMode>(initialMode);
	const choreography = useChoreography();
	const rootRef = useRef<HTMLDivElement>(null);
	const keyboardInset = useKeyboardInset();

	// A soft keyboard is drawn over the bottom of the screen without the page getting any
	// shorter (iOS always, and the app on both platforms). The card was centred in a
	// screen-tall page that did not scroll, so on a phone the size of an iPhone 15 the
	// password field sat entirely under the keyboard and nothing could bring it up. While
	// the keyboard is open the page scrolls, has the keyboard's height of room under the
	// card (the `--keyboard` modifier), and the field being typed into is kept in the
	// strip above the keyboard.
	useEffect(() => {
		const root = rootRef.current;
		if (!root) return undefined;
		if (keyboardInset <= 0) {
			root.scrollTop = 0;
			return undefined;
		}

		const reveal = (target: EventTarget | null) => {
			if (!(target instanceof HTMLElement) || !root.contains(target)) return;
			if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
			const top = (window.visualViewport?.offsetTop || 0) + KEYBOARD_GAP;
			const bottom = window.innerHeight - keyboardInset - KEYBOARD_GAP;
			const rect = target.getBoundingClientRect();
			if (rect.top >= top && rect.bottom <= bottom) return;
			// Into the middle of the visible strip, so the field after it shows too.
			root.scrollBy({ top: rect.top + rect.height / 2 - (top + bottom) / 2, behavior: 'smooth' });
		};

		// The keyboard just opened: the field that opened it. A frame later, so the room
		// under the card is laid out before anything is measured.
		const frame = requestAnimationFrame(() => reveal(document.activeElement));
		// Moving to the next field keeps the keyboard up, so focus is the signal there.
		const onFocus = (event: FocusEvent) => {
			requestAnimationFrame(() => reveal(event.target));
		};
		root.addEventListener('focusin', onFocus);
		return () => {
			cancelAnimationFrame(frame);
			root.removeEventListener('focusin', onFocus);
		};
	}, [keyboardInset]);

	// `mode` is state because the login/signup tabs flip it from inside. That
	// makes `initialMode` a first-render-only value, which silently broke every
	// caller that swaps screens by re-rendering this component with a new one:
	// the OAuth callbacks render <ZktAuthScene initialMode="zkt-callback"> and
	// then, on failure, <ZktAuthScene initialMode="auth-failure">. React reuses
	// the instance, the state keeps the old mode, and the error screen never
	// appears — the flow just sits on the progress steps forever.
	useEffect(() => {
		setMode(initialMode);
	}, [initialMode]);

	// URL sync for login/signup tab toggle — replaceState (no back-stack churn)
	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (mode === 'login' || mode === 'signup') {
			const target = `/${mode}`;
			if (window.location.pathname !== target) {
				window.history.replaceState(null, '', target);
			}
		}
	}, [mode]);

	// Browser back/forward sync mode to URL
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onPop = () => {
			const path = window.location.pathname;
			if (path.startsWith('/login')) setMode('login');
			else if (path.startsWith('/signup')) setMode('signup');
		};
		window.addEventListener('popstate', onPop);
		return () => window.removeEventListener('popstate', onPop);
	}, []);

	const handleModeChange = useCallback(
		(m: AuthMode) => {
			setMode(m);
			choreography.resetChaos();
		},
		[choreography]
	);

	const cardWrapClass = [
		b('stage-card-wrap').toString(),
		choreography.slideStage === 'leave' && 'is-slide-up',
		choreography.isShaking && 'is-shaking',
	]
		.filter(Boolean)
		.join(' ');

	let body: ReactNode;
	if (mode === 'login') {
		body = (
			<LoginPane
				onFieldFill={choreography.onFieldFill}
				onSubmitSuccess={choreography.onSubmitSuccess}
				onSubmitError={choreography.onSubmitError}
			/>
		);
	} else if (mode === 'signup') {
		body = (
			<SignupPane
				onFieldFill={choreography.onFieldFill}
				onSubmitSuccess={choreography.onSubmitSuccess}
				onSubmitError={choreography.onSubmitError}
			/>
		);
	} else if (mode === 'wca-callback') {
		body = <WcaCallbackPane activeStep={wcaStep} />;
	} else if (mode === 'wca-conflict') {
		body = <WcaConflictPane ownerUsername={wcaConflictData?.ownerUsername ?? null} />;
	} else if (mode === 'zkt-callback') {
		body = <WcaCallbackPane activeStep={zktStep} provider="zkt" />;
	} else if (mode === 'email-taken') {
		body = (
			<EmailTakenPane
				email={emailTakenData?.email ?? null}
				provider={emailTakenData?.provider ?? 'zkt'}
			/>
		);
	} else if (mode === 'auth-failure') {
		body = (
			<AuthFailurePane
				detail={failureData?.detail ?? null}
				provider={failureData?.provider ?? 'zkt'}
			/>
		);
	} else if (mode === 'zkt-conflict') {
		body = <WcaConflictPane ownerUsername={zktConflictData?.ownerUsername ?? null} provider="zkt" />;
	} else {
		body = legacyChild;
	}

	const isFormMode = mode === 'login' || mode === 'signup';

	return (
		<div
			ref={rootRef}
			className={b({ keyboard: keyboardInset > 0 })}
			style={{ '--keyboard-h': `${keyboardInset}px` } as React.CSSProperties}
			data-mode={mode}
		>
			{/* Background — orb ambient layer */}
			<div className={b('bg')} aria-hidden="true">
				<div className={b('bg-orb', { variant: 'a' })} />
				<div className={b('bg-orb', { variant: 'b' })} />
			</div>

			{/* Language switcher — sayfa sag ust kosesi */}
			<div className={b('lang-floating')}>
				<LanguageSwitcher />
			</div>

			{/* Timer reveal (post-success) */}
			<div className={b('timer-reveal', { on: choreography.slideStage === 'leave' })}>
				<div className={b('timer-reveal-inner')}>
					<div className={b('timer-reveal-hint')}>{t('zkt_auth.timer_reveal_hint')}</div>
					<div className={b('timer-reveal-num')}>0.00</div>
					<div className={b('timer-reveal-event')}>{t('zkt_auth.timer_event_label')}</div>
				</div>
			</div>

			{/* Cube — login/signup mode'larinda DOM'da hep render edilir.
			    Mobilde CSS (zkt_auth.scss) display:none ile gizler ve AuthCube
			    icindeki mobile guard Three.js init'i atlar — bundle/perf
			    tasarrufu korunur, layout JS state degisikligi olmadan stabil.
			    WCA callback ve legacy modlarda cube YOK. */}
			{(mode === 'login' || mode === 'signup') && (
				<div className={b('stage-cube')}>
					<AuthCube
						chaos={choreography.chaos}
						solvedGlow={choreography.solvedGlow}
						resetSignal={choreography.resetSignal}
						size={560}
					/>
				</div>
			)}

			{/* Card stage */}
			<div className={cardWrapClass}>
				{mode === 'legacy' ? (
					<div className={b('card')}>
						{legacyTitle && <h1 className={b('title')}>{legacyTitle}</h1>}
						<div className={b('mode-stage')}>
							<div className={b('mode-pane')}>{legacyChild}</div>
						</div>
					</div>
				) : (
					<AuthCard mode={mode} setMode={handleModeChange}>
						{isFormMode && (
							<>
								{/* ZKT first: it is the identity the federation issues now,
								    and the one a Turkish competitor's results hang off.
								    WCA keeps the divider so the pair reads as one block. */}
								<ZktSection
									onTrigger={choreography.onWcaTrigger}
									mode={mode === 'signup' ? 'signup' : 'login'}
								/>
								<WcaSection
									onTrigger={choreography.onWcaTrigger}
									mode={mode === 'signup' ? 'signup' : 'login'}
								/>
							</>
						)}
						{body}
					</AuthCard>
				)}
			</div>
		</div>
	);
}
