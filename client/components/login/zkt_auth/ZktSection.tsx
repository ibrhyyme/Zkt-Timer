import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LINKED_SERVICES } from '../../../../shared/integration';
import { resourceUri } from '../../../util/storage';
import { createAndStoreOAuthState } from '../../../util/oauth_state';
import { oauthRedirectUri, openOAuthAuthorize } from '../../../util/oauth-native';
import block from '../../../styles/bem';

const b = block('zkt-auth');

interface Props {
	onTrigger?: () => void;
	/** Rendered above WcaSection, which draws the "or e-mail" divider. */
	showDivider?: boolean;
	/** Signup tab says "sign up", not "log in" — same button, different promise. */
	mode?: 'login' | 'signup';
}

/**
 * "Continue with Zeka Küpü Türkiye" — the federation's own sign-in.
 *
 * Sits above the WCA button on purpose: ZKT is the identity that matters to a
 * Turkish competitor now (it is what their competition results are keyed on),
 * and WCA is the older door.
 */
export default function ZktSection({ onTrigger, showDivider = false, mode = 'login' }: Props) {
	const { t } = useTranslation();
	const [loading, setLoading] = useState(false);

	function handleClick() {
		if (loading) return;
		if (onTrigger) onTrigger();
		setLoading(true);

		const oauthState = createAndStoreOAuthState();
		const service = LINKED_SERVICES.zkt;
		const params = new URLSearchParams({
			client_id: service.clientId,
			response_type: service.responseType,
			scope: service.scope.join(' '),
			redirect_uri: oauthRedirectUri('/oauth/zkt/login'),
			state: oauthState,
		});

		openOAuthAuthorize(`${service.authEndpoint}?${params.toString()}`);
	}

	return (
		<div className={b('wca-section')}>
			<button
				type="button"
				className={b('btn', { zkt: true })}
				onClick={handleClick}
				disabled={loading}
			>
				<img
					src={resourceUri('/images/logos/zkt_logo.png')}
					alt="Zeka Küpü Türkiye"
					className={b('zkt-logo-img')}
				/>
				<span>
					{loading
						? t('zkt_auth.connecting')
						: t(mode === 'signup' ? 'zkt_auth.signup_with_zkt' : 'zkt_auth.continue_with_zkt')}
				</span>
			</button>
			{showDivider && (
				<div className={b('divider')}>
					<span>{t('zkt_auth.divider_or_email')}</span>
				</div>
			)}
		</div>
	);
}
