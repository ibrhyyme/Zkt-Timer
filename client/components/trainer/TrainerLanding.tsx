import React from 'react';
import {Timer, BluetoothConnected, Lock, Cube, ChartLineUp, Export, Eye, Gauge, Lightning, Bluetooth} from 'phosphor-react';
import block from '../../styles/bem';
import {useTrainerContext} from './TrainerContext';
import {useMe} from '../../util/hooks/useMe';
import {isProEnabled, isPro} from '../../lib/pro';
import {useTranslation} from 'react-i18next';

const b = block('trainer');

export default function TrainerLanding() {
	const {t} = useTranslation();
	const {dispatch} = useTrainerContext();
	const me = useMe();

	const smartLocked = isProEnabled() && !isPro(me);

	const handleSelectStandard = () => {
		dispatch({type: 'SET_MODE', payload: 'standard'});
	};

	const handleSelectSmart = () => {
		if (smartLocked) return;
		dispatch({type: 'SET_MODE', payload: 'smart'});
	};

	return (
		<div className={b('landing')}>
			<div className={b('landing-header')}>
				<h1 className={b('landing-title')}>{t('trainer.title')}</h1>
				<p className={b('landing-subtitle')}>{t('trainer.landing_subtitle')}</p>
			</div>

			<div className={b('landing-cards')}>
				{/* Standard Mode */}
				<div
					className={b('landing-card')}
					onClick={handleSelectStandard}
					role="button"
					tabIndex={0}
					onKeyDown={(e) => e.key === 'Enter' && handleSelectStandard()}
				>
					<div className={b('landing-card-icon', {blue: true})}>
						<Timer size={40} weight="duotone" />
					</div>
					<h2 className={b('landing-card-title')}>
						{t('trainer.landing_standard_title')}
					</h2>
					<p className={b('landing-card-desc')}>
						{t('trainer.landing_standard_desc')}
					</p>

					<div className={b('landing-card-section')}>
						<h3 className={b('landing-card-section-title')}>
							<Cube size={14} weight="duotone" />
							{t('trainer.landing_standard_categories')}
						</h3>
						<ul className={b('landing-card-list')}>
							<li>{t('trainer.landing_standard_3x3')}</li>
							<li>{t('trainer.landing_standard_roux')}</li>
							<li>{t('trainer.landing_standard_other')}</li>
						</ul>
					</div>

					<div className={b('landing-card-section')}>
						<h3 className={b('landing-card-section-title')}>
							<Lightning size={14} weight="duotone" />
							{t('trainer.landing_standard_features')}
						</h3>
						<ul className={b('landing-card-features')}>
							<li><Eye size={14} weight="duotone" /> {t('trainer.landing_standard_feat1')}</li>
							<li><ChartLineUp size={14} weight="duotone" /> {t('trainer.landing_standard_feat2')}</li>
							<li><Export size={14} weight="duotone" /> {t('trainer.landing_standard_feat3')}</li>
						</ul>
					</div>

					</div>

				{/* Smart Cube Mode */}
				<div
					className={b('landing-card', {locked: smartLocked})}
					onClick={handleSelectSmart}
					role="button"
					tabIndex={smartLocked ? -1 : 0}
					onKeyDown={(e) => e.key === 'Enter' && handleSelectSmart()}
				>
					{smartLocked && (
						<div className={b('landing-card-lock')}>
							<Lock size={16} weight="fill" />
							<span>{t('trainer.landing_pro_required')} &middot; {t('trainer.landing_coming_soon')}</span>
						</div>
					)}
					<div className={b('landing-card-icon', {purple: true})}>
						<BluetoothConnected size={40} weight="duotone" />
					</div>
					<h2 className={b('landing-card-title')}>
						{t('trainer.landing_smart_title')}
					</h2>
					<p className={b('landing-card-desc')}>
						{t('trainer.landing_smart_desc')}
					</p>

					<div className={b('landing-card-section')}>
						<h3 className={b('landing-card-section-title')}>
							<Cube size={14} weight="duotone" />
							{t('trainer.landing_smart_categories')}
						</h3>
						<ul className={b('landing-card-list')}>
							<li>{t('trainer.landing_smart_3x3')}</li>
							<li>{t('trainer.landing_smart_roux')}</li>
						</ul>
					</div>

					<div className={b('landing-card-section')}>
						<h3 className={b('landing-card-section-title')}>
							<Lightning size={14} weight="duotone" />
							{t('trainer.landing_smart_features')}
						</h3>
						<ul className={b('landing-card-features')}>
							<li><Gauge size={14} weight="duotone" /> {t('trainer.landing_smart_feat1')}</li>
							<li><Eye size={14} weight="duotone" /> {t('trainer.landing_smart_feat2')}</li>
							<li><ChartLineUp size={14} weight="duotone" /> {t('trainer.landing_smart_feat3')}</li>
							<li><Bluetooth size={14} weight="duotone" /> {t('trainer.landing_smart_feat4')}</li>
						</ul>
					</div>

					<div className={b('landing-card-badge', {pro: true})}>
						PRO
					</div>
				</div>
			</div>
		</div>
	);
}
