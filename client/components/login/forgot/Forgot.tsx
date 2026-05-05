import React, {useEffect, useState} from 'react';
import {Link, useHistory, useLocation} from 'react-router-dom';
import PasswordStrength from '../../common/password_strength/PasswordStrength';
import {validateStrongPassword} from '../../../util/auth/password';
import {gql, useMutation} from '@apollo/client';
import {useInput} from '../../../util/hooks/useInput';
import {getRedirectLink} from '../../../util/auth/login';
import {UserAccount} from '../../../@types/generated/graphql';
import {useTranslation} from 'react-i18next';

type ForgotStage = 'email' | 'code' | 'reset';

function readStageFromSearch(search: string): {stage: ForgotStage; email: string} {
	const params = new URLSearchParams(search);
	const rawStage = params.get('step');
	const email = params.get('email') || '';
	const stage: ForgotStage = rawStage === 'code' || rawStage === 'reset' ? rawStage : 'email';
	return {stage, email};
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
	const { t, i18n } = useTranslation();
	const history = useHistory();
	const location = useLocation();
	const urlState = readStageFromSearch(location.search);

	const [stage, setStageInternal] = useState<ForgotStage>(urlState.stage);
	const [code, setCode] = useInput('');
	const [email, setEmail] = useInput(urlState.email);
	const [newPassword, setNewPassword] = useInput('');
	const [confirmPassword, setConfirmPassword] = useInput('');
	const [error, setError] = useState('');

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
	const [checkForgot, checkForgotData] = useMutation<
		{sendForgotPasswordCode: void},
		{
			email: string;
			code: string;
		}
	>(CHECK_FORGOT_PASSWORD_CODE);
	const [updatePass, updatePassData] = useMutation<
		{updateForgotPassword: UserAccount},
		{
			email: string;
			code: string;
			password: string;
		}
	>(UPDATE_FORGOT_PASSWORD_MUTATION);

	const loading = forgotCodeData?.loading || checkForgotData?.loading || updatePassData?.loading;
	const err =
		forgotCodeData?.error?.message || checkForgotData?.error?.message || updatePassData?.error?.message || error;

	async function nextStage(e) {
		e.preventDefault();

		if (loading) {
			return;
		}

		switch (stage) {
			case 'email': {
				if (!email.trim()) {
					setError(t('forgot.enter_email_error'));
					return;
				}

				await forgotCode({variables: {email: email.trim(), language: i18n.language}});
				setStage('code');
				break;
			}
			case 'code': {
				if (!code) {
					setError(t('forgot.enter_code_error'));
					return;
				}

				await checkForgot({variables: {email: email.trim(), code}});
				setStage('reset');
				break;
			}
			case 'reset': {
				const validate = validateStrongPassword(newPassword, confirmPassword);

				if (!validate.isStrong) {
					setError(validate.errorMessage);
					return;
				}

				await updatePass({variables: {email: email.trim(), code, password: newPassword}});
				localStorage.setItem('zkt_has_auth', 'true');
				window.location.href = getRedirectLink();
				return;
			}
		}
	}

	// Stage 1: Email Input
	if (stage === 'email') {
		return (
			<div className="space-y-4">
				<form onSubmit={nextStage} className="space-y-4">
					{/* Email Input */}
					<div>
						<label
							htmlFor="email"
							className="block text-sm mb-1"
							style={{ color: 'rgba(255, 255, 255, 0.7)' }}
						>
							{t('forgot.email')}
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={setEmail}
							placeholder={t('forgot.email_placeholder')}
							className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
							style={{
								backgroundColor: 'rgba(255, 255, 255, 0.05)',
								borderColor: 'rgba(255, 255, 255, 0.1)',
								color: '#ffffff'
							} as React.CSSProperties}
						/>
					</div>

					{/* Error Message */}
					{err && (
						<div className="mt-1 text-xs text-rose-300">
							{err}
						</div>
					)}

					{/* Submit Button */}
					<button
						type="submit"
						disabled={loading}
						className="w-full h-11 rounded-2xl font-semibold text-white disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:brightness-95 transition relative overflow-hidden"
						style={{
							background: 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%)',
							boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)'
						}}
					>
						{loading ? (
							<div className="flex items-center justify-center">
								<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
							</div>
						) : (
							t('forgot.send_code')
						)}
					</button>
				</form>

				{/* Links */}
				<div className="flex justify-between text-sm pt-2">
					<Link
						to="/login"
						className="hover:text-white transition"
						style={{ color: 'rgba(255, 255, 255, 0.6)' }}
					>
						{t('forgot.login_link')}
					</Link>
					<Link
						to="/signup"
						className="hover:text-white transition"
						style={{ color: 'rgba(255, 255, 255, 0.6)' }}
					>
						{t('forgot.signup_link')}
					</Link>
				</div>
			</div>
		);
	}

	// Stage 2: Code Input
	if (stage === 'code') {
		return (
			<div className="space-y-4">
				<div className="text-center mb-4">
					<p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
						{t('forgot.check_email')}
					</p>
				</div>

				<form onSubmit={nextStage} className="space-y-4">
					{/* Code Input */}
					<div>
						<label
							htmlFor="code"
							className="block text-sm mb-1"
							style={{ color: 'rgba(255, 255, 255, 0.7)' }}
						>
							{t('forgot.verification_code')}
						</label>
						<input
							id="code"
							type="text"
							value={code}
							onChange={setCode}
							placeholder={t('forgot.code_placeholder')}
							className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
							style={{
								backgroundColor: 'rgba(255, 255, 255, 0.05)',
								borderColor: 'rgba(255, 255, 255, 0.1)',
								color: '#ffffff'
							} as React.CSSProperties}
						/>
					</div>

					{/* Error Message */}
					{err && (
						<div className="mt-1 text-xs text-rose-300">
							{err}
						</div>
					)}

					{/* Submit Button */}
					<button
						type="submit"
						disabled={loading}
						className="w-full h-11 rounded-2xl font-semibold text-white disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:brightness-95 transition relative overflow-hidden"
						style={{
							background: 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%)',
							boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)'
						}}
					>
						{loading ? (
							<div className="flex items-center justify-center">
								<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
							</div>
						) : (
							t('forgot.verify_code')
						)}
					</button>
				</form>

				{/* Back Button */}
				<div className="text-center pt-2">
					<button
						onClick={() => setStage('email')}
						className="text-sm hover:text-white transition"
						style={{ color: 'rgba(255, 255, 255, 0.6)' }}
					>
						{t('forgot.back')}
					</button>
				</div>
			</div>
		);
	}

	// Stage 3: New Password
	if (stage === 'reset') {
		return (
			<div className="space-y-4">
				<div className="text-center mb-4">
					<p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
						{t('forgot.set_new_password')}
					</p>
				</div>

				<form onSubmit={nextStage} className="space-y-4">
					{/* New Password Input */}
					<div>
						<label
							htmlFor="newPassword"
							className="block text-sm mb-1"
							style={{ color: 'rgba(255, 255, 255, 0.7)' }}
						>
							{t('forgot.new_password')}
						</label>
						<input
							id="newPassword"
							type="password"
							value={newPassword}
							onChange={setNewPassword}
							placeholder={t('forgot.new_password_placeholder')}
							className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
							style={{
								backgroundColor: 'rgba(255, 255, 255, 0.05)',
								borderColor: 'rgba(255, 255, 255, 0.1)',
								color: '#ffffff'
							} as React.CSSProperties}
						/>
					</div>

					{/* Confirm Password Input */}
					<div>
						<label
							htmlFor="confirmPassword"
							className="block text-sm mb-1"
							style={{ color: 'rgba(255, 255, 255, 0.7)' }}
						>
							{t('forgot.confirm_password')}
						</label>
						<input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={setConfirmPassword}
							placeholder={t('forgot.confirm_password_placeholder')}
							className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
							style={{
								backgroundColor: 'rgba(255, 255, 255, 0.05)',
								borderColor: 'rgba(255, 255, 255, 0.1)',
								color: '#ffffff'
							} as React.CSSProperties}
						/>
					</div>

					{/* Password Strength */}
					<div className="text-xs">
						<PasswordStrength password={newPassword} confirmPassword={confirmPassword} />
					</div>

					{/* Error Message */}
					{err && (
						<div className="mt-1 text-xs text-rose-300">
							{err}
						</div>
					)}

					{/* Submit Button */}
					<button
						type="submit"
						disabled={loading}
						className="w-full h-11 rounded-2xl font-semibold text-white disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:brightness-95 transition relative overflow-hidden"
						style={{
							background: 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%)',
							boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)'
						}}
					>
						{loading ? (
							<div className="flex items-center justify-center">
								<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
							</div>
						) : (
							t('forgot.change_password')
						)}
					</button>
				</form>

				{/* Back Button */}
				<div className="text-center pt-2">
					<button
						onClick={() => setStage('code')}
						className="text-sm hover:text-white transition"
						style={{ color: 'rgba(255, 255, 255, 0.6)' }}
					>
						{t('forgot.back')}
					</button>
				</div>
			</div>
		);
	}

	return null;
}