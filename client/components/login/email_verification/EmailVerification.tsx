import React, {useState} from 'react';
import {gql, useMutation} from '@apollo/client';
import {useInput} from '../../../util/hooks/useInput';
import {getRedirectLink} from '../../../util/auth/login';
import {UserAccount} from '../../../@types/generated/graphql';
import {useTranslation} from 'react-i18next';

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

export default function EmailVerification() {
	const {t, i18n} = useTranslation();
	const [code, setCode] = useInput('');
	const [error, setError] = useState('');
	const [resent, setResent] = useState(false);

	const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
	const email = urlParams?.get('email') || '';

	const [verifyCode, verifyCodeData] = useMutation<{verifyEmailCode: UserAccount}, {email: string; code: string; language: string}>(
		VERIFY_EMAIL_CODE_MUTATION
	);

	const [resendCode, resendCodeData] = useMutation<{resendEmailVerificationCode: void}, {email: string; language: string}>(
		RESEND_EMAIL_VERIFICATION_CODE_MUTATION
	);

	const loading = verifyCodeData?.loading || resendCodeData?.loading;

	async function handleVerify(e) {
		e.preventDefault();
		setError('');

		if (loading) return;

		if (!code.trim()) {
			setError(t('email_verification.enter_code_error'));
			return;
		}

		try {
			await verifyCode({variables: {email, code: code.trim(), language: i18n.language}});
			localStorage.setItem('zkt_has_auth', 'true');
			window.location.href = getRedirectLink();
		} catch (e) {
			setError(e.message);
		}
	}

	async function handleResend() {
		if (loading) return;
		try {
			await resendCode({variables: {email, language: i18n.language}});
			setResent(true);
			setTimeout(() => setResent(false), 5000);
		} catch (e) {
			setError(e.message);
		}
	}

	if (!email) {
		return null;
	}

	return (
		<div className="space-y-4">
			<div className="text-center mb-4">
				<p className="text-sm" style={{color: 'rgba(255, 255, 255, 0.7)'}}>
					{t('email_verification.check_email')}
				</p>
			</div>

			<form onSubmit={handleVerify} className="space-y-4">
				<div>
					<label
						htmlFor="verificationCode"
						className="block text-sm mb-1"
						style={{color: 'rgba(255, 255, 255, 0.7)'}}
					>
						{t('email_verification.verification_code')}
					</label>
					<input
						id="verificationCode"
						type="text"
						value={code}
						onChange={setCode}
						placeholder={t('email_verification.code_placeholder')}
						maxLength={6}
						autoComplete="one-time-code"
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition text-center text-lg tracking-widest"
						style={{
							backgroundColor: 'rgba(255, 255, 255, 0.05)',
							borderColor: 'rgba(255, 255, 255, 0.1)',
							color: '#ffffff',
						} as React.CSSProperties}
					/>
				</div>

				{error && <div className="mt-1 text-xs text-rose-300">{error}</div>}

				<button
					type="submit"
					disabled={loading || !code.trim()}
					className="w-full h-11 rounded-2xl font-semibold text-white disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:brightness-95 transition relative overflow-hidden"
					style={{
						background: 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%)',
						boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)',
					}}
				>
					{loading ? (
						<div className="flex items-center justify-center">
							<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
						</div>
					) : (
						t('email_verification.verify_button')
					)}
				</button>
			</form>

			<div className="text-center pt-2">
				<button
					onClick={handleResend}
					disabled={loading}
					className="text-sm hover:text-white transition"
					style={{color: 'rgba(255, 255, 255, 0.6)'}}
				>
					{resent ? t('email_verification.code_resent') : t('email_verification.resend_code')}
				</button>
			</div>
		</div>
	);
}
