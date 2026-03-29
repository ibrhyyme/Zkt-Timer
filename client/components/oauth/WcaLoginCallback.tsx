import React, {useEffect} from 'react';
import {gql} from '@apollo/client';
import {gqlMutate} from '../api';
import {toastError} from '../../util/toast';
import {useTranslation} from 'react-i18next';
import {resourceUri} from '../../util/storage';

const AUTHENTICATE_WITH_WCA = gql`
	mutation Mutate($code: String!) {
		authenticateWithWca(code: $code) {
			success
			needsUsername
			wcaName
			wcaEmail
			wcaId
		}
	}
`;

export default function WcaLoginCallback() {
	const {t} = useTranslation();

	useEffect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const code = urlParams.get('code');

		if (!code) {
			toastError(t('wca_signup.session_expired'));
			window.location.href = '/login';
			return;
		}

		gqlMutate(AUTHENTICATE_WITH_WCA, {code})
			.then((res) => {
				const result = res?.data?.authenticateWithWca;

				if (result?.success && !result?.needsUsername) {
					localStorage.setItem('zkt_has_auth', 'true');
					window.location.href = '/timer';
				} else if (result?.needsUsername) {
					const params = new URLSearchParams();
					if (result.wcaName) params.set('name', result.wcaName);
					if (result.wcaEmail) params.set('email', result.wcaEmail);
					if (result.wcaId) params.set('wcaId', result.wcaId);
					window.location.href = `/wca-signup?${params.toString()}`;
				} else {
					window.location.href = '/login';
				}
			})
			.catch((e) => {
				console.error('WCA login error:', e);
				const errorMessage =
					e?.graphQLErrors?.[0]?.extensions?.exception?.message ||
					e?.graphQLErrors?.[0]?.message ||
					e?.message ||
					t('wca_signup.session_expired');
				toastError(errorMessage);
				setTimeout(() => {
					window.location.href = '/login';
				}, 2000);
			});
	}, []);

	return (
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'center',
				alignItems: 'center',
				minHeight: '100vh',
				gap: '1.5rem',
			}}
		>
			<img
				src={resourceUri('/images/logos/wca_logo.svg')}
				alt="WCA"
				style={{width: '64px', height: '64px', opacity: 0.9}}
			/>
			<div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
			<p style={{color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.9rem'}}>
				{t('wca_signup.loading')}
			</p>
		</div>
	);
}
