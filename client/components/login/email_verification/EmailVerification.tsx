import React, {useEffect, useState} from 'react';
import {gql, useMutation} from '@apollo/client';
import {getRedirectLink} from '../../../util/auth/login';
import {UserAccount} from '../../../@types/generated/graphql';
import {useTranslation} from 'react-i18next';
import block from '../../../styles/bem';
import NeonOtpInput, {OtpStatus} from '../neon_auth/NeonOtpInput';
import NeonSuccessCheck from '../neon_auth/NeonSuccessCheck';

const z = block('zkt-auth');
const n = block('neon-auth');

const OTP_LENGTH = 6;

const VERIFY_EMAIL_CODE_MUTATION = gql`
	mutation Mutate($email: String!, $code: String!, $language: String) {
		verifyEmailCode(email: $email, code: $code, language: $language) {
			id
		}
	}
`;

const RESEND_EMAIL_VERIFICATION_CODE_MUTATION = gql`
	mutation Mutate($email: String!, $language: String) {
		resendEmailVerificationCode(email: $email, language: $language)
	}
`;

function maskEmail(email: string): string {
	return email.replace(/(.{2}).*(@.*)/, '$1•••$2');
}

export default function EmailVerification() {
	const {t, i18n} = useTranslation();
	const [code, setCode] = useState('');
	const [status, setStatus] = useState<OtpStatus>('idle');
	const [focusKey, setFocusKey] = useState(0);
	const [error, setError] = useState('');
	const [resend, setResend] = useState(30);
	const [resent, setResent] = useState(false);

	const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
	const email = urlParams?.get('email') || '';

	const [verifyCode] = useMutation<{verifyEmailCode: UserAccount}, {email: string; code: string; language: string}>(
		VERIFY_EMAIL_CODE_MUTATION
	);
	const [resendCode] = useMutation<{resendEmailVerificationCode: void}, {email: string; language: string}>(
		RESEND_EMAIL_VERIFICATION_CODE_MUTATION
	);

	// resend countdown
	useEffect(() => {
		if (resend <= 0) return;
		const id = setTimeout(() => setResend((r) => r - 1), 1000);
		return () => clearTimeout(id);
	}, [resend]);

	async function runVerify(full: string) {
		setStatus('verifying');
		setError('');
		try {
			await verifyCode({variables: {email, code: full, language: i18n.language}});
			// hold the merged/verifying band briefly before the success screen
			await new Promise((r) => setTimeout(r, 850));
			setStatus('success');
			localStorage.setItem('zkt_has_auth', 'true');
			setTimeout(() => {
				window.location.href = getRedirectLink();
			}, 1200);
		} catch (e) {
			await new Promise((r) => setTimeout(r, 500));
			setStatus('error');
			setError(e.message);
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
		if (status === 'error') {
			setStatus('idle');
			setError('');
		}
	}

	async function handleResend() {
		if (resend > 0) return;
		try {
			await resendCode({variables: {email, language: i18n.language}});
			setResend(30);
			setCode('');
			setStatus('idle');
			setError('');
			setFocusKey((k) => k + 1);
			setResent(true);
			setTimeout(() => setResent(false), 4000);
		} catch (e) {
			setError(e.message);
		}
	}

	if (!email) {
		return null;
	}

	if (status === 'success') {
		return (
			<div className={n('done').toString()}>
				<p className={z('subtitle').toString()}>{t('otp.email_verified')}</p>
				<NeonSuccessCheck size={96} />
			</div>
		);
	}

	return (
		<div className={n('stack').toString()}>
			<p className={z('subtitle').toString()}>
				<strong className={n('sub-strong').toString()}>{maskEmail(email)}</strong> {t('email_verification.check_email')}{' '}
				{t('otp.auto_verify_hint')}
			</p>

			<NeonOtpInput
				value={code}
				onChange={onCodeChange}
				onComplete={runVerify}
				length={OTP_LENGTH}
				status={status}
				focusKey={focusKey}
				size="lg"
				ariaLabel={t('email_verification.verification_code')}
			/>

			<div className={n('status', {verifying: status === 'verifying'}).toString()}>
				{status === 'verifying' && (
					<>
						<span className={z('btn-spinner').toString()} /> {t('otp.verifying')}
					</>
				)}
				{status === 'error' && <span className={n('err').toString()}>{error || t('otp.error_retry')}</span>}
				{status === 'idle' &&
					(resent ? (
						<span className={n('resent').toString()}>{t('email_verification.code_resent')}</span>
					) : (
						<span className={n('resend').toString()}>
							{t('otp.didnt_get_code')}{' '}
							<button type="button" className={n('resend-btn').toString()} onClick={handleResend} disabled={resend > 0}>
								{resend > 0 ? t('otp.resend_in', {seconds: resend}) : t('otp.resend')}
							</button>
						</span>
					))}
			</div>
		</div>
	);
}
