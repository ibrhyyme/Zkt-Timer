import React from 'react';
import {Check, X, Crown} from 'phosphor-react';
import {useTranslation} from 'react-i18next';
import {useDispatch} from 'react-redux';
import {closeModal} from '../../actions/general';
import block from '../../styles/bem';
import {PRO_FEATURES} from '../../lib/pro_features';

const b = block('plan-compare-modal');

const BASIC_FEATURES = [
	'timer',
	'sessions',
	'unlimited_solves',
	'rooms',
	'basic_stats',
	'smart_cube_basic',
	'trainer_basic',
	'friends',
	'notifications',
	'settings_sync',
	'two_themes',
] as const;

// Pro side comes from the shared registry (client/lib/pro_features.ts). This column
// used to carry its own copy of the list and had drifted from the Pro page's: it
// still advertised data import and "advanced stats", neither of which is gated.
// Basic stays local: it describes what a free account gets, not a set of gates.

export default function PlanCompareModal() {
	const {t} = useTranslation();
	const dispatch = useDispatch();

	return (
		<div className={b()}>
			<button type="button" className={b('close')} onClick={() => dispatch(closeModal())}>
				<X weight="bold" />
			</button>

			<div className={b('header')}>
				<h2 className={b('title')}>{t('pro_page.compare.title')}</h2>
				<p className={b('subtitle')}>{t('pro_page.compare.subtitle')}</p>
			</div>

			<div className={b('columns')}>
				<div className={b('column')}>
					<div className={b('column-header')}>
						<h3 className={b('column-title')}>{t('pro_page.compare.basic')}</h3>
						<span className={b('column-price')}>{t('pro_page.free')}</span>
					</div>
					<ul className={b('feature-list')}>
						{BASIC_FEATURES.map((key) => (
							<li key={key} className={b('feature')}>
								<Check weight="bold" className={b('check')} />
								<div className={b('feature-text')}>
									<span className={b('feature-name')}>{t(`pro_page.basic_features.${key}.title`)}</span>
									<span className={b('feature-desc')}>{t(`pro_page.basic_features.${key}.desc`)}</span>
								</div>
							</li>
						))}
					</ul>
				</div>

				<div className={b('column', {pro: true})}>
					<div className={b('column-header', {pro: true})}>
						<h3 className={b('column-title', {pro: true})}>
							<Crown weight="fill" />
							{t('pro_page.compare.pro')}
						</h3>
						<span className={b('column-price', {pro: true})}>{t('pro_page.compare.pro_price_hint')}</span>
					</div>
					<ul className={b('feature-list')}>
						<li className={b('feature', {pro: true, highlight: true})}>
							<Check weight="bold" className={b('check', {pro: true})} />
							<div className={b('feature-text')}>
								<span className={b('feature-name', {pro: true})}>{t('pro_page.all_basic_included')}</span>
							</div>
						</li>
						{PRO_FEATURES.map((feature) => (
							<li key={feature.key} className={b('feature', {pro: true})}>
								<Check weight="bold" className={b('check', {pro: true})} />
								<div className={b('feature-text')}>
									<span className={b('feature-name', {pro: true})}>{t(feature.titleKey)}</span>
									<span className={b('feature-desc', {pro: true})}>{t(feature.descKey)}</span>
								</div>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
