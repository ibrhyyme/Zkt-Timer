import React, {useEffect, useState} from 'react';
import {Link, useHistory, useLocation} from 'react-router-dom';
import {Eye, EyeSlash} from 'phosphor-react';
import {validateStrongPassword} from '../../../util/auth/password';
import {gql, useMutation} from '@apollo/client';
import {useInput} from '../../../util/hooks/useInput';
import {getRedirectLink} from '../../../util/auth/login';
import {UserAccount} from '../../../@types/generated/graphql';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import NeonOtpInput, {OtpStatus} from '../neon_auth/NeonOtpInput';
import NeonSuccessCheck from '../neon_auth/NeonSuccessCheck';

const z = block('zkt-auth');
const n = block('neon-auth');

const OTP_LENGTH = 6;

type ForgotStage = 'email' | 'code' | 'reset';

function readStageFromSearch(search: string): {stage: ForgotStage; email: string} {
	const params = new URLSearchParams(search);
	const rawStage = params.get('step');
	const email = params.get('email') || '';
	const stage: ForgotStage = rawStage === 'code' || rawStage === 'reset' ? rawStage : 'email';
	return {stage, email};
}

function maskEmail(email: string): string {
	return email.replace(/(.{2}).*(@.*)/, '$1•••$2');
}

const SENT_FORGOT_PASSWORD_CODE_MUTATION = gql`
	mutation Mutate($email: String!, $language: String) {
		sendForgotPasswordCode(email: $email, language: $language)
	}
`;

const CHECK_FORGOT_PASSWORD_CODE = gql`
	mutation Mutate($email: String!, $code: String!) {
		checkForgotPasswordCode(email: $email, code: $code)
	}
`;

const UPDATE_FORGOT_PASSWORD_MUTATION = gql`
	mutation Mutate($email: String!, $code: String!, $password: String!) {
		updateForgotPassword(email: $email, code: $code, password: $password) {
			id
		}
	}
`;

export default function Forgot() {
	const {t, i18n} = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const urlState = readStageFromSearch(location.search);

	const [stage, setStageInternal] = useState<ForgotStage>(urlState.stage);
	const [code, setCode] = useState('');
	const [email, setEmail] = useInput(urlState.email);
	const [newPassword, setNewPassword] = useInput('');
	const [confirmPassword, setConfirmPassword] = useInput('');
	const [showPw, setShowPw] = useState(false);
	const [error, setError] = useState('');
	const [status, setStatus] = useState<OtpStatus>('idle');
	const [focusKey, setFocusKey] = useState(0);
	const [resend, setResend] = useState(30);
	const [codeVerified, setCodeVerified] = useState(false);
	const [done, setDone] = useState(false);

	// URL degisirse stage'i yansit (back/forward butonu, deeplink)
	useEffect(() => {
		const next = readStageFromSearch(location.search);
		setStageInternal(next.stage);
		if (next.email && next.email !== email) {
			setEmail({target: {value: next.email}} as any);
		}
		// Reset stage'i ama kod yok — code stage'ine dus (sayfa yenilemede kod kaybolur)
		if (next.stage === 'reset' && !code) {
			navigateToStage('code', next.email);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [location.search]);

	function navigateToStage(next: ForgotStage, mail?: string) {
		const params = new URLSearchParams();
		if (next !== 'email') {
			params.set('step', next);
			if (mail) params.set('email', mail);
		}
		const search = params.toString();
		history.push({pathname: '/forgot', search: search ? `?${search}` : ''});
	}

	function setStage(next: ForgotStage) {
		navigateToStage(next, email.trim());
	}

	const [forgotCode, forgotCodeData] = useMutation<{sendForgotPasswordCode: void}, {email: string; language: string}>(
		SENT_FORGOT_PASSWORD_CODE_MUTATION
	);
	const [checkForgot] = useMutation<{checkForgotPasswordCode: void}, {email: string; code: string}>(
		CHECK_FORGOT_PASSWORD_CODE
	);
	const [updatePass, updatePassData] = useMutation<
		{updateForgotPassword: UserAccount},
		{email: string; code: string; password: string}
	>(UPDATE_FORGOT_PASSWORD_MUTATION);

	// resend countdown (only on the code step)
	useEffect(() => {
		if (stage !== 'code') return;
		if (resend <= 0) return;
		const id = setTimeout(() => setResend((r) => r - 1), 1000);
		return () => clearTimeout(id);
	}, [stage, resend]);

	async function sendCodeStage(e: React.FormEvent) {
		e.preventDefault();
		if (forgotCodeData.loading) return;
		if (!email.trim()) {
			setError(t('forgot.enter_email_error'));
			return;
		}
		setError('');
		try {
			await forgotCode({variables: {email: email.trim(), language: i18n.language}});
			setCode('');
			setStatus('idle');
			setResend(30);
			setFocusKey((k) => k + 1);
			setStage('code');
		} catch (err) {
			setError(err.message);
		}
	}

	async function runCheck(full: string) {
		setStatus('verifying');
		setError('');
		try {
			await checkForgot({variables: {email: email.trim(), code: full}});
			setCode(full); // keep — needed for updateForgotPassword on the reset stage
			// hold the merged/verifying state so the gooey band animation is visible
			await new Promise((r) => setTimeout(r, 750));
			// confirm with the neon ✓ before moving on to the new-password stage
			setStatus('success');
			setCodeVerified(true);
			await new Promise((r) => setTimeout(r, 950));
			setCodeVerified(false);
			setStatus('idle');
			setStage('reset');
		} catch (err) {
			await new Promise((r) => setTimeout(r, 500));
			setStatus('error');
			setTimeout(() => {
				setCode('');
				setStatus('idle');
				setFocusKey((k) => k + 1);
			}, 800);
		}
	}

	function onCodeChange(next: string) {
		if (status === 'verifying' || status === 'success') return;
		setCode(next);
		if (status === 'error') setStatus('idle');
	}

	async function doResend() {
		if (resend > 0) return;
		try {
			await forgotCode({variables: {email: email.trim(), language: i18n.language}});
			setResend(30);
			setCode('');
			setStatus('idle');
			setFocusKey((k) => k + 1);
		} catch (err) {
			setError(err.message);
		}
	}

	async function submitReset(e: React.FormEvent) {
		e.preventDefault();
		if (updatePassData.loading) return;
		const validate = validateStrongPassword(newPassword, confirmPassword);
		if (!validate.isStrong) {
			setError(validate.errorMessage);
			return;
		}
		setError('');
		try {
			await updatePass({variables: {email: email.trim(), code, password: newPassword}});
			localStorage.setItem('zkt_has_auth', 'true');
			setDone(true);
			setTimeout(() => {
				window.location.href = getRedirectLink();
			}, 1200);
		} catch (err) {
			setError(err.message);
		}
	}

	const validation = validateStrongPassword(newPassword, confirmPassword);
	const pwScore = [validation.char8Check, validation.cap1Check, validation.lower1Check, validation.number1Check].filter(
		Boolean
	).length;
	const pwLevels = t('otp.pw_levels', {returnObjects: true}) as unknown as string[];

	// ───── DONE (password updated) ─────
	if (done) {
		return (
			<div className={n('done').toString()}>
				<p className={z('subtitle').toString()}>{t('otp.password_updated')}</p>
				<NeonSuccessCheck size={96} />
			</div>
		);
	}

	// ───── Stage 1: Email ─────
	if (stage === 'email') {
		return (
			<form className={z('form').toString()} onSubmit={sendCodeStage}>
				<p className={z('subtitle').toString()}>{t('otp.forgot_email_sub')}</p>

				<label className={z('field').toString()}>
					<span className={z('field-label').toString()}>{t('forgot.email')}</span>
					<input
						className={z('input').toString()}
						type="email"
						value={email}
						onChange={setEmail}
						placeholder={t('forgot.email_placeholder')}
						autoFocus
					/>
				</label>

				{error && (
					<div className={z('banner').toString()}>
						<span className={z('banner-dot').toString()} />
						{error}
					</div>
				)}

				<button type="submit" className={z('btn', {primary: true}).toString()} disabled={forgotCodeData.loading}>
					{forgotCodeData.loading ? <span className={z('btn-spinner').toString()} /> : t('forgot.send_code')}
				</button>

				<div className={z('form-actions').toString()}>
					<Link to="/login" className={z('link').toString()}>
						{t('forgot.login_link')}
					</Link>
					<Link to="/signup" className={z('link').toString()}>
						{t('forgot.signup_link')}
					</Link>
				</div>
			</form>
		);
	}

	// ───── Stage 2: Code ─────
	if (stage === 'code') {
		if (codeVerified) {
			return (
				<div className={n('done').toString()}>
					<p className={z('subtitle').toString()}>{t('otp.code_verified')}</p>
					<NeonSuccessCheck size={96} />
				</div>
			);
		}
		return (
			<div className={n('stack').toString()}>
				<p className={z('subtitle').toString()}>
					<strong className={n('sub-strong').toString()}>{maskEmail(email.trim())}</strong> {t('forgot.check_email')}{' '}
					{t('otp.auto_verify_hint')}
				</p>

				<NeonOtpInput
					value={code}
					onChange={onCodeChange}
					onComplete={runCheck}
					length={OTP_LENGTH}
					status={status}
					focusKey={focusKey}
					size="lg"
					ariaLabel={t('forgot.verification_code')}
				/>

				<div className={n('status', {verifying: status === 'verifying'}).toString()}>
					{status === 'verifying' && (
						<>
							<span className={z('btn-spinner').toString()} /> {t('otp.verifying')}
						</>
					)}
					{status === 'error' && <span className={n('err').toString()}>{t('otp.error_retry')}</span>}
					{status === 'idle' && (
						<span className={n('resend').toString()}>
							{t('otp.didnt_get_code')}{' '}
							<button type="button" className={n('resend-btn').toString()} onClick={doResend} disabled={resend > 0}>
								{resend > 0 ? t('otp.resend_in', {seconds: resend}) : t('otp.resend')}
							</button>
						</span>
					)}
				</div>

				<button type="button" className={z('link').toString()} onClick={() => setStage('email')}>
					{t('forgot.back')}
				</button>
			</div>
		);
	}

	// ───── Stage 3: New Password ─────
	return (
		<form className={z('form').toString()} onSubmit={submitReset}>
			<p className={z('subtitle').toString()}>{t('forgot.set_new_password')}</p>

			<label className={z('field').toString()}>
				<span className={z('field-label').toString()}>{t('forgot.new_password')}</span>
				<div className={z('input-wrap').toString()}>
					<input
						className={z('input').toString()}
						type={showPw ? 'text' : 'password'}
						value={newPassword}
						onChange={setNewPassword}
						placeholder={t('forgot.new_password_placeholder')}
						autoFocus
					/>
					<button
						type="button"
						className={z('eye').toString()}
						onClick={() => setShowPw((s) => !s)}
						aria-label={t('forgot.new_password')}
					>
						{showPw ? <EyeSlash size={20} weight="bold" /> : <Eye size={20} weight="bold" />}
					</button>
				</div>
			</label>

			{/* strength meter */}
			<div className={n('pw-meter').toString()} data-score={pwScore}>
				<div className={n('pw-bars').toString()}>
					{[0, 1, 2, 3].map((i) => (
						<span key={i} className={n('pw-bar').toString()} data-on={i < pwScore ? 'true' : 'false'} />
					))}
				</div>
				{newPassword && <span className={n('pw-label').toString()}>{pwLevels[pwScore]}</span>}
			</div>

			<label className={z('field').toString()}>
				<span className={z('field-label').toString()}>{t('forgot.confirm_password')}</span>
				<input
					className={z('input').toString()}
					type={showPw ? 'text' : 'password'}
					value={confirmPassword}
					onChange={setConfirmPassword}
					placeholder={t('forgot.confirm_password_placeholder')}
				/>
			</label>

			{error && (
				<div className={z('banner').toString()}>
					<span className={z('banner-dot').toString()} />
					{error}
				</div>
			)}

			<button type="submit" className={z('btn', {primary: true}).toString()} disabled={updatePassData.loading}>
				{updatePassData.loading ? <span className={z('btn-spinner').toString()} /> : t('forgot.change_password')}
			</button>

			<button type="button" className={z('link').toString()} onClick={() => setStage('code')}>
				{t('forgot.back')}
			</button>
		</form>
	);
}
