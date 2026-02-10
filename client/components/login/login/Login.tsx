import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '@apollo/client/core';
import { getRedirectLink, getSignUpLink } from '../../../util/auth/login';
import Input from '../../common/inputs/input/Input';
import { useMutation } from '@apollo/client';
import { UserAccount } from '../../../@types/generated/graphql';
import block from '../../../styles/bem';
import Button from '../../common/button/Button';
import { useInput } from '../../../util/hooks/useInput';
import { Eye, EyeSlash, Check } from 'phosphor-react';

const b = block('login');

const AUTHENTICATE_USER_MUTATION = gql`
	mutation Mutate($email: String!, $password: String!, $remember: Boolean) {
		authenticateUser(email: $email, password: $password, remember: $remember) {
			id
		}
	}
`;

export default function Login() {
	const [email, setEmail] = useInput('');
	const [password, setPassword] = useInput('');
	const [error, setError] = useState('');
	const [showPassword, setShowPassword] = useState(false);

	// Initialize rememberMe from localStorage (client-side only)
	const [rememberMe, setRememberMe] = useState(() => {
		if (typeof window !== 'undefined') {
			return !!localStorage.getItem('rememberedEmail');
		}
		return false;
	});

	// Load remembered email on component mount
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const rememberedEmail = localStorage.getItem('rememberedEmail');
			if (rememberedEmail) {
				setEmail({ target: { value: rememberedEmail } } as any);
			}
		}
	}, [setEmail]);

	const [authUser, authUserData] = useMutation<
		{ authenticateUser: UserAccount },
		{
			email: string;
			password: string;
			remember: boolean;
		}
	>(AUTHENTICATE_USER_MUTATION);

	async function login(e) {
		e.preventDefault();

		if (authUserData?.loading) {
			return;
		}

		try {
			await authUser({
				variables: {
					email,
					password,
					remember: rememberMe,
				},
			});

			// Save or remove email from localStorage based on rememberMe
			if (rememberMe) {
				localStorage.setItem('rememberedEmail', email);
			} else {
				localStorage.removeItem('rememberedEmail');
			}

			localStorage.setItem('zkt_has_auth', 'true');
			const redirect = getRedirectLink();
			window.location.href = redirect || '/timer';
		} catch (err) {
			setError(err.message);
		}
	}

	return (
		<div className="space-y-4">
			<form onSubmit={login} className="space-y-4">
				{/* E-posta Input */}
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

				{/* Şifre Input */}
				<div className="relative">
					<label
						htmlFor="password"
						className="block text-sm mb-1"
						style={{ color: 'rgba(255, 255, 255, 0.7)' }}
					>
						Şifre
					</label>
					<div className="relative">
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							value={password}
							onChange={setPassword}
							placeholder="Şifreni gir"
							className="w-full h-11 px-4 pr-12 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
							style={{
								backgroundColor: 'rgba(255, 255, 255, 0.05)',
								borderColor: 'rgba(255, 255, 255, 0.1)',
								color: '#ffffff'
							} as React.CSSProperties}
						/>
						<button
							type="button"
							onClick={() => setShowPassword(!showPassword)}
							className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-cyan-200 transition-colors"
						>
							{showPassword ? (
								<EyeSlash size={20} weight="light" />
							) : (
								<Eye size={20} weight="light" />
							)}
						</button>
					</div>
				</div>

				{/* Remember Me Checkbox */}
				<div className="flex items-center gap-2">
					<div className="relative flex items-center justify-center">
						<input
							id="rememberMe"
							type="checkbox"
							checked={rememberMe}
							onChange={(e) => setRememberMe(e.target.checked)}
							className="appearance-none w-5 h-5 rounded border cursor-pointer transition-colors focus:ring-2 focus:ring-indigo-400/70"
							style={{
								backgroundColor: rememberMe ? '#7c3aed' : 'rgba(255, 255, 255, 0.05)',
								borderColor: rememberMe ? '#7c3aed' : 'rgba(255, 255, 255, 0.2)',
							}}
						/>
						<Check
							size={14}
							weight="bold"
							className={`absolute pointer-events-none text-white transition-opacity ${rememberMe ? 'opacity-100' : 'opacity-0'}`}
						/>
					</div>
					<label
						htmlFor="rememberMe"
						className="text-sm cursor-pointer select-none"
						style={{ color: 'rgba(255, 255, 255, 0.7)' }}
					>
						Beni anımsa
					</label>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mt-1 text-xs text-rose-300">
						{error}
					</div>
				)}

				{/* Login Button */}
				<button
					type="submit"
					disabled={authUserData?.loading}
					className="w-full h-11 rounded-2xl font-semibold text-white disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:brightness-95 transition relative overflow-hidden"
					style={{
						background: 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%)',
						boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)'
					}}
				>
					{authUserData?.loading ? (
						<div className="flex items-center justify-center">
							<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
						</div>
					) : (
						'Giriş Yap'
					)}
				</button>
			</form>

			{/* Links */}
			<div className="flex justify-between text-sm pt-2">
				<Link
					to="/forgot"
					className="hover:text-white transition"
					style={{ color: 'rgba(255, 255, 255, 0.6)' }}
				>
					Şifreni mi unuttun?
				</Link>
				<Link
					to={getSignUpLink()}
					className="hover:text-white transition"
					style={{ color: 'rgba(255, 255, 255, 0.6)' }}
				>
					Hesabın yok mu? Kayıt ol
				</Link>
			</div>
		</div>
	);
}
