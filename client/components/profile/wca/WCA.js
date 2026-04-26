import React from 'react';
import './WCA.scss';
import LinkButton from '../../common/button/LinkButton';
import Emblem from '../../common/emblem/Emblem';
import { Check } from 'phosphor-react';
import { useTranslation } from 'react-i18next';

export default function WCA({ myProfile, user }) {
	const { t } = useTranslation();

	const wcaInt = WCA.getWcaIntegration(user);

	let body;

	if (wcaInt) {
		const wcaId = wcaInt.wca_id;
		const emblem = <Emblem text={t('wca_integration.profile_connected')} icon={<Check weight="bold" />} green />;
		body = wcaId
			? <a target="_blank" href={`https://www.worldcubeassociation.org/persons/${wcaId}`}>{emblem}</a>
			: emblem;
	} else if (myProfile) {
		const redirectUri = window.location.origin + '/oauth/wca';
		const clientId = 'wY1dbmwDjPLkRtZVzLJXAcIGWkap1QNbVnuK-ulkDSY'; // Must match WCA_CLIENT_ID from .docker.env
		const u = new URL('https://www.worldcubeassociation.org/oauth/authorize');
		u.searchParams.set('client_id', clientId);
		u.searchParams.set('redirect_uri', redirectUri);
		u.searchParams.set('response_type', 'code');
		u.searchParams.set('scope', 'public');

		body = <LinkButton text={t('wca_integration.link_account')} to={u.toString()} blue />;
	}

	return <div className="cd-profile__wca">{body}</div>;
}

WCA.getWcaIntegration = (user) => {
	for (const int of user?.integrations || []) {
		if (int.service_name === 'wca') {
			return int;
		}
	}
	return null;
};
