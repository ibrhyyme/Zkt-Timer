import React, {useState} from 'react';
import Input from '../../common/inputs/input/Input';
import {Link} from 'react-router-dom';
import {gql} from '@apollo/client/core';
import {validateStrongPassword} from '../../../util/auth/password';
import PasswordStrength from '../../common/password_strength/PasswordStrength';
import {getLoginLink, getRedirectLink} from '../../../util/auth/login';
import block from '../../../styles/bem';
import {useInput} from '../../../util/hooks/useInput';
import {useMutation} from '@apollo/client';
import {UserAccount} from '../../../@types/generated/graphql';
import Button from '../../common/button/Button';

const b = block('login');

const CREATE_USER_ACCOUNT_MUTATION = gql`
	mutation Mutate($firstName: String!, $lastName: String!, $email: String!, $username: String!, $password: String!) {
		createUserAccount(
			first_name: $firstName
			last_name: $lastName
			email: $email
			username: $username
			password: $password
		) {
			id
		}
	}
`;

export default function SignUp() {
	const [firstName, setFirstName] = useInput('');
	const [lastName, setLastName] = useInput('');
	const [email, setEmail] = useInput('');
	const [password, setPassword] = useInput('');
	const [username, setUsername] = useInput('');
	const [error, setError] = useState('');

	const [createAccount, createAccountData] = useMutation<
		{createUserAccount: UserAccount},
		{
			firstName: string;
			lastName: string;
			username: string;
			email: string;
			password: string;
		}
	>(CREATE_USER_ACCOUNT_MUTATION);

	async function signUp(e) {
		e.preventDefault();
		setError('');

		if (createAccountData?.loading) {
			return;
		}

		const validate = validateStrongPassword(password);

		if (!validate.isStrong) {
			setError(validate.errorMessage);
			return;
		}

		try {
			await createAccount({
				variables: {
					firstName: firstName.trim(),
					lastName: lastName.trim(),
					email: email.trim(),
					username: username.trim(),
					password,
				},
			});
			window.location.href = getRedirectLink();
		} catch (e) {
			setError(e.message);
		}
	}

	const disabled = !firstName.trim() || !lastName.trim() || !email.trim() || !password.trim() || !username.trim();



	return (
		<div className="space-y-4">
			<form onSubmit={signUp} className="space-y-4">
				{/* First Name Input */}
				<div>
					<label 
						htmlFor="firstName" 
						className="block text-sm mb-1"
						style={{ color: 'var(--text-dim)' }}
					>
						Ad
					</label>
					<input
						id="firstName"
						type="text"
						value={firstName}
						onChange={setFirstName}
						placeholder=""
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
						style={{
							backgroundColor: 'var(--input-bg)',
							borderColor: 'var(--input-stroke)',
							color: 'var(--text)'
						} as React.CSSProperties}
					/>
				</div>

				{/* Last Name Input */}
				<div>
					<label 
						htmlFor="lastName" 
						className="block text-sm mb-1"
						style={{ color: 'var(--text-dim)' }}
					>
						Soyad
					</label>
					<input
						id="lastName"
						type="text"
						value={lastName}
						onChange={setLastName}
						placeholder=""
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
						style={{
							backgroundColor: 'var(--input-bg)',
							borderColor: 'var(--input-stroke)',
							color: 'var(--text)'
						} as React.CSSProperties}
					/>
				</div>

				{/* Email Input */}
				<div>
					<label 
						htmlFor="email" 
						className="block text-sm mb-1"
						style={{ color: 'var(--text-dim)' }}
					>
						E-posta
					</label>
					<input
						id="email"
						type="email"
						value={email}
						onChange={setEmail}
						placeholder=""
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
						style={{
							backgroundColor: 'var(--input-bg)',
							borderColor: 'var(--input-stroke)',
							color: 'var(--text)'
						} as React.CSSProperties}
					/>
				</div>

				{/* Username Input */}
				<div>
					<label 
						htmlFor="username" 
						className="block text-sm mb-1"
						style={{ color: 'var(--text-dim)' }}
					>
						Kullanıcı Adı
					</label>
					<input
						id="username"
						type="text"
						value={username}
						onChange={setUsername}
						placeholder=""
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
						style={{
							backgroundColor: 'var(--input-bg)',
							borderColor: 'var(--input-stroke)',
							color: 'var(--text)'
						} as React.CSSProperties}
					/>
				</div>

				{/* Password Input */}
				<div>
					<label 
						htmlFor="password" 
						className="block text-sm mb-1"
						style={{ color: 'var(--text-dim)' }}
					>
						Şifre
					</label>
					<input
						id="password"
						type="password"
						value={password}
						onChange={setPassword}
						placeholder=""
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
						style={{
							backgroundColor: 'var(--input-bg)',
							borderColor: 'var(--input-stroke)',
							color: 'var(--text)'
						} as React.CSSProperties}
					/>
				</div>

				{/* Error Message */}
				{error && (
					<div className="mt-1 text-xs text-rose-300">
						{error}
					</div>
				)}

				{/* Password Strength - Keep but style to match */}
				<div className="text-xs">
					<PasswordStrength password={password} />
				</div>

				{/* SignUp Button */}
				<button
					type="submit"
					disabled={disabled || createAccountData?.loading}
					className="w-full h-11 rounded-2xl font-semibold text-white disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:brightness-95 transition relative overflow-hidden"
					style={{
						background: 'linear-gradient(90deg, var(--btn-from) 0%, var(--btn-to) 100%)',
						boxShadow: 'var(--btn-shadow)'
					}}
				>
					{createAccountData?.loading ? (
						<div className="flex items-center justify-center">
							<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
						</div>
					) : (
						'Kayıt Ol'
					)}
				</button>
			</form>

			{/* Link */}
			<div className="text-center text-sm pt-2">
				<Link 
					to={getLoginLink()}
					className="hover:text-white transition"
					style={{ color: 'var(--text-dim)' }}
				>
					Hesabın var mı? Giriş yap
				</Link>
			</div>
		</div>
	);
}
