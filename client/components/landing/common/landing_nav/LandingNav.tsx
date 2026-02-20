import React, {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import './LandingNav.scss';
import block from '../../../../styles/bem';
import {useWindowListener} from '../../../../util/hooks/useListener';
import {ColorName} from '../../../../../shared/colors';

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

	const NAV_REST_LINKS: NavLinkProps[] = [
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
			<a key={link} href={link} className={linkClasses.join(' ')}>
				{label}
			</a>
		);
	}

	return (
		<div className={b({scrolled})}>
			<div className={b('body')}>
				<div className={b('links')}>
					{showNavLinks}
				</div>
			</div>
		</div>
	);
}
