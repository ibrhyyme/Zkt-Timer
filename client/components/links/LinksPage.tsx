// Link-in-bio page for the social accounts: the web app and the two stores, nothing
// else. Not in any menu and noindexed (Header's noIndexPaths); it is only reached
// through the link in a profile bio. Always dark (theme_lock.ts), like the landing.
//
// Its own shell like Help: no App shell (which server-renders nothing, and a visitor
// arriving from Instagram's in-app browser should see the buttons on the first frame)
// and no landing shell (whose nav would compete with the three buttons).

import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useLocation} from 'react-router-dom';
import {AppleLogo, ArrowUpRight, Globe, GooglePlayLogo} from 'phosphor-react';
import './LinksPage.scss';
import block from '../../styles/bem';
import Header from '../layout/header/Header';
import {updateThemeColors} from '../layout/themes';
import {APP_STORE_URL, PLAY_STORE_URL} from '../../util/store-links';

const b = block('links-page');

type LinkId = 'web' | 'ios' | 'android';

// Read from the user agent after mount, never during render: the server has no
// navigator, and a different first render would break hydration. iPadOS reports
// itself as a Mac, so a touch-capable Mac counts as iOS.
function detectPlatform(): LinkId {
	const ua = navigator.userAgent || '';
	if (/android/i.test(ua)) return 'android';
	if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
	if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'ios';
	return 'web';
}

export default function LinksPage() {
	const {t} = useTranslation();
	const location = useLocation();
	const [recommended, setRecommended] = useState<LinkId | null>(null);

	useEffect(() => {
		// Outside the App shell, which is where the theme is otherwise applied.
		updateThemeColors();
		setRecommended(detectPlatform());
	}, []);

	const links: {id: LinkId; href: string; icon: React.ReactElement; label: string; detail: string}[] = [
		{
			id: 'web',
			// `/` sends a visitor to the welcome page and a signed-in user to the timer.
			href: '/',
			icon: <Globe />,
			label: t('links_page.web'),
			detail: t('links_page.web_detail'),
		},
		{
			id: 'ios',
			href: APP_STORE_URL,
			icon: <AppleLogo weight="fill" />,
			label: t('links_page.ios'),
			detail: t('links_page.ios_detail'),
		},
		{
			id: 'android',
			href: PLAY_STORE_URL,
			icon: <GooglePlayLogo weight="fill" />,
			label: t('links_page.android'),
			detail: t('links_page.android_detail'),
		},
	];

	return (
		<div className={b()}>
			<Header path={location.pathname} title={t('links_page.meta_title')} description={t('links_page.tagline')} />

			<main className={b('body')}>
				<header className={b('head')}>
					<img className={b('logo')} src="/public/images/zkt-logo.png" alt="" />
					<h1 className={b('name')}>Zkt Timer</h1>
					<p className={b('tagline')}>{t('links_page.tagline')}</p>
				</header>

				<ul className={b('list')}>
					{links.map((link) => (
						<li key={link.id} className={b('item')}>
							<a
								className={b('link', {recommended: recommended === link.id})}
								href={link.href}
								rel={link.href.startsWith('http') ? 'noopener' : undefined}
							>
								<span className={b('link-icon')}>{link.icon}</span>
								<span className={b('link-text')}>
									<span className={b('link-label')}>{link.label}</span>
									<span className={b('link-detail')}>{link.detail}</span>
								</span>
								<ArrowUpRight className={b('link-arrow')} />
							</a>
						</li>
					))}
				</ul>

				<footer className={b('foot')}>zktimer.app</footer>
			</main>
		</div>
	);
}
