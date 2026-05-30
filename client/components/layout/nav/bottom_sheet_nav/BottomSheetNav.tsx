// Sag-kenar navigation drawer — EdgeDrawer primitive'inin sag wrapper'i.
// Gesture/portal/state logic'i tamamen EdgeDrawer'da; burada sadece NAV_LINKS
// + profile butonu render edilir.

import React from 'react';
import {useRouteMatch, useHistory} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import {UserCircle} from 'phosphor-react';
import EdgeDrawer from '../edge_drawer/EdgeDrawer';
import {NAV_LINKS} from '../Nav';
import {useMe} from '../../../../util/hooks/useMe';
import block from '../../../../styles/bem';

const b = block('edge-drawer');

export default function BottomSheetNav() {
	const match = useRouteMatch();
	const history = useHistory();
	const {t} = useTranslation();
	const me = useMe();

	return (
		<EdgeDrawer
			side="right"
			storageKeyY="zkt_notch_y"
			storageKeyUsed="zkt_notch_used"
			notchHintText={t('nav.notch_swipe')}
			notchHintSubText={t('nav.notch_hold')}
			gridHeightPx={310}
		>
			{NAV_LINKS.map((link) => {
				const isActive = link.match.test(match.path);
				return (
					<button
						key={link.link}
						className={b('item', {active: isActive})}
						onClick={() => !isActive && history.push(link.link)}
					>
						<div className={b('item-icon')}>
							{React.cloneElement(link.icon, {size: 24})}
						</div>
						<span className={b('item-label')}>{t(link.name)}</span>
					</button>
				);
			})}
			{me && (
				<button
					className={b('item', {active: /^\/user\//.test(match.path)})}
					onClick={() => history.push(`/user/${me.username}`)}
				>
					<div className={b('item-icon')}>
						<UserCircle size={24} weight="bold" />
					</div>
					<span className={b('item-label')}>{t('account_dropdown.profile')}</span>
				</button>
			)}
		</EdgeDrawer>
	);
}
