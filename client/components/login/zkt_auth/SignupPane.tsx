import React, { useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { gql } from '@apollo/client/core';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Eye, EyeSlash, ArrowRight } from 'phosphor-react';
import { UserAccount } from '../../../@types/generated/graphql';
import { useInput } from '../../../util/hooks/useInput';
import { validateStrongPassword } from '../../../util/auth/password';
import PasswordStrength from '../../common/password_strength/PasswordStrength';
import block from '../../../styles/bem';
import EmailSuggestionBanner from './EmailSuggestionBanner';
import TurnstileWidget from './TurnstileWidget';

const b = block('zkt-auth');

const CREATE_USER_ACCOUNT_MUTATION = gql`
	mutation Mutate($firstName: String!, $lastName: String!, $email: String!, $username: String!, $password: String!, $language: String, $turnstileToken: String!) {
		createUserAccount(
			first_name: $firstName
			last_name: $lastName
			email: $email
			username: $username
			password: $password
			language: $language
			turnstile_token: $turnstileToken
		) {
			id
		}
	}
`;

interface Props {
	onFieldFill: (fieldName: string, totalFields: number) => void;
	onSubmitSuccess: () => void;
	onSubmitError: () => void;
}

export default function SignupPane({ onFieldFill, onSubmitSuccess, onSubmitError }: Props) {
	const { t, i18n } = useTranslation();
	const [firstName, setFirstName] = useInput('');
	const [lastName, setLastName] = useInput('');
	const [email, setEmail] = useInput('');
	const [username, setUsername] = useInput('');
	const [password, setPassword] = useInput('');
	const [showPwd, setShowPwd] = useState(false);
	const [error, setError] = useState('');
	const filledRef = useRef<Set<string>>(new Set());

	const isNative = Capacitor.isNativePlatform();
	const [turnstileToken, setTurnstileToken] = useState(isNative ? 'NATIVE_APP' : '');

	const [createAccount, createData] = useMutation<
		{ createUserAccount: UserAccount },
		{
			firstName: string;
			lastName: string;
			username: string;
			email: string;
			password: string;
			language: string;
			turnstileToken: string;
		}
	>(CREATE_USER_ACCOUNT_MUTATION);

	function trackField(name: string, value: string) {
		if (!value || value.trim().length < 2) return;
		if (filledRef.current.has(name)) return;
		filledRef.current.add(name);
		onFieldFill(name, 5);
	}

	function bind(name: string, setter: (e: any) => void) {
		return (e: React.ChangeEvent<HTMLInputElement>) => {
			setter(e);
			trackField(name, e.target.value);
		};
	}

	function acceptEmailSuggestion(v: string) {
		setEmail({ target: { value: v } } as any);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (createData?.loading) return;
		setError('');

		const validate = validateStrongPassword(password);
		if (!validate.isStrong) {
			setError(validate.errorMessage);
			onSubmitError();
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
					language: i18n.language,
					turnstileToken,
				},
			});

			onSubmitSuccess();
			setTimeout(() => {
				window.location.href = `/verify-email?email=${encodeURIComponent(email.trim())}`;
			}, 900);
		} catch (err: any) {
			setError(err.message);
			onSubmitError();
		}
	}

	const disabled =
		!firstName.trim() ||
		!lastName.trim() ||
		!email.trim() ||
		!username.trim() ||
		!password.trim() ||
		!turnstileToken;

	return (
		<form className={b('form')} onSubmit={submit}>
			{error && (
				<div className={b('banner')}>
					<span className={b('banner-dot')} />
					{error}
				</div>
			)}

			<div className={b('form-row2')}>
				<div className={b('field')}>
					<label className={b('field-label')}>{t('signup.first_name')}</label>
					<input
						className={b('input', { filled: !!firstName })}
						type="text"
						value={firstName}
						onChange={bind('firstName', setFirstName)}
					/>
				</div>
				<div className={b('field')}>
					<label className={b('field-label')}>{t('signup.last_name')}</label>
					<input
						className={b('input', { filled: !!lastName })}
						type="text"
						value={lastName}
						onChange={bind('lastName', setLastName)}
					/>
				</div>
			</div>

			<div className={b('field')}>
				<label className={b('field-label')}>{t('signup.email')}</label>
				<input
					className={b('input', { filled: !!email })}
					type="email"
					value={email}
					onChange={bind('email', setEmail)}
				/>
				<EmailSuggestionBanner value={email} onAccept={acceptEmailSuggestion} />
			</div>

			<div className={b('form-row2')}>
				<div className={b('field')}>
					<label className={b('field-label')}>{t('signup.username')}</label>
					<input
						className={b('input', { filled: !!username })}
						type="text"
						value={username}
						onChange={bind('username', setUsername)}
					/>
				</div>
				<div className={b('field')}>
					<label className={b('field-label')}>{t('signup.password')}</label>
					<div className={b('input-wrap')}>
						<input
							className={b('input', { filled: !!password })}
							type={showPwd ? 'text' : 'password'}
							value={password}
							onChange={bind('password', setPassword)}
						/>
						<button
							type="button"
							className={b('eye')}
							onClick={() => setShowPwd((s) => !s)}
						>
							{showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
						</button>
					</div>
				</div>
			</div>

			<div className={b('pwd-strength')}>
				<PasswordStrength password={password} />
			</div>

			{!isNative && <TurnstileWidget onToken={setTurnstileToken} />}

			<button
				type="submit"
				className={b('btn', { primary: true })}
				disabled={disabled || createData?.loading}
			>
				{createData?.loading ? (
					<span className={b('btn-spinner')} />
				) : (
					<>
						{t('zkt_auth.submit_signup')}
						<ArrowRight size={18} weight="bold" />
					</>
				)}
			</button>
		</form>
	);
}
