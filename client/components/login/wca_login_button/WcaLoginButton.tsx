import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {LINKED_SERVICES} from '../../../../shared/integration';
import {resourceUri} from '../../../util/storage';

export default function WcaLoginButton() {
	const {t} = useTranslation();
	const [loading, setLoading] = useState(false);

	function handleClick() {
		if (loading) return;
		setLoading(true);

		const service = LINKED_SERVICES.wca;
		const params = new URLSearchParams({
			client_id: service.clientId,
			response_type: service.responseType,
			scope: service.scope.join(' '),
			redirect_uri: window.location.origin + '/oauth/wca/login',
		});

		window.location.href = `${service.authEndpoint}?${params.toString()}`;
	}

	return (
		<>
			{/* Divider */}
			<div className="flex items-center gap-3 py-1">
				<div className="flex-1 h-px" style={{backgroundColor: 'rgba(255, 255, 255, 0.1)'}} />
				<span className="text-xs" style={{color: 'rgba(255, 255, 255, 0.4)'}}>
					{t('login.wca_divider')}
				</span>
				<div className="flex-1 h-px" style={{backgroundColor: 'rgba(255, 255, 255, 0.1)'}} />
			</div>

			{/* WCA Button */}
			<button
				type="button"
				onClick={handleClick}
				disabled={loading}
				className="w-full h-11 rounded-2xl font-semibold text-white hover:brightness-110 active:brightness-95 transition flex items-center justify-center gap-2"
				style={{
					backgroundColor: 'rgba(255, 255, 255, 0.08)',
					border: '1px solid rgba(255, 255, 255, 0.15)',
					opacity: loading ? 0.6 : 1,
				}}
			>
				<img
					src={resourceUri('/images/logos/wca_logo.svg')}
					alt="WCA"
					style={{width: '20px', height: '20px'}}
				/>
				{loading ? t('login.wca_connecting') : t('login.wca_login')}
			</button>

			{/* Not */}
			<p className="text-center" style={{color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.7rem', lineHeight: '1.3'}}>
				{t('login.wca_note')}
			</p>

			{/* Loading Overlay */}
			{loading && (
				<div
					style={{
						position: 'fixed',
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: 'rgba(0, 0, 0, 0.7)',
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 9999,
						gap: '16px',
					}}
				>
					<img
						src={resourceUri('/images/logos/wca_logo.svg')}
						alt="WCA"
						style={{width: '48px', height: '48px'}}
					/>
					<span style={{color: 'rgba(255, 255, 255, 0.8)', fontSize: '0.9rem'}}>
						{t('login.wca_connecting')}
					</span>
				</div>
			)}
		</>
	);
}
