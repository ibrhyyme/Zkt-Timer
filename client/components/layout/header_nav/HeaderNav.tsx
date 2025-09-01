import React, {useEffect, useState} from 'react';
import {useDispatch} from 'react-redux';
import {Link, useRouteMatch} from 'react-router-dom';
import './HeaderNav.scss';
import {setGeneral} from '../../../actions/general';
import {
	ArrowRight,
	List,
	X,
	Cube,
} from 'phosphor-react';
import Notifications from '../nav/notifications/Notifications';
import Logo from '../../common/logo/Logo';
import {useGeneral} from '../../../util/hooks/useGeneral';
import {useWindowListener} from '../../../util/hooks/useListener';
import {useSettings} from '../../../util/hooks/useSettings';
import {useTheme} from '../../../util/hooks/useTheme';
import block from '../../../styles/bem';
import AccountDropdown from '../nav/account_dropdown/AccountDropdown';
import {useMe} from '../../../util/hooks/useMe';
import {NAV_LINKS, NavLinkProps} from '../nav/Nav';
import Button from '../../common/button/Button';
import LoginNav from '../nav/LoginNav';
import {resourceUri} from '../../../util/storage';
import {isPro} from '../../../util/pro';

const b = block('header-nav');

interface HeaderNavLinkProps extends NavLinkProps {
	selected?: boolean;
}

function HeaderNavLink(props: HeaderNavLinkProps) {
	const {name, icon, newTag, loginRequired, selected} = props;
	let link = props.link;
	const me = useMe();

	if (link === '/' && !me) {
		link = '/demo';
	}

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
		if (window.innerWidth <= 768 && !mobileMode) {
			dispatch(setGeneral('mobile_mode', true));
		} else if (window.innerWidth > 768 && mobileMode) {
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

	// Mobile menu
	if (mobileMode) {
		return (
			<div className={b('mobile')}>
				<div className={b('mobile-body')}>
					<div className={b('mobile-left')}>
						<Button
							icon={mobileMenuOpen ? <X /> : <List />}
							transparent
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						/>
					</div>
					<div className={b('mobile-center')}>
						<Link to="/">
							<Logo large={false} dark={false} />
						</Link>
					</div>
					<div className={b('mobile-right')}>
						{notifications}
						<AccountDropdown />
						{me && (
							<button
								type="button"
								aria-label="Ayarlar"
								className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border transition transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 hover:-translate-y-[1px] active:translate-y-0 text-white/90 hover:text-white bg-white/5 hover:bg-white/10 border-white/10"
								onClick={() => dispatch(setGeneral('settings_modal_open', true))}
							>
								<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
									<path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
								</svg>
								<span>Ayarlar</span>
							</button>
						)}
					</div>
				</div>
				
				{/* Mobile dropdown menu */}
				{mobileMenuOpen && (
					<div className={b('mobile-menu')}>
						<div className={b('mobile-menu-content')}>
							{navLinks}
							{getPro}
							<LoginNav collapsed={false} />
						</div>
					</div>
				)}
			</div>
		);
	}

	// Desktop header
	return (
		<div className={b()}>
			<div className={b('container')}>
				{/* Left side - Brand Link with Animated Cube */}
				<div className={b('left')}>
					<Link to="/" className="text-white/90 hover:text-white font-bold tracking-tight select-none text-2xl flex items-center gap-2">
						<Cube 
							size={28} 
							className={b('cube-logo')}
							style={{
								animation: 'cubeFloat 4s ease-in-out infinite, cubeRotate 8s linear infinite'
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
					{notifications}
					<AccountDropdown />
					{me && (
						<button
							type="button"
							aria-label="Ayarlar"
							className="inline-flex items-center gap-2 h-9 px-3 rounded-lg border transition transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/70 hover:-translate-y-[1px] active:translate-y-0 text-white/90 hover:text-white bg-white/5 hover:bg-white/10 border-white/10"
							onClick={() => dispatch(setGeneral('settings_modal_open', true))}
						>
							<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
								<path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
							</svg>
							<span>Ayarlar</span>
						</button>
					)}
					<LoginNav collapsed={false} />
				</div>
			</div>
		</div>
	);
}
