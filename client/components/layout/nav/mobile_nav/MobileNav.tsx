import React from 'react';
import './MobileNav.scss';
import { List, House } from 'phosphor-react';
import { useRouteMatch, useHistory } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { NAV_LINKS } from '../Nav';
import Dropdown from '../../../common/inputs/dropdown/Dropdown';

export default function MobileNav() {
	// Global hamburger menu - tüm sayfalarda görünür
	const match = useRouteMatch();
	const history = useHistory();
	const { t } = useTranslation();

	const isTimerPage = /(^\/$|^$|^\/timer)/.test(match.path);

	const navOptions = NAV_LINKS.map((link) => ({
		link: link.link,
		text: t(link.name),
		icon: link.icon,
		disabled: link.match.test(match.path),
	}));

	return (
		<>
			{!isTimerPage && (
				<div className="cd-nav-mobile-home" onClick={() => history.push('/timer')}>
					<House size={24} weight="bold" />
				</div>
			)}
			<div className="cd-nav-mobile-hamburger">
				<Dropdown
					icon={<List size={24} weight="regular" />}
					options={navOptions}
				/>
			</div>
		</>
	);
}
