import React, {useEffect, useRef, useState} from 'react';
import {gql} from '@apollo/client/core';
import {useMutation} from '@apollo/client';
import {Trans, useTranslation} from 'react-i18next';
import {Link} from 'react-router-dom';
import {useInput} from '../../../util/hooks/useInput';
import {UserAccount} from '../../../@types/generated/graphql';
import {resourceUri} from '../../../util/storage';
import block from '../../../styles/bem';

// Last step of "sign in with Zeka Kupu Turkiye" for somebody who has no
// Zkt-Timer account yet: pick a username, accept the terms, done. Everything
// else (name, email, ZKT ID) came from the federation and is shown read-only so
// they can see what is about to be copied into their new account.
//
// Renders inside the .cd-zkt-auth scope as a ZktAuthScene legacyChild, which is
// where the consent/banner styles below come from.
const b = block('zkt-auth');

const COMPLETE_ZKT_SIGNUP = gql`
	mutation Mutate($username: String!, $acceptedTerms: Boolean!) {
		completeZktSignup(username: $username, acceptedTerms: $acceptedTerms) {
			id
			session_token
		}
	}
`;

export default function ZktSignup() {
	const {t} = useTranslation();
	const [username, setUsername] = useInput('');
	const [agreed, setAgreed] = useState(false);
	const [error, setError] = useState('');
	const [shake, setShake] = useState(false);
	const [redirecting, setRedirecting] = useState(false);
	const shakeTimer = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
		},
		[]
	);

	// Drop the class before re-applying so a second error replays the animation;
	// the browser will not restart it if the class never leaves.
	function flashError(msg: string) {
		setError(msg);
		setShake(false);
		if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
		requestAnimationFrame(() => setShake(true));
		shakeTimer.current = window.setTimeout(() => setShake(false), 500);
	}

	const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
	const zktName = urlParams.get('name') || '';
	const zktEmail = urlParams.get('email') || '';
	const zktId = urlParams.get('zktId') || '';

	const nameParts = zktName.split(' ');
	const firstName = nameParts[0] || '';
	const lastName = nameParts.slice(1).join(' ') || '';

	const [completeSignup, completeSignupData] = useMutation<
		{completeZktSignup: UserAccount},
		{username: string; acceptedTerms: boolean}
	>(COMPLETE_ZKT_SIGNUP);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError('');
		if (completeSignupData?.loading) return;

		const trimmed = username.trim();
		if (!trimmed || trimmed.length < 2) {
			flashError(t('zkt_signup.username_too_short'));
			return;
		}
		if (trimmed.length > 18) {
			flashError(t('zkt_signup.username_too_long'));
			return;
		}
		if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
			flashError(t('zkt_signup.username_invalid'));
			return;
		}
		if (!agreed) {
			flashError(t('signup.consent_required'));
			return;
		}

		try {
			await completeSignup({variables: {username: trimmed, acceptedTerms: agreed}});
			localStorage.setItem('zkt_has_auth', 'true');
			setRedirecting(true);
			window.location.href = '/timer';
		} catch (err: any) {
			flashError(
				err?.graphQLErrors?.[0]?.extensions?.exception?.message ||
					err?.graphQLErrors?.[0]?.message ||
					err?.message ||
					t('zkt_signup.session_expired')
			);
		}
	}

	const logo = (
		<img
			src={resourceUri('/images/logos/zkt_logo.png')}
			alt="Zeka Küpü Türkiye"
			style={{width: '48px', height: '48px', opacity: 0.95}}
		/>
	);

	if (redirecting) {
		return (
			<div className="flex flex-col items-center justify-center gap-4 py-8">
				{logo}
				<div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
				<p style={{color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem'}}>
					{t('zkt_signup.loading')}
				</p>
			</div>
		);
	}

	return (
		<div className={`space-y-4 ${shake ? b('legacy-shake') : ''}`}>
			<div className="flex justify-center">{logo}</div>

			{(zktName || zktEmail || zktId) && (
				<div
					className="rounded-2xl p-4 space-y-2"
					style={{
						backgroundColor: 'rgba(255, 255, 255, 0.05)',
						border: '1px solid rgba(255, 255, 255, 0.1)',
					}}
				>
					{firstName && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('zkt_signup.first_name')}</span>
							<span className="text-white font-medium">{firstName}</span>
						</div>
					)}
					{lastName && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('zkt_signup.last_name')}</span>
							<span className="text-white font-medium">{lastName}</span>
						</div>
					)}
					{zktEmail && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('zkt_signup.email')}</span>
							<span className="text-white font-medium">{zktEmail}</span>
						</div>
					)}
					{zktId && (
						<div className="flex justify-between text-sm">
							<span style={{color: 'rgba(255, 255, 255, 0.5)'}}>{t('zkt_signup.zkt_id')}</span>
							<span className="text-white font-medium">{zktId}</span>
						</div>
					)}
				</div>
			)}

			<p className="text-sm text-center" style={{color: 'rgba(255, 255, 255, 0.5)'}}>
				{t('zkt_signup.description')}
			</p>

			<form onSubmit={handleSubmit} className="space-y-3">
				<div>
					<label
						htmlFor="zkt-username"
						className="block text-sm mb-1"
						style={{color: 'rgba(255, 255, 255, 0.7)'}}
					>
						{t('zkt_signup.username_label')}
					</label>
					<input
						id="zkt-username"
						type="text"
						value={username}
						onChange={setUsername}
						autoFocus
						className="w-full h-11 px-4 rounded-2xl border focus:outline-none focus:ring-2 focus:ring-indigo-400/70 transition"
						style={
							{
								backgroundColor: 'rgba(255, 255, 255, 0.05)',
								borderColor: 'rgba(255, 255, 255, 0.1)',
								color: '#ffffff',
							} as React.CSSProperties
						}
					/>
				</div>

				{error && (
					<div className={b('banner')}>
						<span className={b('banner-dot')} />
						{error}
					</div>
				)}

				<label className={b('consent')}>
					<input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
					<span>
						<Trans
							i18nKey="signup.consent_label"
							components={{
								priv: <Link to="/privacy" target="_blank" rel="noopener noreferrer" />,
								terms: <Link to="/terms" target="_blank" rel="noopener noreferrer" />,
							}}
						/>
					</span>
				</label>

				<button
					type="submit"
					disabled={!username.trim() || completeSignupData?.loading}
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
						t('zkt_signup.submit')
					)}
				</button>
			</form>
		</div>
	);
}
