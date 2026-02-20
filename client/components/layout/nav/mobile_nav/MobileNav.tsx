import React from 'react';
import './MobileNav.scss';
import { List } from 'phosphor-react';
import { useRouteMatch } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_LINKS } from '../Nav';
import Dropdown from '../../../common/inputs/dropdown/Dropdown';

export default function MobileNav() {
	// Global hamburger menu - tüm sayfalarda görünür
	const match = useRouteMatch();
	const { t } = useTranslation();

	const navOptions = NAV_LINKS.map((link) => ({
		link: link.link,
		text: t(link.name),
		icon: link.icon,
		disabled: link.match.test(match.path),
	}));

	return (
		<div className="cd-nav-mobile-hamburger">
			<Dropdown
				icon={<List size={24} weight="regular" />}
				options={navOptions}
			/>
		</div>
	);
}
