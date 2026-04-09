import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { Link, useRouteMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
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
import LanguageSwitcher from '../../common/language_switcher/LanguageSwitcher';
import { resourceUri } from '../../../util/storage';
import { isPro } from '../../../util/pro';
import AnnouncementBell from '../../announcements/AnnouncementBell';

const b = block('header-nav');

interface HeaderNavLinkProps extends NavLinkProps {
	selected?: boolean;
	hovered?: boolean;
	onHoverStart?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
	onHoverEnd?: () => void;
}

function HeaderNavLink(props: HeaderNavLinkProps) {
	const { name, icon, newTag, loginRequired, selected, hovered, onHoverStart, onHoverEnd } = props;
	let link = props.link;
	const { t } = useTranslation();
	const me = useMe();

	const linkClasses = [
		'inline-flex',
		'items-center',
		'gap-2',
		'h-9',
		'px-3',
		'rounded-lg',
		'border',
		'transition-all',
		'focus:outline-none',
		'focus-visible:ring-2',
		'focus-visible:ring-indigo-400/70',
		'hover:-translate-y-[1px]',
		'active:translate-y-0',
		'relative',
		'z-[1]',
	];

	if (selected || hovered) {
		linkClasses.push(
			'text-white',
			'border-transparent',
		);
	} else {
		linkClasses.push(
			'text-text/90',
			'hover:text-text',
			'bg-text/5',
			'hover:bg-text/10',
			'border-text/10'
		);
	}

	return (
		<Link
			to={link}
			className={linkClasses.join(' ')}
			data-active={selected || undefined}
			onMouseEnter={onHoverStart}
			onMouseLeave={onHoverEnd}
		>
			<span className="text-lg">{icon}</span>
			<span>{t(name)}</span>
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
	const bgTheme = useTheme('background_color');
	const isLightTheme = bgTheme && !bgTheme.isDark;

	// Pill nav state
	const navRef = useRef<HTMLElement>(null);
	const [pillPos, setPillPos] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });

	useWindowListener('resize', windowResize, [mobileMode]);

	useEffect(() => {
		windowResize();
	}, []);

	function windowResize() {
		// Ekran boyutuna göre mobil/desktop tespiti
		// Telefon (portrait kilitli): genişlik < 768 → mobil
		// Tablet (landscape kilitli): genişlik > 768 → desktop
		// Web: pencere boyutuna göre karar verilir
		// innerHeight <= 500: web browser'da landscape telefon tespiti
		const shouldBeMobile = window.innerWidth <= 768 || window.innerHeight <= 500;

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

	// Measure a given element for the pill position
	const measureElement = useCallback((el: HTMLElement) => {
		setPillPos({
			left: el.offsetLeft,
			top: el.offsetTop,
			width: el.offsetWidth,
			height: el.offsetHeight,
			ready: true,
		});
	}, []);

	// Measure active nav link for sliding pill
	const measureActive = useCallback(() => {
		if (!navRef.current) return;
		const activeEl = navRef.current.querySelector('[data-active]') as HTMLElement;
		if (activeEl) {
			measureElement(activeEl);
		} else {
			setPillPos((prev) => ({ ...prev, ready: false }));
		}
	}, [measureElement]);

	// Hover handlers
	const [hoveredLink, setHoveredLink] = useState<string | null>(null);

	const handleHoverStart = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
		const el = e.currentTarget;
		setHoveredLink(el.getAttribute('href') || '');
		measureElement(el);
	}, [measureElement]);

	const handleHoverEnd = useCallback(() => {
		setHoveredLink(null);
		measureActive();
	}, [measureActive]);

	useEffect(() => {
		measureActive();
		window.addEventListener('resize', measureActive);
		return () => window.removeEventListener('resize', measureActive);
	}, [pathname, measureActive]);

	if (focusMode) {
		return null;
	}

	let notifications = <Notifications />;
	if (!me) {
		notifications = null;
	}

	const navLinks = NAV_LINKS.filter((link) => !link.mobileOnly).map((link) => (
		<HeaderNavLink
			{...link}
			key={link.name}
			selected={link.match.test(pathname)}
			hovered={hoveredLink === link.link}
			onHoverStart={handleHoverStart}
			onHoverEnd={handleHoverEnd}
		/>
	));

	// Pro features are now available to everyone
	let getPro = null;

	// Mobile: No header nav needed, Timer has its own HeaderControl
	if (mobileMode) {
		return null;
	}

	const logoSrc = isLightTheme ? '/public/images/zkt-logo-dark.png' : '/public/images/zkt-logo.png';

	// Desktop header
	return (
		<div className={b()}>
			<div className={b('container')}>
				{/* Left side - Brand Link with Animated Cube */}
				<div className={b('left')}>
					<Link
						to="/"
						className="text-text hover:text-text font-bold tracking-tight select-none text-2xl flex items-center gap-2"
						style={{ textShadow: isLightTheme ? 'none' : '0 2px 4px rgba(0,0,0,0.5)' }}
					>
						<img
							src={logoSrc}
							alt="Zeka Küpü Türkiye"
							className={b('logo') + " w-20 h-20 object-contain"}
							style={{
								imageRendering: 'auto',
								filter: isLightTheme ? 'none' : 'brightness(1.1) contrast(1.05)',
								WebkitBackfaceVisibility: 'hidden',
								transform: 'translateZ(0)'
							}}
						/>
						Zkt Timer
					</Link>
				</div>

				{/* Center - Navigation Links */}
				<div className={b('center')}>
					<nav ref={navRef} className={b('nav')}>
						{/* Sliding pill indicator */}
						<motion.div
							className={b('pill')}
							initial={false}
							animate={{
								x: pillPos.left,
								y: pillPos.top,
								width: pillPos.width,
								height: pillPos.height,
								opacity: pillPos.ready ? 1 : 0,
							}}
							transition={{
								type: 'spring',
								stiffness: 500,
								damping: 35,
								opacity: { duration: 0.15 },
							}}
						/>
						{navLinks}
					</nav>
				</div>

				{/* Right side - Pro button, notifications, account */}
				<div className={b('right')}>
					{getPro}
					{me && <AnnouncementBell />}
					<AccountDropdown />
					<LanguageSwitcher />
					{me && <LoginNav collapsed={false} />}
				</div>
			</div>
		</div>
	);
}
