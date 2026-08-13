// Vertical account navigation. Replaces the wrapping chip row (generic HorizontalNav
// rendered as Buttons), which spilled onto three lines on mobile and got worse with
// every tab added.
//
// One list serves both layouts: a sidebar on desktop, and on mobile the index list
// that drills down into a section (see Account.scss).

import React from 'react';
import './AccountNav.scss';
import {useTranslation} from 'react-i18next';
import {Link, useLocation} from 'react-router-dom';
import {motion} from 'framer-motion';
import {CaretRight} from 'phosphor-react';
import AvatarImage from '../common/avatar/avatar_image/AvatarImage';
import {useMe} from '../../util/hooks/useMe';
import {isPro} from '../../util/pro';
import block from '../../styles/bem';

const b = block('account-nav');

export interface AccountTab {
	id: string;
	link: string;
	label: string;
	// Each section carries a cube-face colour, shown as a sticker tile. It is not
	// decoration: after a couple of visits the colour is what you aim for, and it makes
	// the list scannable without reading every label.
	tone: string;
	danger?: boolean;
}

const TONE = {
	blue: '36, 107, 253',
	yellow: '245, 183, 0',
	green: '45, 189, 97',
	orange: '238, 106, 38',
	violet: '167, 139, 255',
	// A cube's white face would vanish against the light theme's white page, so support
	// takes the one tone that stays readable on both.
	cyan: '0, 176, 209',
	red: '226, 51, 67',
};

export function useAccountTabs(): AccountTab[] {
	const {t} = useTranslation();

	return [
		{
			id: 'personal-info',
			link: '/account/personal-info',
			label: t('account_nav.personal_info'),
			tone: TONE.blue,
		},
		{
			id: 'notifications',
			link: '/account/notifications',
			label: t('account_nav.notifications'),
			tone: TONE.yellow,
		},
		{
			id: 'social',
			link: '/account/social',
			label: t('account_nav.social'),
			tone: TONE.green,
		},
		{
			id: 'linked-accounts',
			link: '/account/linked-accounts',
			label: t('account_nav.linked_accounts'),
			tone: TONE.orange,
		},
		{
			id: 'announcements',
			link: '/account/announcements',
			label: t('account_nav.announcements'),
			tone: TONE.violet,
		},
		{
			id: 'support',
			link: '/account/support',
			label: t('account_nav.support'),
			tone: TONE.cyan,
		},
		{
			id: 'danger-zone',
			link: '/account/danger-zone',
			label: t('account_nav.danger_zone'),
			tone: TONE.red,
			danger: true,
		},
	];
}

export default function AccountNav() {
	const tabs = useAccountTabs();
	const {pathname} = useLocation();
	const me = useMe();

	// `/account` renders the first section on desktop, so treat it as that tab.
	const current = pathname === '/account' ? '/account/personal-info' : pathname;

	return (
		<div className={b()}>
			{me ? (
				<div className={b('identity')}>
					<div className={b('identity-avatar')}>
						<AvatarImage user={me} profile={me.profile} />
					</div>
					<div className={b('identity-text')}>
						<span className={b('identity-name')}>{me.username}</span>
						{isPro(me) ? <span className={b('identity-badge')}>Pro</span> : null}
					</div>
				</div>
			) : null}

			<nav className={b('list')}>
				{tabs.map((tab) => {
					const active = current === tab.link;
					return (
						<Link
							key={tab.id}
							to={tab.link}
							className={b('item', {active, danger: !!tab.danger})}
							style={{'--tab-tone': tab.tone} as React.CSSProperties}
							aria-current={active ? 'page' : undefined}
						>
							{/* Shared layoutId means the highlight travels between rows instead of
							    blinking out and in. Desktop only — on mobile the list is an index,
							    where nothing is "current" yet. */}
							{active ? (
								<motion.span
									layoutId="account-nav-active"
									className={b('item-highlight')}
									transition={{type: 'spring', stiffness: 460, damping: 38}}
								/>
							) : null}
							<span className={b('item-sticker')} />
							<span className={b('item-label')}>{tab.label}</span>
							<span className={b('item-chevron')}>
								<CaretRight weight="bold" />
							</span>
						</Link>
					);
				})}
			</nav>
		</div>
	);
}
