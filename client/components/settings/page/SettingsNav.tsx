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
	Bluetooth,
	Shuffle,
	PaintBrush,
	Palette,
	Database,
	Translate,
} from 'phosphor-react';
import block from '../../../styles/bem';

const b = block('settings-nav');

export interface SettingsTab {
	id: string;
	link: string;
	label: string;
	// One outline icon in the text colour per row; the current row takes the accent.
	// A different colour per section read as decoration, not as wayfinding.
	icon: React.ReactNode;
}

// The first entry is also what `/settings` renders on desktop.
export function useSettingsTabs(): SettingsTab[] {
	const {t} = useTranslation();

	return [
		{
			id: 'timer',
			link: '/settings/timer',
			label: t('settings.tab_timer'),
			icon: <Timer />,
		},
		{
			id: 'input',
			link: '/settings/input',
			label: t('settings.tab_input'),
			icon: <Keyboard />,
		},
		{
			id: 'cubes',
			link: '/settings/cubes',
			label: t('cubes.tab'),
			icon: <Cube />,
		},
		{
			id: 'smart-cube',
			link: '/settings/smart-cube',
			label: t('settings.tab_smart_cube'),
			// Bluetooth, not a cube: My Cubes right above carries the cube.
			icon: <Bluetooth />,
		},
		{
			id: 'scramble',
			link: '/settings/scramble',
			label: t('settings.tab_scramble'),
			icon: <Shuffle />,
		},
		{
			id: 'appearance',
			link: '/settings/appearance',
			label: t('settings.tab_appearance'),
			icon: <PaintBrush />,
		},
		{
			id: 'colors',
			link: '/settings/colors',
			label: t('settings.tab_colors'),
			icon: <Palette />,
		},
		{
			id: 'data',
			link: '/settings/data',
			label: t('settings.tab_data'),
			icon: <Database />,
		},
		{
			id: 'language',
			link: '/settings/language',
			label: t('settings.tab_language'),
			icon: <Translate />,
		},
	];
}

export default function SettingsNav() {
	const tabs = useSettingsTabs();
	const {pathname} = useLocation();

	// `/settings` renders the first section on desktop, so treat it as that tab.
	// A section's sub-pages (a cube profile under /settings/cubes) keep the section lit.
	const current =
		pathname === '/settings'
			? tabs[0].link
			: tabs.find((tab) => pathname.startsWith(tab.link + '/'))?.link || pathname;

	return (
		<nav className={b()}>
			{tabs.map((tab) => {
				const active = current === tab.link;
				return (
					<Link
						key={tab.id}
						to={tab.link}
						className={b('item', {active})}
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
