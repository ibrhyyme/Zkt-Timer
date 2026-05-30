// Sol-kenar settings drawer — EdgeDrawer primitive'inin sol wrapper'i.
// Icerik: 8 kareli grid (7 timer turu + 1 Hizli Ayarlar Popover trigger).
// Sag drawer'in nav grid'i ile birebir simetrik gorsel.

import React from 'react';
import {useTranslation} from 'react-i18next';
import EdgeDrawer from '../edge_drawer/EdgeDrawer';
import TimerTypeGrid from './TimerTypeGrid';

export default function LeftSettingsDrawer() {
	const {t} = useTranslation();

	return (
		<EdgeDrawer
			side="left"
			storageKeyY="zkt_notch_left_y"
			storageKeyUsed="zkt_notch_left_used"
			notchHintText={t('nav.notch_settings_swipe')}
			notchHintSubText={t('nav.notch_hold')}
		>
			<TimerTypeGrid />
		</EdgeDrawer>
	);
}
