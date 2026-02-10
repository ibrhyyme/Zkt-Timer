import React, {useState} from 'react';
import {Link} from 'react-router-dom';
import PasswordStrength from '../../common/password_strength/PasswordStrength';
import {validateStrongPassword} from '../../../util/auth/password';
import {gql, useMutation} from '@apollo/client';
import {useInput} from '../../../util/hooks/useInput';
import {getRedirectLink} from '../../../util/auth/login';
import {UserAccount} from '../../../@types/generated/graphql';

enum ForgotStage {
	EnterEmail,
	EnterCode,
	NewPassword,
}

const SENT_FORGOT_PASSWORD_CODE_MUTATION = gql`
	mutation Mutate($email: String!) {
		sendForgotPasswordCode(email: $email)
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
	const [stage, setStage] = useState<ForgotStage>(ForgotStage.EnterEmail);
	const [code, setCode] = useInput('');
	const [email, setEmail] = useInput('');
	const [newPassword, setNewPassword] = useInput('');
	const [confirmPassword, setConfirmPassword] = useInput('');
	const [error, setError] = useState('');

	const [forgotCode, forgotCodeData] = useMutation<{sendForgotPasswordCode: void}, {email: string}>(
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
			case ForgotStage.EnterEmail: {
				if (!email.trim()) {
					setError('Lütfen e-posta adresinizi girin');
					return;
				}

				await forgotCode({variables: {email: email.trim()}});
				setStage(ForgotStage.EnterCode);
				break;
			}
			case ForgotStage.EnterCode: {
				if (!code) {
					setError('Lütfen kodu girin');
					return;
				}

				await checkForgot({variables: {email: email.trim(), code}});
				setStage(ForgotStage.NewPassword);
				break;
			}
			case ForgotStage.NewPassword: {
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
	if (stage === ForgotStage.EnterEmail) {
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
							E-posta
						</label>
						<input
							id="email"
							type="email"
							value={email}
							onChange={setEmail}
							placeholder="E-postanı gir"
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
							'Kod Gönder'
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
						Giriş yap
					</Link>
					<Link
						to="/signup"
						className="hover:text-white transition"
						style={{ color: 'rgba(255, 255, 255, 0.6)' }}
					>
						Kayıt ol
					</Link>
				</div>
			</div>
		);
	}

	// Stage 2: Code Input
	if (stage === ForgotStage.EnterCode) {
		return (
			<div className="space-y-4">
				<div className="text-center mb-4">
					<p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
						E-postanızı kontrol edin. Şifrenizi sıfırlamak için bir kod almış olmalısınız.
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
							Doğrulama Kodu
						</label>
						<input
							id="code"
							type="text"
							value={code}
							onChange={setCode}
							placeholder="6 haneli kodu girin"
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
							'Kodu Doğrula'
						)}
					</button>
				</form>

				{/* Back Button */}
				<div className="text-center pt-2">
					<button
						onClick={() => setStage(ForgotStage.EnterEmail)}
						className="text-sm hover:text-white transition"
						style={{ color: 'rgba(255, 255, 255, 0.6)' }}
					>
						Geri dön
					</button>
				</div>
			</div>
		);
	}

	// Stage 3: New Password
	if (stage === ForgotStage.NewPassword) {
		return (
			<div className="space-y-4">
				<div className="text-center mb-4">
					<p className="text-sm" style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
						Lütfen yeni şifrenizi belirleyin.
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
							Yeni Şifre
						</label>
						<input
							id="newPassword"
							type="password"
							value={newPassword}
							onChange={setNewPassword}
							placeholder="Yeni şifrenizi girin"
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
							Şifre Tekrarı
						</label>
						<input
							id="confirmPassword"
							type="password"
							value={confirmPassword}
							onChange={setConfirmPassword}
							placeholder="Şifrenizi tekrar girin"
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
							'Şifreyi Değiştir'
						)}
					</button>
				</form>

				{/* Back Button */}
				<div className="text-center pt-2">
					<button
						onClick={() => setStage(ForgotStage.EnterCode)}
						className="text-sm hover:text-white transition"
						style={{ color: 'rgba(255, 255, 255, 0.6)' }}
					>
						Geri dön
					</button>
				</div>
			</div>
		);
	}

	return null;
}