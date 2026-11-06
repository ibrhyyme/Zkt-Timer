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
	Gear,
} from 'phosphor-react';
import InboxPanel from './inbox/InboxPanel';
import Logo from '../../common/logo/Logo';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useWindowListener } from '../../../util/hooks/useListener';
import block from '../../../styles/bem';
import AccountDropdown from '../nav/account_dropdown/AccountDropdown';
import { useMe } from '../../../util/hooks/useMe';
import { NAV_LINKS, NavLinkProps, visibleNavLinks } from '../nav/nav_links';
import { useBattleLaunch } from '../../battle/useBattleLaunch';
import Button from '../../common/button/Button';
import LanguageSwitcher from '../../common/language_switcher/LanguageSwitcher';
import ThemeToggle from './ThemeToggle';
import StreamerModeToggle from './StreamerModeToggle';
import { resourceUri } from '../../../util/storage';
import { isPro } from '../../../util/pro';
import { isMobileViewport } from '../../../util/is-mobile-viewport';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';

const b = block('header-nav');

// Keep in step with `&__indicator` in HeaderNav.scss.
const INDICATOR_HEIGHT = 2;

// The app mounts anew on every route, and this nav with it, so a position kept in
// component state is gone by the time the new route renders and the line could only
// ever jump. Kept here it outlives the instance. Written from layout effects only,
// which never run on the server, so requests cannot share it and hydration still
// starts from nothing.
let lastIndicatorPlace: { left: number; top: number; width: number } | null = null;
let lastIndicatorPathname: string | null = null;

interface HeaderNavLinkProps extends NavLinkProps {
	selected?: boolean;
	// Icon only, no label. Set by HeaderNav when the labelled strip cannot fit.
	compact?: boolean;
}

function HeaderNavLink(props: HeaderNavLinkProps) {
	const { name, icon, newTag, loginRequired, selected, compact } = props;
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
		'transition-colors',
		'focus:outline-none',
		'focus-visible:ring-2',
		'focus-visible:ring-primary',
		'relative',
		'z-[1]',
	];

	if (selected) {
		// Bold and full colour carry the state on their own: on Save the Bees and Norman
		// the accent line alone has too little contrast against the page.
		linkClasses.push('text-text', 'font-bold');
	} else {
		linkClasses.push(
			'text-text/[0.72]',
			// Hover only where a real hover exists: on a touch screen `:hover` latches
			// onto the last tapped tab and stays there until the next tap elsewhere.
			'[@media(hover:hover)]:hover:text-text',
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
		>
			<span className="text-lg">{icon}</span>
			<span className={b('label')} data-label={label}>{label}</span>
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
	// The Sıralama tab appears only once Online Battle is public (nav_links launchOnly).
	const rankingsLaunched = useBattleLaunch()?.launched === true;

	const mobileMode = useGeneral('mobile_mode');
	// Active tab indicator state
	const navRef = useRef<HTMLElement>(null);
	// `animate`: whether this move slides. Only the user moving between tabs slides; a
	// re-measure because the strip's layout changed jumps.
	const [indicatorPos, setIndicatorPos] = useState(() => ({
		left: lastIndicatorPlace?.left ?? 0,
		top: lastIndicatorPlace?.top ?? 0,
		width: lastIndicatorPlace?.width ?? 0,
		ready: lastIndicatorPlace !== null,
		animate: false,
	}));

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

	// Put the line under the active tab. Hover never moves it: when it followed the
	// mouse, the page you were on lost its mark.
	//
	// Measured in a layout effect that re-runs whenever the strip's layout can
	// change (route, compact switch, language, sign-in). It used to be measured once
	// in a passive effect on mount. That effect is flushed before the compact
	// re-render that measureFit's layout effect schedules, so on any screen narrow
	// enough for the icon-only strip (every tablet) it took the width of the LABELLED
	// tab and then sat across Timer and Battle.
	//
	// On a hard load the first measure ran on the fallback font. When the web font
	// arrived the tabs changed width, the observer re-measured, and the indicator slid
	// across the strip from where the fallback had put it, so every full load showed
	// it under the wrong tab for a moment. Now it stays hidden until the fonts are in,
	// and a re-measure caused by layout jumps instead of sliding.
	const measureIndicator = useCallback((animate = false) => {
		const nav = navRef.current;
		if (!nav) return;
		const fonts = typeof document !== 'undefined' ? (document as any).fonts : null;
		if (fonts && fonts.status !== 'loaded') {
			fonts.ready.then(() => measureIndicator(false));
			return;
		}
		const target = nav.querySelector('[data-active]') as HTMLElement | null;
		if (!target) {
			// A page with no tab (settings, profile): the next tab fades in where it is
			// instead of sliding from whichever tab came before.
			lastIndicatorPlace = null;
			setIndicatorPos((prev) => (prev.ready ? { ...prev, ready: false } : prev));
			return;
		}
		const place = {
			left: target.offsetLeft,
			// Inside the tab's own box: the strip is a scroll container and would clip
			// anything hanging below it.
			top: target.offsetTop + target.offsetHeight - INDICATOR_HEIGHT,
			width: target.offsetWidth,
		};
		lastIndicatorPlace = place;
		setIndicatorPos((prev) => {
			const next = {
				...place,
				ready: true,
				// The first placement never slides in from the corner.
				animate: animate && prev.ready,
			};
			return prev.ready &&
				prev.left === next.left &&
				prev.top === next.top &&
				prev.width === next.width
				? prev
				: next;
		});
	}, []);

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
	}, [measureFit, compact, mobileMode, !!me, i18n.language, rankingsLaunched]);

	// After measureFit on purpose: layout effects run in declaration order, so the
	// indicator is measured against the strip in its settled compact state.
	// Slides only when the user moved to a new route. The other deps re-measure for a
	// layout change and jump.
	useIsomorphicLayoutEffect(() => {
		const moved = lastIndicatorPathname !== null && lastIndicatorPathname !== pathname;
		lastIndicatorPathname = pathname;
		measureIndicator(moved);
	}, [measureIndicator, pathname, compact, mobileMode, !!me, i18n.language, rankingsLaunched]);

	// Anything else that moves the tabs (window resize, the 14/15px rem switch, a
	// late web font) changes the strip's size, so watch the strip itself.
	useEffect(() => {
		const remeasure = () => measureIndicator(false);
		window.addEventListener('resize', remeasure);
		let observer: ResizeObserver | null = null;
		if (typeof ResizeObserver !== 'undefined' && navRef.current) {
			observer = new ResizeObserver(remeasure);
			observer.observe(navRef.current);
		}
		return () => {
			window.removeEventListener('resize', remeasure);
			if (observer) observer.disconnect();
		};
	}, [measureIndicator, mobileMode]);

	let notifications = <InboxPanel />;
	if (!me) {
		notifications = null;
	}

	const navLinks = visibleNavLinks(NAV_LINKS, rankingsLaunched).filter((link) => !link.mobileOnly).map((link) => (
		<HeaderNavLink
			{...link}
			key={link.name}
			selected={link.match.test(pathname)}
			compact={compact}
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

	// The settings link normally lives in the account dropdown, which renders nothing
	// while signed out. The timer works signed out and so do its settings, so a signed
	// out visitor still needs a way in.
	const settingsLink = me ? null : (
		<Link to="/settings" className={b('settings-link')} aria-label={t('settings.page_title')}>
			<Gear weight="bold" />
		</Link>
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
						ZKT Timer
					</Link>
				</div>

				{/* Center - Navigation Links */}
				<div ref={centerRef} className={b('center')}>
					<nav ref={navRef} className={b('nav')} data-compact={compact ? 'true' : 'false'}>
						{/* Sliding line under the active tab */}
						<motion.div
							className={b('indicator')}
							initial={false}
							animate={{
								x: indicatorPos.left,
								y: indicatorPos.top,
								width: indicatorPos.width,
								opacity: indicatorPos.ready ? 1 : 0,
							}}
							transition={
								indicatorPos.animate
									? {
										type: 'spring',
										stiffness: 500,
										damping: 35,
										opacity: { duration: 0.15 },
									}
									: { duration: 0, opacity: { duration: 0.15 } }
							}
						/>
						{navLinks}
					</nav>
				</div>

				{/* Right side - Pro button, notifications, account */}
				<div ref={rightRef} className={b('right')}>
					{getPro}
					{notifications}
					<AccountDropdown />
					{settingsLink}
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
