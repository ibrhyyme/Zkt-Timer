import React from 'react';
import { useTranslation } from 'react-i18next';
import './About.scss';
import { YoutubeLogo, TwitchLogo } from 'phosphor-react';
import Emblem from '../../common/emblem/Emblem';
import { Profile } from '../../../@types/generated/graphql';
import block from '../../../styles/bem';
import { resourceUri } from '../../../util/storage';

const b = block('profile-about');

interface Props {
	profile: Profile;
}

export default function About(props: Props) {
	const { t } = useTranslation();
	const { profile } = props;

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
				{name && <span className="ml-2 text-inherit">{name}</span>}
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
	addSocial(socialLinks, 'twitter_link', '', <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>, '#000000', 'white');
	addSocial(socialLinks, 'reddit_link', 'WCA', <WCAIcon />, '#1976D2', 'white');

	if (socialLinks.length) {
		social = (
			<div>
				<Emblem text={t('profile.socials')} />
				<div className="flex flex-row flex-wrap">{socialLinks}</div>
			</div>
		);
	}

	return (
		<div className={b()}>
			<h2>{t('profile.about_me')}</h2>
			<div className={b('body')}>
				<div className={b('header')}>
					{social}
					<div className={b('bio')}>
						<Emblem text={t('profile.biography')} />
						<p>{profile.bio || <i>{t('profile.no_bio')}</i>}</p>
					</div>
				</div>

				<div className={b('details')}>
					<div className={b('detail-block')}>
						<Emblem text={t('profile.method_3x3')} />
						<span>{profile.three_method || '-'}</span>
					</div>
					<div className={b('detail-block')}>
						<Emblem text={t('profile.goal_3x3')} />
						<span>{profile.three_goal || '-'}</span>
					</div>
					<div className={b('detail-block')}>
						<Emblem text={t('profile.main_3x3_cube')} />
						<span>{profile.main_three_cube || '-'}</span>
					</div>
					<div className={b('detail-block')}>
						<Emblem text={t('profile.favorite_event')} />
						<span>{profile.favorite_event || '-'}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
