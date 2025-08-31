import React from 'react';
import './About.scss';
import {YoutubeLogo, TwitterLogo, TwitchLogo} from 'phosphor-react';
import Emblem from '../../common/emblem/Emblem';
import {Profile} from '../../../@types/generated/graphql';
import block from '../../../styles/bem';
import {resourceUri} from '../../../util/storage';

const b = block('profile-about');

interface Props {
	profile: Profile;
}

export default function About(props: Props) {
	const {profile} = props;

	function addSocial(list, key, name, icon: React.ReactElement, background, color) {
		if (!profile[key]) {
			return null;
		}

		const classNames = ['rounded-full', 'flex', 'items-center', 'px-3', 'py-1', 'font-bold', 'mr-3 mb-3'];

		list.push(
			<a
				className={classNames.join(' ')}
				style={{
					backgroundColor: background,
					color: color,
				}}
				key={key}
				target="_blank"
				href={profile[key]}
			>
				{icon}
				<span className="ml-2 text-inherit">{name}</span>
			</a>
		);
	}

	let social = null;
	const socialLinks = [];

	// WCA logo component
	const WCAIcon = () => (
		<img 
			src={resourceUri('/images/logos/wca_logo.svg')} 
			alt="WCA" 
			style={{ width: '16px', height: '16px' }}
		/>
	);

	addSocial(socialLinks, 'youtube_link', 'YouTube', <YoutubeLogo weight="fill" />, '#FF0000', 'white');
	addSocial(socialLinks, 'twitch_link', 'Twitch', <TwitchLogo weight="fill" />, '#6441A4', 'white');
	addSocial(socialLinks, 'twitter_link', 'Twitter', <TwitterLogo weight="fill" />, '#1DA1F2', 'white');
	addSocial(socialLinks, 'reddit_link', 'WCA', <WCAIcon />, '#1976D2', 'white');

	if (socialLinks.length) {
		social = (
			<div>
				<Emblem text="Socials" />
				<div className="flex flex-row flex-wrap">{socialLinks}</div>
			</div>
		);
	}

	return (
		<div className={b()}>
			<h2>Hakkımda</h2>
			<div className={b('body')}>
				<div className={b('header')}>
					{social}
					<div className={b('bio')}>
						<Emblem text="Biyografi" />
						<p>{profile.bio || <i>Henüz biyografi yok</i>}</p>
					</div>
				</div>

				<div className={b('details')}>
					<div className={b('detail-block')}>
						<Emblem text="3x3 Yöntemi" />
						<span>{profile.three_method || '-'}</span>
					</div>
					<div className={b('detail-block')}>
						<Emblem text="3x3 Hedefi" />
						<span>{profile.three_goal || '-'}</span>
					</div>
					<div className={b('detail-block')}>
						<Emblem text="Ana 3x3 Küpü" />
						<span>{profile.main_three_cube || '-'}</span>
					</div>
					<div className={b('detail-block')}>
						<Emblem text="Favori Etkinlik" />
						<span>{profile.favorite_event || '-'}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
