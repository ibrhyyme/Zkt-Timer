import React, { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useRouteMatch } from 'react-router-dom';
import './Nav.scss';
import { setSetting } from '../../../db/settings/update';
import { setGeneral } from '../../../actions/general';
import {
	ArrowLeft,
	Handshake,
	ChartPie,
	LadderSimple,
	Users,
	ListBullets,
	Rows,
	Wrench,
	Timer,
	ArrowRight,
	Sword,
} from 'phosphor-react';
import Notifications from './notifications/Notifications';
import Logo from '../../common/logo/Logo';
import MobileNav from './mobile_nav/MobileNav';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useWindowListener } from '../../../util/hooks/useListener';
import { useSettings } from '../../../util/hooks/useSettings';
import { useTheme } from '../../../util/hooks/useTheme';
import block from '../../../styles/bem';
import AccountDropdown from './account_dropdown/AccountDropdown';
import { useMe } from '../../../util/hooks/useMe';
import NavLink from './NavLink';
import Button from '../../common/button/Button';
import LoginNav from './LoginNav';
import LanguageSwitcher from '../../common/language_switcher/LanguageSwitcher';
import { resourceUri } from '../../../util/storage';
import { isPro } from '../../../util/pro';
import { useTranslation } from 'react-i18next';
import { useSiteConfig } from '../../../util/hooks/useSiteConfig';

const b = block('nav');

// Nav link adi → SiteConfig feature key
const NAV_FEATURE_MAP: Record<string, string> = {
	'nav.trainer': 'trainer_enabled',
	'nav.community': 'community_enabled',
	'nav.rooms': 'rooms_enabled',
	'nav.battle': 'battle_enabled',
};

export interface NavLinkProps {
	name: string;
	icon: React.ReactElement;
	match: RegExp;
	link: string;
	newTag?: boolean;
	loginRequired?: boolean;
	mobileOnly?: boolean;
}

export const NAV_LINKS: NavLinkProps[] = [
	{
		name: 'nav.timer',
		icon: <Timer weight="bold" />,
		match: /(^\/$|^$|^\/timer)/,
		link: '/timer',
	},
	{
		name: 'nav.battle',
		icon: <Sword weight="bold" />,
		match: /^\/battle/,
		link: '/battle',
		loginRequired: false,
		mobileOnly: true,
	},
	{
		name: 'nav.rooms',
		icon: <Handshake weight="bold" />,
		match: /^\/rooms/,
		link: '/rooms',
		loginRequired: true,
	},
	{
		name: 'nav.stats',
		icon: <ChartPie weight="bold" />,
		match: /^\/stats/,
		link: '/stats',
		loginRequired: true,
	},
	{
		name: 'nav.community',
		icon: <Users weight="bold" />,
		match: /^\/community/,
		link: '/community/competitions',
		loginRequired: false,
	},
	{
		name: 'nav.trainer',
		icon: <LadderSimple weight="bold" />,
		match: /^\/trainer/,
		link: '/trainer',
		loginRequired: true,
	},
	{
		name: 'nav.solves',
		icon: <ListBullets weight="bold" />,
		match: /^\/solves/,
		link: '/solves',
		loginRequired: false,
	},
	{
		name: 'nav.sessions',
		icon: <Rows weight="bold" />,
		match: /^\/sessions/,
		link: '/sessions',
		loginRequired: true,
	},
];

export default function Nav() {
	const dispatch = useDispatch();
	const { t } = useTranslation();

	const match = useRouteMatch();
	const me = useMe();
	const siteConfig = useSiteConfig();
	const isAdmin = !!me?.admin;

	const focusMode = useSettings('focus_mode');
	const moduleColor = useTheme('module_color');

	const navCollapsed = useSettings('nav_collapsed');
	const mobileMode = useGeneral('mobile_mode');
	const forceNavCollapsed = useGeneral('force_nav_collapsed');

	useWindowListener('resize', windowResize, [navCollapsed, mobileMode, forceNavCollapsed]);

	useEffect(() => {
		windowResize();
	}, []);

	function windowResize() {
		if (window.innerWidth <= 1080 && !forceNavCollapsed) {
			dispatch(setGeneral('force_nav_collapsed', true));
		} else if (window.innerWidth > 1080 && forceNavCollapsed) {
			dispatch(setGeneral('force_nav_collapsed', false));
		}

		if (window.innerWidth <= 750 && !mobileMode) {
			dispatch(setGeneral('mobile_mode', true));
		} else if (window.innerWidth > 750 && mobileMode) {
			dispatch(setGeneral('mobile_mode', false));
		}
	}

	function toggleCollapse() {
		setSetting('nav_collapsed', !navCollapsed);
	}

	let pathname = '';
	if (match) {
		pathname = match.path;
	}

	const navClosed = navCollapsed || forceNavCollapsed;

	if (focusMode) {
		return null;
	}

	if (mobileMode) {
		return (
			<div
				className={b('mobile-header')}
				style={{
					position: 'absolute',
					top: 0,
					right: 0,
					zIndex: 1000,
					display: 'flex',
					padding: '12px 20px',
					pointerEvents: 'none',
					justifyContent: 'flex-end',
					width: '100%',
					boxSizing: 'border-box'
				}}
			>
				<div style={{ pointerEvents: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
					<LanguageSwitcher />
					<MobileNav />
					<AccountDropdown />
				</div>
			</div>
		);
	}

	const navLinks = NAV_LINKS
		.filter((link) => !link.mobileOnly)
		.filter((link) => {
			// Site config'e gore feature kapali ise admin haric gizle
			const featureKey = NAV_FEATURE_MAP[link.name];
			if (!featureKey || !siteConfig) return true;
			const enabled = (siteConfig as any)[featureKey];
			if (enabled) return true;
			// Kapali → admin gorur, diger gizle
			return isAdmin;
		})
		.map((link) => {
			const featureKey = NAV_FEATURE_MAP[link.name];
			const isDisabled = featureKey && siteConfig && !(siteConfig as any)[featureKey];
			return (
				<NavLink
					{...link}
					key={link.name}
					collapsed={navClosed}
					selected={link.match.test(pathname)}
					disabled={isDisabled}
				/>
			);
		});

	// Pro features are now available to everyone
	let getPro = null;

	return (
		<div className={b({ collapsed: navClosed })}>
			<div className={b('wrapper')}>
				<div className={b('body')}>
					<div className={b('top-section')}>
						<div className={b('header')}>
							<Logo large={true} dark={!moduleColor.isDark} />
							<Logo dark={!moduleColor.isDark} />
							<div className={b('header-actions')}>
								<AccountDropdown />
							</div>
						</div>
						{getPro}
						<div className="mt-4">{navLinks}</div>
						<LoginNav collapsed={navClosed} />
					</div>
					<div className={b('bottom-section')}>
						<LanguageSwitcher />
						<Button
							large
							iconFirst
							hidden={forceNavCollapsed}
							text={navCollapsed ? '' : t('nav.collapse')}
							icon={navCollapsed ? <ArrowRight weight="fill" /> : <ArrowLeft weight="fill" />}
							transparent
							className={b('collapse-button')}
							type="button"
							onClick={toggleCollapse}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

interface SocialIconInterface {
	name: string;
	href: string;
	darkPath: string;
	lightPath: string;
}

function SocialIcon(props: SocialIconInterface) {
	const { darkPath, name, href, lightPath } = props;
	const moduleColor = useTheme('module_color');

	let path = darkPath;
	if (!moduleColor.isDark) {
		path = lightPath;
	}

	return (
		<a href={href} target="_blank">
			<img src={path} alt={`${name} logo`} />
		</a>
	);
}
