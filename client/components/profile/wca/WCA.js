import React from 'react';
import './WCA.scss';
import LinkButton from '../../common/button/LinkButton';
import { useTranslation } from 'react-i18next';
import { LINKED_SERVICES } from '../../../../shared/integration';
import { wcaRedirectUri, markNativeOAuthState } from '../../../util/oauth-native';

export default function WCA({ myProfile, user }) {
	const { t } = useTranslation();

	const wcaInt = WCA.getWcaIntegration(user);

	// If WCA is linked, no badge is shown — when competition history is opened, the WCA ID link
	// is already generated from the WCA records section.
	// Only show "Link" button on own profile if not yet linked.
	if (wcaInt) return null;

	if (!myProfile) return null;

	const u = new URL('https://www.worldcubeassociation.org/oauth/authorize');
	u.searchParams.set('client_id', LINKED_SERVICES.wca.clientId);
	u.searchParams.set('redirect_uri', wcaRedirectUri('/oauth/wca'));
	u.searchParams.set('response_type', 'code');
	u.searchParams.set('scope', 'public');
	// Native relay marker + return path for the linking flow (OAuthService unwraps it)
	u.searchParams.set('state', markNativeOAuthState('/account/linked-accounts'));

	return (
		<div className="cd-profile__wca">
			<LinkButton text={t('wca_integration.link_account')} to={u.toString()} blue />
		</div>
	);
}

WCA.getWcaIntegration = (user) => {
	for (const int of user?.integrations || []) {
		if (int.service_name === 'wca') {
			return int;
		}
	}
	return null;
};
