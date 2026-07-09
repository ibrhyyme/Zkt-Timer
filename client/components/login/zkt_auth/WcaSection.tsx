import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LINKED_SERVICES } from '../../../../shared/integration';
import { resourceUri } from '../../../util/storage';
import { createAndStoreOAuthState } from '../../../util/oauth_state';
import { wcaRedirectUri, openWcaAuthorize } from '../../../util/oauth-native';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	onTrigger?: () => void;
}

export default function WcaSection({ onTrigger }: Props) {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);

	function handleClick() {
		if (loading) return;
		if (onTrigger) onTrigger();
		setLoading(true);

		const oauthState = createAndStoreOAuthState();
		const service = LINKED_SERVICES.wca;
		const params = new URLSearchParams({
			client_id: service.clientId,
			response_type: service.responseType,
			scope: service.scope.join(' '),
			redirect_uri: wcaRedirectUri('/oauth/wca/login'),
			state: oauthState,
		});

		openWcaAuthorize(`${service.authEndpoint}?${params.toString()}`);
	}

	return (
		<div className={b('wca-section')}>
			<button
				type="button"
				className={b('btn', { wca: true })}
				onClick={handleClick}
				disabled={loading}
			>
				<img
					src={resourceUri('/images/logos/wca_logo.svg')}
					alt="WCA"
					className={b('wca-logo-img')}
				/>
				<span>{loading ? t('zkt_auth.connecting') : t('zkt_auth.continue_with_wca')}</span>
			</button>
			<div className={b('divider')}>
				<span>{t('zkt_auth.divider_or_email')}</span>
			</div>
		</div>
	);
}
