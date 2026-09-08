// Section navigation for the settings page, built the way AccountNav is: one list
// serves both layouts, a sidebar on desktop and on mobile the index list that drills
// down into a section (see SettingsPage.scss).

import React from 'react';
import './SettingsNav.scss';
import {useTranslation} from 'react-i18next';
import {Link, useLocation} from 'react-router-dom';
import {motion} from 'framer-motion';
import {
	CaretRight,
	Timer,
	Keyboard,
	Cube,
	Shuffle,
	PaintBrush,
	Database,
	Translate,
} from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('settings-nav');

export interface SettingsTab {
	id: string;
	link: string;
	label: string;
	// Each section carries a cube-face colour, worn by its own icon. After a couple of
	// visits the shape and the colour together are what you aim for, which makes the
	// list scannable without reading every label.
	tone: string;
	icon: React.ReactNode;
}

const TONE = {
	blue: '36, 107, 253',
	green: '45, 189, 97',
	violet: '167, 139, 255',
	yellow: '245, 183, 0',
	orange: '238, 106, 38',
	cyan: '0, 176, 209',
	red: '226, 51, 67',
};

// The first entry is also what `/settings` renders on desktop.
export function useSettingsTabs(): SettingsTab[] {
	const {t} = useTranslation();

	return [
		{
			id: 'timer',
			link: '/settings/timer',
			label: t('settings.tab_timer'),
			tone: TONE.blue,
			icon: <Timer weight="fill" />,
		},
		{
			id: 'input',
			link: '/settings/input',
			label: t('settings.tab_input'),
			tone: TONE.green,
			icon: <Keyboard weight="fill" />,
		},
		{
			id: 'smart-cube',
			link: '/settings/smart-cube',
			label: t('settings.tab_smart_cube'),
			tone: TONE.violet,
			icon: <Cube weight="fill" />,
		},
		{
			id: 'scramble',
			link: '/settings/scramble',
			label: t('settings.tab_scramble'),
			tone: TONE.yellow,
			icon: <Shuffle weight="fill" />,
		},
		{
			id: 'appearance',
			link: '/settings/appearance',
			label: t('settings.tab_appearance'),
			tone: TONE.orange,
			icon: <PaintBrush weight="fill" />,
		},
		{
			id: 'data',
			link: '/settings/data',
			label: t('settings.tab_data'),
			tone: TONE.red,
			icon: <Database weight="fill" />,
		},
		{
			id: 'language',
			link: '/settings/language',
			label: t('settings.tab_language'),
			tone: TONE.cyan,
			icon: <Translate weight="fill" />,
		},
	];
}

export default function SettingsNav() {
	const tabs = useSettingsTabs();
	const {pathname} = useLocation();

	// `/settings` renders the first section on desktop, so treat it as that tab.
	const current = pathname === '/settings' ? tabs[0].link : pathname;

	return (
		<nav className={b()}>
			{tabs.map((tab) => {
				const active = current === tab.link;
				return (
					<Link
						key={tab.id}
						to={tab.link}
						className={b('item', {active})}
						style={{'--tab-tone': tab.tone} as React.CSSProperties}
						aria-current={active ? 'page' : undefined}
					>
						{/* Shared layoutId means the highlight travels between rows instead of
						    blinking out and in. Desktop only — on mobile the list is an index,
						    where nothing is "current" yet. */}
						{active ? (
							<motion.span
								layoutId="settings-nav-active"
								className={b('item-highlight')}
								transition={{type: 'spring', stiffness: 460, damping: 38}}
							/>
						) : null}
						<span className={b('item-icon')}>{tab.icon}</span>
						<span className={b('item-label')}>{tab.label}</span>
						<span className={b('item-chevron')}>
							<CaretRight weight="bold" />
						</span>
					</Link>
				);
			})}
		</nav>
	);
}
