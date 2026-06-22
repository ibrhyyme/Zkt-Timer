/**
 * TrainerLanding — mod secici.
 * Masaustu: "Solid Editorial" 4 kart grid. Mobil: Coverflow 3D carousel
 * (TrainerLandingCoverflow). Ikisi de paylasilan TRAINER_MODES + i18n kullanir.
 */
import React from 'react';
import {Check, Lock, Cube} from 'phosphor-react';
import block from '../../styles/bem';
import './TrainerLanding.scss';
import {useTrainerContext} from './TrainerContext';
import {useMe} from '../../util/hooks/useMe';
import {useGeneral} from '../../util/hooks/useGeneral';
import {isProEnabled, isPro} from '../../lib/pro';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import {TRAINER_MODES, OLLCP_MODE} from './landing_modes';
import TrainerLandingCoverflow from './landing_coverflow/TrainerLandingCoverflow';
import type {TrainerMode} from './types';

const b = block('trainer');

export default function TrainerLanding() {
	const {t} = useTranslation();
	const {dispatch} = useTrainerContext();
	const me = useMe();
	const history = useHistory();
	const mobileMode = useGeneral('mobile_mode');
	const smartLocked = isProEnabled() && !isPro(me);
	// Admin-only OLLCP mode shows up FIRST (so coverflow opens on it, no swiping needed).
	const modes = me?.admin ? [OLLCP_MODE, ...TRAINER_MODES] : TRAINER_MODES;

	const selectMode = (mode: TrainerMode, locked: boolean) => {
		// Landing is public for SEO, but actually training requires an account.
		// Anonymous visitors get sent to login instead of dropping into the training UI.
		if (!me) {
			history.push('/login?redirect=' + encodeURIComponent('/trainer'));
			return;
		}
		if (locked) {
			history.push('/pro');
			return;
		}
		dispatch({type: 'SET_MODE', payload: mode});
	};

	// Mobil: Coverflow 3D carousel (app'in PageTitle header'i ustte kalir)
	if (mobileMode) {
		return <TrainerLandingCoverflow modes={modes} smartLocked={smartLocked} onSelect={selectMode} />;
	}

	// Masaustu: Solid Editorial grid
	return (
		<div className={b('landing')}>
			<div className={b('landing-header')}>
				<h1 className={b('landing-title')}>{t('trainer.title')}</h1>
				<p className={b('landing-subtitle')}>{t('trainer.landing_subtitle')}</p>
			</div>

			<div className={b('landing-cards')}>
				{modes.map((mode, i) => {
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
								<span className={b('landing-card-icon')}>
									<mode.Icon size={24} />
								</span>
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
									if (!me) {
										e.stopPropagation();
										history.push('/login?redirect=' + encodeURIComponent('/trainer'));
										return;
									}
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
