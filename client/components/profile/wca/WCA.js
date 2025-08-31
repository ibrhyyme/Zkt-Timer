import React from 'react';
import './WCA.scss';
import LinkButton from '../../common/button/LinkButton';
import Emblem from '../../common/emblem/Emblem';
import {gql} from '@apollo/client';
import {Check} from 'phosphor-react';
import {gqlQuery} from '../../api';

export default class WCA extends React.Component {
	constructor(props) {
		super(props);

		this.state = {
			wcaMe: null,
		};
	}

	async componentDidMount() {
		const query = gql`
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

		const res = await gqlQuery(query);

		this.setState({
			wcaMe: res.data.wcaMe,
		});
	}

	static getWcaIntegration = (user) => {
		for (const int of user?.integrations || []) {
			if (int.service_name === 'wca') {
				return int;
			}
		}

		return null;
	};

	render() {
		const {wcaMe} = this.state;
		const {myProfile, user} = this.props;
		const wcaInt = WCA.getWcaIntegration(user);

		let body;

		if (wcaInt) {
			if (wcaMe) {
				body = (
					<a target="_blank" href={wcaMe.url || null}>
						<Emblem text="WCA Profili Bağlandı" icon={<Check weight="bold" />} green />
					</a>
				);
			}
		} else if (myProfile) {
			const redirectUri = window.location.origin + '/oauth/wca';
			const clientId = 'sMMsypt_sP1zDaRv6Cx45XKtDI16QobZ3MiDqEjtFC4'; // Must match WCA_CLIENT_ID from .docker.env
			const u = new URL('https://www.worldcubeassociation.org/oauth/authorize');
			u.searchParams.set('client_id', clientId);
			u.searchParams.set('redirect_uri', redirectUri);
			u.searchParams.set('response_type', 'code');
			u.searchParams.set('scope', 'public');

			body = <LinkButton text="WCA Hesabını Bağla" to={u.toString()} blue />;
		}

		return <div className="cd-profile__wca">{body}</div>;
	}
}
