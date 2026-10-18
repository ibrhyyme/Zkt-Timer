/**
 * landing_modes: shared config of the trainer's card pages (desktop grid and mobile card stack
 * use the same lists). Texts are i18n keys; accent colours come from common/TrainerAccents.scss
 * and match TrainerModeHeader. The icon stays a component (not instantiated) so the caller picks
 * its size.
 *
 * Hub (`/trainer`): two cards, Trainers and Algorithm Sets (HUB_CARDS).
 * Trainers page (`/trainer/modes`): three cards for everyone (trainer-sets 2.1), Algorithm
 * Trainer, PLL Recognition, Cross and XCross. The admin-only OLLCP card is prepended by the
 * caller. A card is an entry, not a study mode: the Algorithm Trainer card opens Standard or
 * Smart Cube from the remembered `lastMode`.
 */
import {Timer, Lightning, Eye, Target, Barbell, Stack} from 'phosphor-react';
import type {Icon} from 'phosphor-react';

export type ModeAccent = 'blue' | 'purple' | 'green' | 'orange' | 'red';

/** What a hub card opens. */
export type HubEntryId = 'trainers' | 'sets';

export interface HubCardConfig {
	id: HubEntryId;
	Icon: Icon;
	accent: ModeAccent;
	titleKey: string;
	descKey: string;
	/** Feature lines (Algorithm Sets); the Trainers card lists the trainers themselves instead. */
	itemKeys: string[];
}

export const HUB_CARDS: HubCardConfig[] = [
	{
		id: 'trainers',
		Icon: Barbell,
		accent: 'blue',
		titleKey: 'trainer.hub.trainers_title',
		descKey: 'trainer.hub.trainers_desc',
		itemKeys: [],
	},
	{
		id: 'sets',
		Icon: Stack,
		accent: 'purple',
		titleKey: 'trainer.hub.sets_title',
		descKey: 'trainer.hub.sets_desc',
		itemKeys: ['trainer.hub.sets_feat1', 'trainer.hub.sets_feat2', 'trainer.hub.sets_feat3'],
	},
];

/** What a hub card opens. `algorithms` is the Algorithm Trainer (Standard and Smart Cube study modes). */
export type TrainerEntryId = 'algorithms' | 'recognition' | 'efficiency' | 'ollcp';

export interface ModeFeatureGroup {
	labelKey: string;
	itemKeys: string[];
	/** Items that get a "Pro" badge next to them (only shown when Pro gating is on in this build). */
	proItemKeys?: string[];
}

export interface ModeConfig {
	id: TrainerEntryId;
	Icon: Icon;
	accent: ModeAccent;
	/** Admin-only card: its top row says "Admin". */
	admin?: boolean;
	titleKey: string;
	descKey: string;
	groups: ModeFeatureGroup[];
}

export const TRAINER_MODES: ModeConfig[] = [
	{
		id: 'algorithms',
		Icon: Timer,
		accent: 'blue',
		titleKey: 'trainer.landing_algorithms_title',
		descKey: 'trainer.landing_algorithms_desc',
		groups: [
			{
				labelKey: 'trainer.landing_algorithms_features',
				itemKeys: [
					'trainer.landing_algorithms_feat1',
					'trainer.landing_algorithms_feat2',
					'trainer.landing_algorithms_feat3',
					'trainer.landing_algorithms_feat4',
				],
				proItemKeys: ['trainer.landing_algorithms_feat4'],
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
];

// Admin-only card. NOT in TRAINER_MODES so regular users never see it; TrainerLanding prepends
// it when `me.admin`.
export const OLLCP_MODE: ModeConfig = {
	id: 'ollcp',
	Icon: Target,
	accent: 'red',
	admin: true,
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
