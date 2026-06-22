/**
 * landing_modes — Trainer landing'in 4 modunun paylasilan config'i (masaustu grid +
 * mobil Coverflow ayni veriyi kullanir). Metinler i18n key'leri; accent renkleri
 * TrainerModeHeader ile paylasilir. Icon, boyutu cagirana birakmak icin component olarak
 * tutulur (instantiate edilmemis).
 */
import {Timer, BluetoothConnected, Lightning, Eye, Target} from 'phosphor-react';
import type {Icon} from 'phosphor-react';
import type {TrainerMode} from './types';

export type ModeAccent = 'blue' | 'purple' | 'green' | 'orange' | 'red';

export interface ModeConfig {
	id: TrainerMode;
	Icon: Icon;
	accent: ModeAccent;
	pro?: boolean;
	titleKey: string;
	descKey: string;
	groups: {labelKey: string; itemKeys: string[]}[];
}

export const TRAINER_MODES: ModeConfig[] = [
	{
		id: 'standard',
		Icon: Timer,
		accent: 'blue',
		titleKey: 'trainer.landing_standard_title',
		descKey: 'trainer.landing_standard_desc',
		groups: [
			{
				labelKey: 'trainer.landing_standard_categories',
				itemKeys: ['trainer.landing_standard_3x3', 'trainer.landing_standard_roux', 'trainer.landing_standard_other'],
			},
			{
				labelKey: 'trainer.landing_standard_features',
				itemKeys: ['trainer.landing_standard_feat1', 'trainer.landing_standard_feat2', 'trainer.landing_standard_feat3'],
			},
		],
	},
	{
		id: 'smart',
		Icon: BluetoothConnected,
		accent: 'purple',
		pro: true,
		titleKey: 'trainer.landing_smart_title',
		descKey: 'trainer.landing_smart_desc',
		groups: [
			{
				labelKey: 'trainer.landing_smart_categories',
				itemKeys: ['trainer.landing_smart_3x3', 'trainer.landing_smart_roux'],
			},
			{
				labelKey: 'trainer.landing_smart_features',
				itemKeys: [
					'trainer.landing_smart_feat1',
					'trainer.landing_smart_feat2',
					'trainer.landing_smart_feat3',
					'trainer.landing_smart_feat4',
				],
			},
		],
	},
	{
		id: 'efficiency',
		Icon: Lightning,
		accent: 'green',
		titleKey: 'trainer.landing_efficiency_title',
		descKey: 'trainer.landing_efficiency_desc',
		groups: [
			{
				labelKey: 'trainer.landing_efficiency_features',
				itemKeys: [
					'trainer.landing_efficiency_feat1',
					'trainer.landing_efficiency_feat2',
					'trainer.landing_efficiency_feat3',
					'trainer.landing_efficiency_feat4',
				],
			},
		],
	},
	{
		id: 'recognition',
		Icon: Eye,
		accent: 'orange',
		titleKey: 'trainer.landing_recognition_title',
		descKey: 'trainer.landing_recognition_desc',
		groups: [
			{
				labelKey: 'trainer.landing_recognition_features',
				itemKeys: [
					'trainer.landing_recognition_feat1',
					'trainer.landing_recognition_feat2',
					'trainer.landing_recognition_feat3',
					'trainer.landing_recognition_feat4',
				],
			},
		],
	},
];

// Admin-only 5th mode. NOT in TRAINER_MODES so regular users never see it; TrainerLanding /
// Coverflow prepend it to the displayed list when `me.admin` (so it shows up FIRST).
export const OLLCP_MODE: ModeConfig = {
	id: 'ollcp',
	Icon: Target,
	accent: 'red',
	titleKey: 'trainer.landing_ollcp_title',
	descKey: 'trainer.landing_ollcp_desc',
	groups: [
		{
			labelKey: 'trainer.landing_ollcp_features',
			itemKeys: [
				'trainer.landing_ollcp_feat1',
				'trainer.landing_ollcp_feat2',
				'trainer.landing_ollcp_feat3',
				'trainer.landing_ollcp_feat4',
			],
		},
	],
};
