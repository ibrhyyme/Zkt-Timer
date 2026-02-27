import React, { useState, useEffect } from 'react';
import './WCA.scss';
import LinkButton from '../../common/button/LinkButton';
import Emblem from '../../common/emblem/Emblem';
import { gql } from '@apollo/client';
import { Check } from 'phosphor-react';
import { gqlQuery } from '../../api';
import { useTranslation } from 'react-i18next';

const WCA_ME_QUERY = gql`
	query Query {
		wcaMe {
			id
			url
			country_iso2
			wca_id
			created_at
		}
	}
`;

export default function WCA({ myProfile, user }) {
	const { t } = useTranslation();
	const [wcaMe, setWcaMe] = useState(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await gqlQuery(WCA_ME_QUERY);
				setWcaMe(res.data.wcaMe);
			} catch (e) {
				// Integration not found or other error
			}
		})();
	}, []);

	const wcaInt = WCA.getWcaIntegration(user);

	let body;

	if (wcaInt) {
		if (wcaMe) {
			body = (
				<a target="_blank" href={wcaMe.url || null}>
					<Emblem text={t('wca_integration.profile_connected')} icon={<Check weight="bold" />} green />
				</a>
			);
		}
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
