// Sol-kenar settings drawer — EdgeDrawer primitive'inin sol wrapper'i.
// Icerik: 8 kareli grid (7 timer turu + 1 Hizli Ayarlar drawer-ici extras gecisi).
// Sag drawer'in nav grid'i ile birebir simetrik gorsel.
//
// Oda modu icin opsiyonel 4 prop forward edilir (FriendlyRoom mobile cagrisi):
//   allowedTimerTypes / requireProForSmart / hideSmartCubeFeatures / hideMobileModules
// Timer sayfasi (HeaderControl) prop'suz cagirir — varsayilan: tum turler acik,
// Pro gerekli degil, ExtrasTab tum satirlari (mobile module slot dahil) gosterir.

import React from 'react';
import {useTranslation} from 'react-i18next';
import EdgeDrawer from '../edge_drawer/EdgeDrawer';
import TimerTypeGrid from './TimerTypeGrid';

interface Props {
	allowedTimerTypes?: string[];
	requireProForSmart?: boolean;
	hideSmartCubeFeatures?: boolean;
	hideMobileModules?: boolean;
}

export default function LeftSettingsDrawer(props: Props) {
	const {t} = useTranslation();

	return (
		<EdgeDrawer
			side="left"
			storageKeyY="zkt_notch_left_y"
			storageKeyUsed="zkt_notch_left_used"
			notchHintText={t('nav.notch_settings_swipe')}
			notchHintSubText={t('nav.notch_hold')}
		>
			<TimerTypeGrid {...props} />
		</EdgeDrawer>
	);
}
