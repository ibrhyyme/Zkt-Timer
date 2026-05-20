import React from 'react';
import WCA from '../../../profile/wca/WCA';
import Emblem from '../../emblem/Emblem';
import {getDateFromNow} from '../../../../util/dates';

export default class Badges extends React.Component {
	render() {
		const {user, small, limit} = this.props;

		let emblems = null;
		let ems = [];
		const wca = WCA.getWcaIntegration(user);

		if (user.banned_forever || user.banned_until) {
			let text;
			if (user.banned_forever) {
				text = 'Banned Forever';
			} else if (user.banned_until) {
				const until = getDateFromNow(user.banned_until, true);
				text = `Banned for ${until}`;
			}

			ems.push(<Emblem small={small} key="banned" text={text} color="#444" />);
		}

		if (user.admin) {
			ems.push(<Emblem small={small} key="admin" text="Admin" red />);
		}

		if (wca) {
			const wcaEmblem = <Emblem small={small} text="WCA Profile" green />;
			if (wca.wca_id) {
				ems.push(
					<a
						key={wca.id}
						href={`https://www.worldcubeassociation.org/persons/${wca.wca_id}`}
						target="_blank"
						rel="noopener noreferrer"
						style={{textDecoration: 'none'}}
						onClick={(e) => e.stopPropagation()}
					>
						{wcaEmblem}
					</a>
				);
			} else {
				ems.push(<React.Fragment key={wca.id}>{wcaEmblem}</React.Fragment>);
			}
		}

		const badges = [...(user.badges || [])].sort((a, b) => a.priority - b.priority);

		for (const badge of badges) {
			const type = badge.badge_type;
			ems.push(<Emblem key={type.id} text={type.name} color={type.color} small={small} />);
		}

		const maxSize = limit;
		const emsSize = ems.length;
		if (limit && emsSize > maxSize) {
			ems = ems.slice(0, maxSize);
			ems.push(<Emblem small={small} key="more" text={`+${emsSize - maxSize}`} color="#333" />);
		}

		if (ems.length) {
			emblems = <div className="cd-avatar__emblems">{ems}</div>;
		}

		return emblems;
	}
}
