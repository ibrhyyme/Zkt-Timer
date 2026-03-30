import React from 'react';
import {BluetoothConnected, Lock, Check, Crown, Timer} from 'phosphor-react';
import block from '../../styles/bem';
import {useTrainerContext} from './TrainerContext';
import {useMe} from '../../util/hooks/useMe';
import {isProEnabled, isPro} from '../../lib/pro';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import ElectricBorder from '../common/electric_border/ElectricBorder';

const b = block('trainer');

export default function TrainerLanding() {
	const {t} = useTranslation();
	const {dispatch} = useTrainerContext();
	const me = useMe();

	const history = useHistory();
	const smartLocked = isProEnabled() && !isPro(me);

	const handleSelectStandard = () => {
		dispatch({type: 'SET_MODE', payload: 'standard'});
	};

	const handleSelectSmart = () => {
		if (smartLocked) {
			history.push('/account/pro');
			return;
		}
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
					<div className={b('landing-card-top')}>
						<div className={b('landing-card-icon', {blue: true})}>
							<Timer size={28} weight="duotone" />
						</div>
						<h2 className={b('landing-card-name')}>{t('trainer.landing_standard_title')}</h2>
						<p className={b('landing-card-desc')}>{t('trainer.landing_standard_desc')}</p>
					</div>

					<div className={b('landing-card-divider')} />

					<div className={b('landing-card-includes')}>
						<span className={b('landing-card-includes-label')}>
							{t('trainer.landing_standard_categories')}
						</span>
						<div className={b('landing-card-features')}>
							<div className={b('landing-card-feature')}>
								<Check weight="bold" />
								<span>{t('trainer.landing_standard_3x3')}</span>
							</div>
							<div className={b('landing-card-feature')}>
								<Check weight="bold" />
								<span>{t('trainer.landing_standard_roux')}</span>
							</div>
							<div className={b('landing-card-feature')}>
								<Check weight="bold" />
								<span>{t('trainer.landing_standard_other')}</span>
							</div>
						</div>
					</div>

					<div className={b('landing-card-includes')}>
						<span className={b('landing-card-includes-label')}>
							{t('trainer.landing_standard_features')}
						</span>
						<div className={b('landing-card-features')}>
							<div className={b('landing-card-feature')}>
								<Check weight="bold" />
								<span>{t('trainer.landing_standard_feat1')}</span>
							</div>
							<div className={b('landing-card-feature')}>
								<Check weight="bold" />
								<span>{t('trainer.landing_standard_feat2')}</span>
							</div>
							<div className={b('landing-card-feature')}>
								<Check weight="bold" />
								<span>{t('trainer.landing_standard_feat3')}</span>
							</div>
						</div>
					</div>

					<button type="button" className={b('landing-card-cta')}>
						{t('trainer.landing_standard_title')}
					</button>
				</div>

				{/* Smart Cube Mode */}
				<ElectricBorder
					color="#7c3aed"
					speed={0.6}
					chaos={0.1}
					borderRadius={20}
					className={b('landing-electric-wrap')}
				>
					<div
						className={b('landing-card', {pro: true, locked: smartLocked})}
						onClick={handleSelectSmart}
						role="button"
						tabIndex={smartLocked ? -1 : 0}
						onKeyDown={(e) => e.key === 'Enter' && handleSelectSmart()}
					>
						<div className={b('landing-pro-badge')}>
							<Crown weight="fill" />
							<span>PRO</span>
						</div>

						<div className={b('landing-card-top')}>
							<div className={b('landing-card-icon', {purple: true})}>
								<BluetoothConnected size={28} weight="duotone" />
							</div>
							<h2 className={b('landing-card-name', {pro: true})}>
								{t('trainer.landing_smart_title')}
							</h2>
							<p className={b('landing-card-desc', {pro: true})}>
								{t('trainer.landing_smart_desc')}
							</p>
						</div>

						<div className={b('landing-card-divider', {pro: true})} />

						<div className={b('landing-card-includes')}>
							<span className={b('landing-card-includes-label', {pro: true})}>
								{t('trainer.landing_smart_categories')}
							</span>
							<div className={b('landing-card-features')}>
								<div className={b('landing-card-feature', {pro: true})}>
									<Check weight="bold" />
									<span>{t('trainer.landing_smart_3x3')}</span>
								</div>
								<div className={b('landing-card-feature', {pro: true})}>
									<Check weight="bold" />
									<span>{t('trainer.landing_smart_roux')}</span>
								</div>
							</div>
						</div>

						<div className={b('landing-card-includes')}>
							<span className={b('landing-card-includes-label', {pro: true})}>
								{t('trainer.landing_smart_features')}
							</span>
							<div className={b('landing-card-features')}>
								<div className={b('landing-card-feature', {pro: true})}>
									<Check weight="bold" />
									<span>{t('trainer.landing_smart_feat1')}</span>
								</div>
								<div className={b('landing-card-feature', {pro: true})}>
									<Check weight="bold" />
									<span>{t('trainer.landing_smart_feat2')}</span>
								</div>
								<div className={b('landing-card-feature', {pro: true})}>
									<Check weight="bold" />
									<span>{t('trainer.landing_smart_feat3')}</span>
								</div>
								<div className={b('landing-card-feature', {pro: true})}>
									<Check weight="bold" />
									<span>{t('trainer.landing_smart_feat4')}</span>
								</div>
							</div>
						</div>

						<button
							type="button"
							className={b('landing-card-cta', {pro: true})}
							onClick={(e) => {
								if (smartLocked) {
									e.stopPropagation();
									history.push('/account/pro');
								}
							}}
						>
							{smartLocked ? t('trainer.landing_pro_required') : t('trainer.landing_smart_title')}
						</button>
					</div>
				</ElectricBorder>
			</div>
		</div>
	);
}
