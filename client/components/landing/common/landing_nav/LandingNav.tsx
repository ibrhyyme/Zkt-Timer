import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './LandingNav.scss';
import block from '../../../../styles/bem';
import {useWindowListener} from '../../../../util/hooks/useListener';
import {ColorName} from '../../../../../shared/colors';
import LanguageSwitcher from '../../../common/language_switcher/LanguageSwitcher';
import {useMe} from '../../../../util/hooks/useMe';

const b = block('landing-nav');

const MAX_NAV_WIDTH = 1200;

interface Props {
	showBorder?: boolean;
}

interface NavLinkProps {
	label: string;
	link: string;
	color?: ColorName;
	dropDownOnly?: boolean;
	permanent?: boolean;
}

export default function LandingNav(props: Props) {
	const {showBorder} = props;
	const {t} = useTranslation();
	const me = useMe();

	// Signed-in readers reach these pages too (help, credits, terms) and used to be
	// shown "Log in / Sign up", which reads as having been signed out. They get a way
	// back into the app instead.
	const NAV_REST_LINKS: NavLinkProps[] = me
		? [
				{
					label: t('landing_nav.open_app'),
					link: '/timer',
					color: 'primary',
					permanent: true,
				},
		  ]
		: [
				{
					label: t('landing_nav.login'),
					link: '/login',
					permanent: true,
				},
				{
					label: t('landing_nav.signup'),
					link: '/signup',
					color: 'primary',
					permanent: true,
				},
		  ];

	const [navSmall, setNavSmall] = useState(false);
	const [scrolled, setScrolled] = useState(showBorder);

	useWindowListener('scroll', windowScroll);
	useWindowListener('resize', windowResize);

	useEffect(() => {
		windowScroll();
		windowResize();
	}, []);

	function windowResize() {
		if (window.innerWidth <= MAX_NAV_WIDTH && !navSmall) {
			setNavSmall(true);
		} else if (window.innerWidth > MAX_NAV_WIDTH && navSmall) {
			setNavSmall(false);
		}
	}

	function windowScroll() {
		if (showBorder || typeof window === 'undefined') {
			return;
		}

		if (window.scrollY > 0 && !scrolled) {
			setScrolled(true);
		} else if (window.scrollY === 0 && scrolled) {
			setScrolled(false);
		}
	}

	const showNavLinks = [];

	for (const nav of NAV_REST_LINKS) {
		const {label, link, color} = nav;
		const linkClasses = ['text-base', 'font-label', 'font-bold', 'border-solid', 'border-b-2'];

		if (color) {
			linkClasses.push(`text-${color}-500`);
		}

		showNavLinks.push(
			<a
				key={link}
				href={link}
				className={linkClasses.join(' ')}
			>
				{label}
			</a>
		);
	}

	return (
		<div className={b({scrolled})}>
			<div className={b('body')}>
				<div className={b('links')}>
					{/* Sits at the left of the bar, so the panel has to grow rightward. */}
					<LanguageSwitcher align="start" />
					{showNavLinks}
				</div>
			</div>
		</div>
	);
}
