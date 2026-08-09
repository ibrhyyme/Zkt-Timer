// Sag-kenar navigation drawer — EdgeDrawer primitive'inin sag wrapper'i.
// Gesture/portal/state logic'i tamamen EdgeDrawer'da; burada sadece NAV_LINKS
// render edilir.
//
// Profil burada DEGIL: sag ustteki avatar zaten profilin kendisi, cekmecede ikinci
// kez durmasi hem fazlaliktı hem de grid'i 11 ogeye cikarip sabit gridHeightPx=310
// yuksekligini asiyordu (son satirda tek oge kalip panel uzuyordu).

import React from 'react';
import {useRouteMatch, useHistory} from 'react-router-dom';
import {useTranslation} from 'react-i18next';
import EdgeDrawer from '../edge_drawer/EdgeDrawer';
import {NAV_LINKS} from '../Nav';
import {useInbox} from '../../../../util/hooks/useInbox';
import block from '../../../../styles/bem';

const b = block('edge-drawer');

// Mobilde mesajlarin tek giris noktasi bu cekmece, dolayisiyla okunmamis sayisi da
// burada gosterilir. Centikteki nokta "bir sey var" der, buradaki sayi "kac tane".
const MESSAGES_LINK = '/messages';

export default function BottomSheetNav() {
	const match = useRouteMatch();
	const history = useHistory();
	const {t} = useTranslation();
	const inbox = useInbox();

	// Istekler de sayilir: kimse push almadigi icin rozet onlarin tek isareti.
	const unread = inbox.unread_total + inbox.request_count;

	return (
		<EdgeDrawer
			side="right"
			storageKeyY="zkt_notch_y"
			storageKeyUsed="zkt_notch_used"
			notchHintText={t('nav.notch_swipe')}
			notchHintSubText={t('nav.notch_hold')}
			gridHeightPx={310}
			notchBadge={unread > 0}
		>
			{NAV_LINKS.map((link) => {
				const isActive = link.match.test(match.path);
				const showCount = link.link === MESSAGES_LINK && unread > 0;
				return (
					<button
						key={link.link}
						className={b('item', {active: isActive})}
						onClick={() => !isActive && history.push(link.link)}
					>
						<div className={b('item-icon')}>
							{React.cloneElement(link.icon, {size: 24})}
							{showCount && <span className={b('item-badge')}>{unread > 99 ? '99+' : unread}</span>}
						</div>
						<span className={b('item-label')}>{t(link.name)}</span>
					</button>
				);
			})}
		</EdgeDrawer>
	);
}
