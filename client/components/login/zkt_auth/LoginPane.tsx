import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '@apollo/client/core';
import { useMutation } from '@apollo/client';
import { useTranslation } from 'react-i18next';
import { Eye, EyeSlash, Check, ArrowRight } from 'phosphor-react';
import { UserAccount } from '../../../@types/generated/graphql';
import { useInput } from '../../../util/hooks/useInput';
import { getRedirectLink } from '../../../util/auth/login';
import block from '../../../styles/bem';
import EmailSuggestionBanner from './EmailSuggestionBanner';

const b = block('zkt-auth');

const AUTHENTICATE_USER_MUTATION = gql`
	mutation Mutate($email: String!, $password: String!, $remember: Boolean) {
		authenticateUser(email: $email, password: $password, remember: $remember) {
			id
			session_token
		}
	}
`;

interface Props {
	onFieldFill: (fieldName: string, totalFields: number) => void;
	onSubmitSuccess: () => void;
	onSubmitError: () => void;
}

export default function LoginPane({ onFieldFill, onSubmitSuccess, onSubmitError }: Props) {
	const { t } = useTranslation();
	const [email, setEmail] = useInput('');
	const [password, setPassword] = useInput('');
	const [showPwd, setShowPwd] = useState(false);
	const [error, setError] = useState('');
	const filledRef = useRef<Set<string>>(new Set());

	const [rememberMe, setRememberMe] = useState(false);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const remembered = localStorage.getItem('rememberedEmail');
		if (remembered) {
			setEmail({ target: { value: remembered } } as any);
			setRememberMe(true);
		}
	}, [setEmail]);

	const [authUser, authData] = useMutation<
		{ authenticateUser: UserAccount },
		{ email: string; password: string; remember: boolean }
	>(AUTHENTICATE_USER_MUTATION);

	function trackField(name: string, value: string) {
		if (!value || value.length < 2) return;
		if (filledRef.current.has(name)) return;
		filledRef.current.add(name);
		onFieldFill(name, 2);
	}

	function handleEmail(e: React.ChangeEvent<HTMLInputElement>) {
		setEmail(e);
		trackField('email', e.target.value);
	}

	function handlePassword(e: React.ChangeEvent<HTMLInputElement>) {
		setPassword(e);
		trackField('password', e.target.value);
	}

	function acceptEmailSuggestion(v: string) {
		setEmail({ target: { value: v } } as any);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (authData?.loading) return;
		setError('');

		try {
			await authUser({
				variables: {
					email,
					password,
					remember: rememberMe,
				},
			});

			if (rememberMe) {
				localStorage.setItem('rememberedEmail', email);
			} else {
				localStorage.removeItem('rememberedEmail');
			}
			localStorage.setItem('zkt_has_auth', 'true');

			onSubmitSuccess();
			const redirect = getRedirectLink();
			setTimeout(() => {
				window.location.href = redirect || '/timer';
			}, 900);
		} catch (err: any) {
			const gqlErr = err?.graphQLErrors?.[0];
			if (gqlErr?.extensions?.code === 'EMAIL_NOT_VERIFIED') {
				const targetEmail = (gqlErr.extensions?.email as string) || email;
				window.location.href = `/verify-email?email=${encodeURIComponent(targetEmail)}`;
				return;
			}
			setError(err.message || t('zkt_auth.error_invalid_credentials'));
			onSubmitError();
		}
	}

	return (
		<form className={b('form')} onSubmit={submit}>
			{error && (
				<div className={b('banner')}>
					<span className={b('banner-dot')} />
					{error}
				</div>
			)}

			<div className={b('field')}>
				<label className={b('field-label')}>{t('login.email')}</label>
				<input
					className={b('input', { filled: !!email })}
					type="email"
					autoComplete="username"
					value={email}
					onChange={handleEmail}
					placeholder={t('login.email_placeholder')}
				/>
				<EmailSuggestionBanner value={email} onAccept={acceptEmailSuggestion} />
			</div>

			<div className={b('field')}>
				<label className={b('field-label')}>{t('login.password')}</label>
				<div className={b('input-wrap')}>
					<input
						className={b('input', { filled: !!password })}
						type={showPwd ? 'text' : 'password'}
						autoComplete="current-password"
						value={password}
						onChange={handlePassword}
						placeholder={t('login.password_placeholder')}
					/>
					<button
						type="button"
						className={b('eye')}
						onClick={() => setShowPwd((s) => !s)}
						aria-label={showPwd ? 'Hide password' : 'Show password'}
					>
						{showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
					</button>
				</div>
			</div>

			<div className={b('form-actions')}>
				<button
					type="button"
					className={b('checkbox', { on: rememberMe })}
					onClick={() => setRememberMe((r) => !r)}
				>
					<span className={b('checkbox-box')}>
						{rememberMe && <Check size={11} weight="bold" />}
					</span>
					{t('login.remember_me')}
				</button>
				<Link to="/forgot" className={b('link')}>
					{t('login.forgot_password')}
				</Link>
			</div>

			<button
				type="submit"
				className={b('btn', { primary: true })}
				disabled={authData?.loading}
			>
				{authData?.loading ? (
					<span className={b('btn-spinner')} />
				) : (
					<>
						{t('zkt_auth.submit_login')}
						<ArrowRight size={18} weight="bold" />
					</>
				)}
			</button>
		</form>
	);
}
