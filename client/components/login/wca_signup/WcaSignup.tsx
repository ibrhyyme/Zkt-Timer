import React, {useState} from 'react';
import {gql} from '@apollo/client/core';
import {useMutation} from '@apollo/client';
import {useTranslation} from 'react-i18next';
import {useInput} from '../../../util/hooks/useInput';
import {UserAccount} from '../../../@types/generated/graphql';
import {resourceUri} from '../../../util/storage';

const COMPLETE_WCA_SIGNUP = gql`
	mutation Mutate($username: String!) {
		completeWcaSignup(username: $username) {
			id
		}
	}
`;

export default function WcaSignup() {
	const {t} = useTranslation();
	const [username, setUsername] = useInput('');
	const [error, setError] = useState('');
	const [redirecting, setRedirecting] = useState(false);

	const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
	const wcaName = urlParams.get('name') || '';
	const wcaEmail = urlParams.get('email') || '';
	const wcaId = urlParams.get('wcaId') || '';

	// WCA ismini ad/soyad olarak ayir
	const nameParts = wcaName.split(' ');
	const firstName = nameParts[0] || '';
	const lastName = nameParts.slice(1).join(' ') || '';

	const [completeSignup, completeSignupData] = useMutation<
		{completeWcaSignup: UserAccount},
		{username: string}
	>(COMPLETE_WCA_SIGNUP);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError('');

		if (completeSignupData?.loading) {
			return;
		}

		const trimmed = username.trim();
		if (!trimmed || trimmed.length < 2) {
			setError(t('wca_signup.username_too_short'));
			return;
		}

		if (trimmed.length > 18) {
			setError(t('wca_signup.username_too_long'));
			return;
		}

		if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			setError(t('wca_signup.username_invalid'));
			return;
		}

		try {
			await completeSignup({
				variables: {
					username: trimmed,
				},
			});

			localStorage.setItem('zkt_has_auth', 'true');
			setRedirecting(true);
			window.location.href = '/timer';
		} catch (e) {
			setError(e.message);
		}
	}

	const disabled = !username.trim();

	if (redirecting) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-8">
				<img
					src={resourceUri('/images/logos/wca_logo.svg')}
					alt="WCA"
					style={{width: '48px', height: '48px', opacity: 0.9}}
				/>
				<div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
				<p style={{color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem'}}>
					{t('wca_signup.loading')}
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{/* WCA Logo */}
			<div className="flex justify-center">
				<img
					src={resourceUri('/images/logos/wca_logo.svg')}
					alt="WCA"
					style={{width: '48px', height: '48px', opacity: 0.9}}
				/>
			</div>

			{/* WCA Bilgi Karti */}
			{(wcaName || wcaEmail || wcaId) && (
				<div
					className="rounded-2xl p-4 space-y-2"
					style={{
						backgroundColor: 'rgba(255, 255, 255, 0.05)',
						border: '1px solid rgba(255, 255, 255, 0.1)',
					}}
				>
					{firstName && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('wca_signup.first_name')}</span>
							<span className="text-white font-medium">{firstName}</span>
						</div>
					)}
					{lastName && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('wca_signup.last_name')}</span>
							<span className="text-white font-medium">{lastName}</span>
						</div>
					)}
					{wcaEmail && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('wca_signup.email')}</span>
							<span className="text-white font-medium">{wcaEmail}</span>
						</div>
					)}
					{wcaId && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('wca_signup.wca_id')}</span>
							<span className="text-white font-medium">{wcaId}</span>
						</div>
					)}
				</div>
			)}

			<p
				className="text-sm text-center"
				style={{color: 'rgba(255, 255, 255, 0.5)'}}
			>
				{t('wca_signup.description')}
			</p>

			<form onSubmit={handleSubmit} className="space-y-3">
				{/* Username Input */}
				<div>
					<label
						htmlFor="username"
						className="block text-sm mb-1"
						style={{color: 'rgba(255, 255, 255, 0.7)'}}
					>
						{t('wca_signup.username_label')}
					</label>
					<input
						id="username"
						type="text"
						value={username}
						onChange={setUsername}
						placeholder=""
						autoFocus
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
						style={{
							backgroundColor: 'rgba(255, 255, 255, 0.05)',
							borderColor: 'rgba(255, 255, 255, 0.1)',
							color: '#ffffff',
						} as React.CSSProperties}
					/>
				</div>

				{/* Error */}
				{error && (
					<div className="mt-1 text-xs text-rose-300">{error}</div>
				)}

				{/* Submit */}
				<button
					type="submit"
					disabled={disabled || completeSignupData?.loading}
					className="w-full h-11 rounded-2xl font-semibold text-white disabled:opacity-60 disabled:pointer-events-none hover:brightness-110 active:brightness-95 transition relative overflow-hidden"
					style={{
						background: 'linear-gradient(90deg, #7c3aed 0%, #3b82f6 100%)',
						boxShadow: '0 10px 30px rgba(124, 58, 237, 0.3)',
					}}
				>
					{completeSignupData?.loading ? (
						<div className="flex items-center justify-center">
							<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
						</div>
					) : (
						t('wca_signup.submit')
					)}
				</button>
			</form>
		</div>
	);
}
