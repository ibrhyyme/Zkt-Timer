// Sol-kenar settings drawer — EdgeDrawer primitive'inin sol wrapper'i.
// Icerik: 3 tab (Timer Turu / Hizli Ayarlar / Hedefler) DrawerSettingsContent'te.

import React from 'react';
import {useTranslation} from 'react-i18next';
import EdgeDrawer from '../edge_drawer/EdgeDrawer';
import DrawerSettingsContent from './DrawerSettingsContent';

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
			<DrawerSettingsContent />
		</EdgeDrawer>
	);
}
