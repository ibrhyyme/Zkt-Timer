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
import InboxPanel from './inbox/InboxPanel';
import Logo from '../../common/logo/Logo';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useWindowListener } from '../../../util/hooks/useListener';
import block from '../../../styles/bem';
import AccountDropdown from '../nav/account_dropdown/AccountDropdown';
import { useMe } from '../../../util/hooks/useMe';
import { NAV_LINKS, NavLinkProps } from '../nav/nav_links';
import Button from '../../common/button/Button';
import LanguageSwitcher from '../../common/language_switcher/LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import StreamerModeToggle from './StreamerModeToggle';
import { resourceUri } from '../../../util/storage';
import { isPro } from '../../../util/pro';
import { isMobileViewport } from '../../../util/is-mobile-viewport';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';

const b = block('header-nav');

interface HeaderNavLinkProps extends NavLinkProps {
	selected?: boolean;
	hovered?: boolean;
	// Icon only, no label. Set by HeaderNav when the labelled strip cannot fit.
	compact?: boolean;
	onHoverStart?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
	onHoverEnd?: () => void;
}

function HeaderNavLink(props: HeaderNavLinkProps) {
	const { name, icon, newTag, loginRequired, selected, hovered, compact, onHoverStart, onHoverEnd } = props;
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

	const label = t(name);

	return (
		<Link
			to={link}
			className={linkClasses.join(' ')}
			data-active={selected || undefined}
			// The label element is always rendered and hidden in CSS instead (see
			// HeaderNav.scss), which is what lets the strip be measured at its
			// labelled width without a second React pass. `display: none` does take
			// it away from screen readers, so name the link itself while compact.
			title={compact ? label : undefined}
			aria-label={compact ? label : undefined}
			onMouseEnter={onHoverStart}
			onMouseLeave={onHoverEnd}
		>
			<span className="text-lg">{icon}</span>
			<span>{label}</span>
		</Link>
	);
}

interface Props {
	// The theme switch writes through the settings database. Pages that render this
	// nav outside the App shell (help) have no settings database loaded, so the
	// button would look live and do nothing — those pass this instead.
	hideThemeToggle?: boolean;
}

export default function HeaderNav(props: Props = {}) {
	const {hideThemeToggle} = props;
	const { t, i18n } = useTranslation();
	const dispatch = useDispatch();
	const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

	const match = useRouteMatch();
	const me = useMe();

	const mobileMode = useGeneral('mobile_mode');
	// Pill nav state
	const navRef = useRef<HTMLElement>(null);
	const [pillPos, setPillPos] = useState({ left: 0, top: 0, width: 0, height: 0, ready: false });

	// Label/icon switch. See measureFit below for why this is measured rather than
	// hung off a breakpoint.
	const centerRef = useRef<HTMLDivElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const leftRef = useRef<HTMLDivElement>(null);
	const rightRef = useRef<HTMLDivElement>(null);
	const [compact, setCompact] = useState(false);

	useWindowListener('resize', windowResize, [mobileMode]);

	useEffect(() => {
		windowResize();
	}, []);

	function windowResize() {
		const shouldBeMobile = isMobileViewport();

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

	// Decide whether the labelled strip still fits.
	//
	// This was a media query once, at 1460px. That number was measured against
	// Turkish, and Spanish labels run ~20% longer, so the last tab fell into the
	// overflow again well above the breakpoint. Signing in moves the line too, by
	// swapping the auth buttons for the avatar, inbox and streamer toggle.
	//
	// The labelled width is re-measured on every pass rather than cached, because it
	// is not a constant: `rem` is 14px below 1500px and 15px above it (reset.scss),
	// and the strip's gap is `vw`-based, so the same labels occupy different widths
	// at different sizes. A width captured at one size and reused at another read a
	// few px small and let the strip overflow right at the switch.
	//
	// Reading it means un-hiding the labels, which is why they are hidden in CSS via
	// data-compact: the attribute goes off, scrollWidth is read, and it goes back on,
	// all synchronously inside one layout effect, so nothing is ever painted in the
	// wrong state.
	//
	// The comparison is against the CENTRE's width, never the nav's own. The nav
	// shrinks when it goes compact, so measuring that would report "fits now", flip
	// back, overflow, and oscillate. The centre is `flex: 1 1 auto` between two
	// `flex-shrink: 0` blocks, so its width does not depend on what the nav is
	// currently rendering.
	const measureFit = useCallback(() => {
		const nav = navRef.current;
		const center = centerRef.current;
		if (!nav || !center) return;

		const wasCompact = nav.getAttribute('data-compact');
		if (wasCompact === 'true') nav.setAttribute('data-compact', 'false');
		const labelledWidth = nav.scrollWidth;
		if (wasCompact === 'true') nav.setAttribute('data-compact', 'true');

		// Both figures are integers rounded from subpixel layout, so a strip that is
		// really 1007.6 wide inside a 1007.4 slot reads as 1008 vs 1007 or the other
		// way about. Keeping a couple of pixels in hand costs nothing and stops the
		// switch landing on a tie.
		setCompact(center.clientWidth < labelledWidth + 2);

		// Cap the row at what it actually needs, so a wide screen does not push the
		// three blocks into three separate corners. Without this the 32" monitor left
		// 325px of dead space on each side of the tabs while the 17.3" one fit exactly.
		//
		// Derived from the labelled width even while compact, so the container does
		// not jump when the mode flips. The breathing room is in `rem`, which makes it
		// track both browser zoom and the 14/15px root switch, and it is what keeps
		// this from feeding back into the decision above: the centre ends up
		// `labelledWidth + breathing` wide, never close to the `+ 2` tie-break.
		const container = containerRef.current;
		const left = leftRef.current;
		const right = rightRef.current;
		if (container && left && right) {
			const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 15;
			const centerStyle = getComputedStyle(center);
			const containerStyle = getComputedStyle(container);
			const needed =
				left.offsetWidth +
				right.offsetWidth +
				labelledWidth +
				parseFloat(centerStyle.marginLeft) +
				parseFloat(centerStyle.marginRight) +
				parseFloat(containerStyle.paddingLeft) +
				parseFloat(containerStyle.paddingRight) +
				rem * 5;

			container.style.setProperty('--zt-header-max-w', `${Math.ceil(needed)}px`);
		}
	}, []);

	// Pre-paint so a wide screen never flashes the compact strip on hydration.
	//
	// Measured twice per resize on purpose. A resize event can be handled before the
	// layout around it has settled: `rem` is 14px below 1500px and 15px above it
	// (reset.scss), and crossing that line rescales every padding and gap in the row.
	// The first read can therefore describe the old scale, decide the labels fit, and
	// never be revisited, because a decision that does not change the mode does not
	// re-run this effect. The ResizeObserver is the reliable half: it fires after
	// layout, including for the reflow the rem switch causes without a second resize
	// event. It cannot feed itself, because going compact resizes the nav, not the
	// centre being observed.
	useIsomorphicLayoutEffect(() => {
		measureFit();

		const remeasure = () => {
			measureFit();
			requestAnimationFrame(measureFit);
		};
		window.addEventListener('resize', remeasure);

		let observer: ResizeObserver | null = null;
		if (typeof ResizeObserver !== 'undefined' && centerRef.current) {
			observer = new ResizeObserver(() => measureFit());
			observer.observe(centerRef.current);
		}

		return () => {
			window.removeEventListener('resize', remeasure);
			if (observer) observer.disconnect();
		};
	}, [measureFit, compact, mobileMode, !!me, i18n.language]);

	let notifications = <InboxPanel />;
	if (!me) {
		notifications = null;
	}

	const navLinks = NAV_LINKS.filter((link) => !link.mobileOnly).map((link) => (
		<HeaderNavLink
			{...link}
			key={link.name}
			selected={link.match.test(pathname)}
			hovered={hoveredLink === link.link}
			compact={compact}
			onHoverStart={handleHoverStart}
			onHoverEnd={handleHoverEnd}
		/>
	));

	// Pro features are now available to everyone
	let getPro = null;

	// Someone arriving signed out — from a shared link, or a search result — used to
	// find no way into an account from here at all: the old line rendered LoginNav only
	// when `me` was set, and LoginNav returns null in exactly that case, so the pair of
	// buttons never drew under any condition. Written inline rather than reusing
	// LoginNav because that component is laid out for the vertical sidebar.
	const authButtons = me ? null : (
		<div className={b('auth')}>
			<Button text={t('nav.login')} to="/login" gray />
			<Button text={t('nav.signup')} to="/signup" primary />
		</div>
	);

	// Mobile: No header nav needed, Timer has its own HeaderControl
	if (mobileMode) {
		return null;
	}

	// Desktop header.
	//
	// Two elements on purpose. The outer one stays in flow and does nothing but hold
	// open the header's height; the bar itself is fixed. It used to be one `sticky`
	// element, but Radix measures a dropdown's trigger at its position in FLOW and
	// never sees the sticky offset, so every menu in here (language, account,
	// notifications) opened a full scroll-height above the viewport once the page was
	// scrolled — invisible, and on the first open after a load the browser dragged the
	// whole document to the top to reveal it. A fixed bar has no such offset to miss.
	return (
		<div className={b()}>
			<div className={b('bar')}>
			<div ref={containerRef} className={b('container')}>
				{/* Left side - Brand Link with Animated Cube */}
				<div ref={leftRef} className={b('left')}>
					<Link
						to="/"
						className="text-text hover:text-text font-bold tracking-tight select-none text-2xl flex items-center gap-2"
					>
						{/* The Logo component, not a hand-copied pair of <img> tags. The copy
						    relied on Logo.scss reaching the bundle through some other importer;
						    when the unused Nav sidebar was deleted that stopped happening and both
						    the light and dark images rendered, stacked. */}
						<span className={b('logo')} aria-label="Zeka Küpü Türkiye">
							<Logo />
						</span>
						Zkt Timer
					</Link>
				</div>

				{/* Center - Navigation Links */}
				<div ref={centerRef} className={b('center')}>
					<nav ref={navRef} className={b('nav')} data-compact={compact ? 'true' : 'false'}>
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
				<div ref={rightRef} className={b('right')}>
					{getPro}
					{notifications}
					<AccountDropdown />
					<LanguageSwitcher />
					{hideThemeToggle ? null : <ThemeToggle />}
					<StreamerModeToggle />
					{authButtons}
				</div>
			</div>
			</div>
		</div>
	);
}
