import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useRouteMatch } from 'react-router-dom';
import './HeaderNav.scss';
import { setGeneral } from '../../../actions/general';
import {
	ArrowRight,
	List,
	X,
	Cube,
} from 'phosphor-react';
import Notifications from '../nav/notifications/Notifications';
import Logo from '../../common/logo/Logo';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useWindowListener } from '../../../util/hooks/useListener';
import { useSettings } from '../../../util/hooks/useSettings';
import { useTheme } from '../../../util/hooks/useTheme';
import block from '../../../styles/bem';
import AccountDropdown from '../nav/account_dropdown/AccountDropdown';
import { useMe } from '../../../util/hooks/useMe';
import { NAV_LINKS, NavLinkProps } from '../nav/Nav';
import Button from '../../common/button/Button';
import LoginNav from '../nav/LoginNav';
import { resourceUri } from '../../../util/storage';
import { isPro } from '../../../util/pro';
import AnnouncementBell from '../../announcements/AnnouncementBell';

const b = block('header-nav');

interface HeaderNavLinkProps extends NavLinkProps {
	selected?: boolean;
}

function HeaderNavLink(props: HeaderNavLinkProps) {
	const { name, icon, newTag, loginRequired, selected } = props;
	let link = props.link;
	const me = useMe();

	// if (link === '/' && !me) {
	// 	link = '/demo';
	// }

	const linkClasses = [
		'inline-flex',
		'items-center',
		'gap-2',
		'h-9',
		'px-3',
		'rounded-lg',
		'border',
		'transition',
		'transition-transform',
		'focus:outline-none',
		'focus-visible:ring-2',
		'focus-visible:ring-indigo-400/70',
		'hover:-translate-y-[1px]',
		'active:translate-y-0',
	];

	if (selected) {
		linkClasses.push(
			'text-white',
			'bg-gradient-to-r',
			'from-indigo-500/70',
			'to-fuchsia-500/60',
			'border-transparent',
			'shadow-[0_8px_24px_rgba(99,102,241,0.25)]'
		);
	} else {
		linkClasses.push(
			'text-white/90',
			'hover:text-white',
			'bg-white/5',
			'hover:bg-white/10',
			'border-white/10'
		);
	}

	return (
		<Link to={link} className={linkClasses.join(' ')}>
			<span className="text-lg">{icon}</span>
			<span>{name}</span>
		</Link>
	);
}

export default function HeaderNav() {
	const dispatch = useDispatch();
	const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

	const match = useRouteMatch();
	const me = useMe();

	const focusMode = useSettings('focus_mode');
	const mobileMode = useGeneral('mobile_mode');

	useWindowListener('resize', windowResize, [mobileMode]);

	useEffect(() => {
		windowResize();
	}, []);

	function windowResize() {
		// Basit bir User Agent kontrolü ile mobil/tablet tespiti
		const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
		const isMobileDevice = /android|ipad|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());

		// 1. Ekran 768px veya altındaysa
		// 2. Veya cihaz bir mobil/tablet cihazıysa (genişlik ne olursa olsun mobil modda kalsın isteniyor)
		// 3. Veya ekran yüksekliği 500px altındaysa (landscape telefon)
		const shouldBeMobile = window.innerWidth <= 768 || isMobileDevice || window.innerHeight <= 500;

		if (shouldBeMobile && !mobileMode) {
			dispatch(setGeneral('mobile_mode', true));
		} else if (!shouldBeMobile && mobileMode) {
			dispatch(setGeneral('mobile_mode', false));
		}
	}

	let pathname = '';
	if (match) {
		pathname = match.path;
	}

	if (focusMode) {
		return null;
	}

	let notifications = <Notifications />;
	if (!me) {
		notifications = null;
	}

	const navLinks = NAV_LINKS.map((link) => (
		<HeaderNavLink {...link} key={link.name} selected={link.match.test(pathname)} />
	));

	// Pro features are now available to everyone
	let getPro = null;

	// Mobile: No header nav needed, Timer has its own HeaderControl
	if (mobileMode) {
		return null;
	}

	// Desktop header
	return (
		<div className={b()}>
			<div className={b('container')}>
				{/* Left side - Brand Link with Animated Cube */}
				<div className={b('left')}>
					<Link
						to="/"
						className="text-white hover:text-cyan-50 font-bold tracking-tight select-none text-2xl flex items-center gap-2"
						style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
					>
						<img
							src="/public/images/zkt-logo.png"
							alt="Zeka Küpü Türkiye"
							className={b('logo') + " w-20 h-20 object-contain"}
							style={{
								imageRendering: 'auto',
								filter: 'brightness(1.1) contrast(1.05)',
								WebkitBackfaceVisibility: 'hidden',
								transform: 'translateZ(0)'
							}}
						/>
						Zkt-Timer
					</Link>
				</div>

				{/* Center - Navigation Links */}
				<div className={b('center')}>
					<nav className={b('nav')}>
						{navLinks}
					</nav>
				</div>

				{/* Right side - Pro button, notifications, account */}
				<div className={b('right')}>
					{getPro}
					{me && <AnnouncementBell />}
					<AccountDropdown />
					{me && <LoginNav collapsed={false} />}
				</div>
			</div>
		</div>
	);
}
