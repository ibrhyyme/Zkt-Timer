/**
 * TrainerLanding — "Solid Editorial" yon (Claude Design B handoff).
 * Sol-hizali header + alt cizgi, numaralandirilmis eyebrow (MOD 01 / PRO · MOD 02),
 * accent ikon, faint cube watermark. Metinler i18n; accent renkleri TrainerModeHeader
 * ile paylasilir. Hardcoded dark degerler tema-aware degiskenlere cevrildi (accent hex'leri
 * ve Pro moru bilincli korunur).
 */
import React from 'react';
import {Timer, BluetoothConnected, Lightning, Eye, Check, Lock, Cube} from 'phosphor-react';
import block from '../../styles/bem';
import './TrainerLanding.scss';
import {useTrainerContext} from './TrainerContext';
import {useMe} from '../../util/hooks/useMe';
import {isProEnabled, isPro} from '../../lib/pro';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import type {TrainerMode} from './types';

const b = block('trainer');

interface ModeConfig {
	id: TrainerMode;
	icon: React.ReactNode;
	accent: 'blue' | 'purple' | 'green' | 'orange';
	pro?: boolean;
	titleKey: string;
	descKey: string;
	groups: {labelKey: string; itemKeys: string[]}[];
}

const MODES: ModeConfig[] = [
	{
		id: 'standard',
		icon: <Timer size={24} />,
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
		icon: <BluetoothConnected size={24} />,
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
		icon: <Lightning size={24} />,
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
		icon: <Eye size={24} />,
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

export default function TrainerLanding() {
	const {t} = useTranslation();
	const {dispatch} = useTrainerContext();
	const me = useMe();
	const history = useHistory();
	const smartLocked = isProEnabled() && !isPro(me);

	const selectMode = (mode: TrainerMode, locked: boolean) => {
		if (locked) {
			history.push('/pro');
			return;
		}
		dispatch({type: 'SET_MODE', payload: mode});
	};

	return (
		<div className={b('landing')}>
			<div className={b('landing-header')}>
				<h1 className={b('landing-title')}>{t('trainer.title')}</h1>
				<p className={b('landing-subtitle')}>{t('trainer.landing_subtitle')}</p>
			</div>

			<div className={b('landing-cards')}>
				{MODES.map((mode, i) => {
					const pro = !!mode.pro;
					const locked = pro && smartLocked;
					const num = String(i + 1).padStart(2, '0');
					return (
						<div
							key={mode.id}
							className={b('landing-card', {[mode.accent]: true, pro, locked})}
							onClick={() => selectMode(mode.id, locked)}
							role="button"
							tabIndex={locked ? -1 : 0}
							onKeyDown={(e) => e.key === 'Enter' && selectMode(mode.id, locked)}
						>
							<span className={b('landing-card-watermark')} aria-hidden="true">
								<Cube size={150} weight="thin" />
							</span>

							<div className={b('landing-card-eyebrow-row')}>
								<span className={b('landing-card-eyebrow')}>
									{pro ? 'PRO · ' : ''}
									{t('trainer.landing_eyebrow', {defaultValue: 'MOD'})} {num}
								</span>
								<span className={b('landing-card-icon')}>{mode.icon}</span>
							</div>

							<h2 className={b('landing-card-name')}>{t(mode.titleKey)}</h2>
							<p className={b('landing-card-desc')}>{t(mode.descKey)}</p>

							<div className={b('landing-card-groups')}>
								{mode.groups.map((g, gi) => (
									<div key={gi} className={b('landing-card-group')}>
										<span className={b('landing-card-group-label')}>{t(g.labelKey)}</span>
										<div className={b('landing-card-features')}>
											{g.itemKeys.map((ik) => (
												<div key={ik} className={b('landing-card-feature')}>
													<span className={b('landing-card-check')}>
														<Check size={15} weight="bold" />
													</span>
													<span>{t(ik)}</span>
												</div>
											))}
										</div>
									</div>
								))}
							</div>

							<button
								type="button"
								className={b('landing-card-cta', {pro})}
								onClick={(e) => {
									if (locked) {
										e.stopPropagation();
										history.push('/pro');
									}
								}}
							>
								{locked && <Lock size={14} />}
								{locked ? t('trainer.landing_pro_required') : t(mode.titleKey)}
							</button>
						</div>
					);
				})}
			</div>
		</div>
	);
}
