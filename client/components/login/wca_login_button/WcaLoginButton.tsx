import React from 'react';
import {useTranslation} from 'react-i18next';
import {LINKED_SERVICES} from '../../../../shared/integration';
import {resourceUri} from '../../../util/storage';

export default function WcaLoginButton() {
	const {t} = useTranslation();

	function handleClick() {
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
				className="w-full h-11 rounded-2xl font-semibold text-white hover:brightness-110 active:brightness-95 transition flex items-center justify-center gap-2"
				style={{
					backgroundColor: 'rgba(255, 255, 255, 0.08)',
					border: '1px solid rgba(255, 255, 255, 0.15)',
				}}
			>
				<img
					src={resourceUri('/images/logos/wca_logo.svg')}
					alt="WCA"
					style={{width: '20px', height: '20px'}}
				/>
				{t('login.wca_login')}
			</button>

			{/* Not */}
			<p className="text-center" style={{color: 'rgba(255, 255, 255, 0.35)', fontSize: '0.7rem', lineHeight: '1.3'}}>
				{t('login.wca_note')}
			</p>
		</>
	);
}
