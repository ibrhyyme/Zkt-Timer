import React from 'react';
import './WCA.scss';
import LinkButton from '../../common/button/LinkButton';
import { useTranslation } from 'react-i18next';

export default function WCA({ myProfile, user }) {
	const { t } = useTranslation();

	const wcaInt = WCA.getWcaIntegration(user);

	// If WCA is linked, no badge is shown — when competition history is opened, the WCA ID link
	// is already generated from the WCA records section.
	// Only show "Link" button on own profile if not yet linked.
	if (wcaInt) return null;

	if (!myProfile) return null;

	const redirectUri = window.location.origin + '/oauth/wca';
	const clientId = 'wY1dbmwDjPLkRtZVzLJXAcIGWkap1QNbVnuK-ulkDSY'; // Must match WCA_CLIENT_ID from .docker.env
	const u = new URL('https://www.worldcubeassociation.org/oauth/authorize');
	u.searchParams.set('client_id', clientId);
	u.searchParams.set('redirect_uri', redirectUri);
	u.searchParams.set('response_type', 'code');
	u.searchParams.set('scope', 'public');

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
