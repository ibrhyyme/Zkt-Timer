import React, { useState } from 'react';
import './ProPage.scss';
import { useTranslation } from 'react-i18next';
import {
	Crown,
	Robot,
	ChartLineUp,
	Palette,
	Headset,
	RocketLaunch,
	Check,
	Lightning,
	Star,
} from 'phosphor-react';
import block from '../../styles/bem';
import Button from '../common/button/Button';

const b = block('pro-page');

type AccentColor = 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'cyan';

interface FeatureItemProps {
	icon: React.ReactElement;
	title: string;
	description: string;
	accent: AccentColor;
}

function FeatureItem({ icon, title, description, accent }: FeatureItemProps) {
	return (
		<div className={b('feature-item')}>
			<div className={b('feature-icon', { [accent]: true })}>{icon}</div>
			<div className={b('feature-text')}>
				<h3>{title}</h3>
				<p>{description}</p>
			</div>
		</div>
	);
}

interface PricingCardProps {
	title: string;
	price: string;
	perMonth: string;
	highlighted?: boolean;
	badge?: string;
	bonus?: string;
	selected?: boolean;
	onClick?: () => void;
}

function PricingCard({ title, price, perMonth, highlighted, badge, bonus, selected, onClick }: PricingCardProps) {
	return (
		<button
			type="button"
			className={b('plan-card', { highlighted, selected })}
			onClick={onClick}
		>
			{badge && <div className={b('plan-badge')}><Star weight="fill" /> {badge}</div>}
			<h3 className={b('plan-title')}>{title}</h3>
			<div className={b('plan-price')}>
				<span className={b('plan-price-amount')}>${price}</span>
				<span className={b('plan-price-period')}>{perMonth}</span>
			</div>
			{bonus && <div className={b('plan-bonus')}><Lightning weight="fill" /> {bonus}</div>}
		</button>
	);
}

export default function ProPage() {
	const { t } = useTranslation();
	const [selectedPlan, setSelectedPlan] = useState<'six_months' | 'one_year'>('one_year');

	return (
		<div className={b()}>
			<div className={b('container')}>
				{/* Hero */}
				<div className={b('hero')}>
					<div className={b('hero-badge')}>
						<Crown weight="fill" />
						<span>PRO</span>
					</div>
					<h1 className={b('hero-title')}>
						{t('pro_page.title')}
					</h1>
					<p className={b('hero-subtitle')}>
						{t('pro_page.subtitle')}
					</p>
				</div>

				{/* Features Section */}
				<div className={b('features')}>
					<h2 className={b('section-title')}>{t('pro_page.features_title')}</h2>
					<div className={b('features-grid')}>
						<FeatureItem
							accent="blue"
							icon={<Robot weight="fill" />}
							title={t('pro_page.feature_ai_coach')}
							description={t('pro_page.feature_ai_coach_desc')}
						/>
						<FeatureItem
							accent="green"
							icon={<Lightning weight="fill" />}
							title={t('pro_page.feature_trainer')}
							description={t('pro_page.feature_trainer_desc')}
						/>
						<FeatureItem
							accent="purple"
							icon={<ChartLineUp weight="fill" />}
							title={t('pro_page.feature_stats')}
							description={t('pro_page.feature_stats_desc')}
						/>
						<FeatureItem
							accent="orange"
							icon={<Palette weight="fill" />}
							title={t('pro_page.feature_themes')}
							description={t('pro_page.feature_themes_desc')}
						/>
						<FeatureItem
							accent="red"
							icon={<Headset weight="fill" />}
							title={t('pro_page.feature_support')}
							description={t('pro_page.feature_support_desc')}
						/>
						<FeatureItem
							accent="cyan"
							icon={<RocketLaunch weight="fill" />}
							title={t('pro_page.feature_early_access')}
							description={t('pro_page.feature_early_access_desc')}
						/>
					</div>
				</div>

				{/* Pricing Section */}
				<div className={b('pricing')}>
					<h2 className={b('section-title')}>{t('pro_page.pricing_title')}</h2>
					<div className={b('plans')}>
						<PricingCard
							title={t('pro_page.six_months')}
							price="2.99"
							perMonth={t('pro_page.per_month')}
							selected={selectedPlan === 'six_months'}
							onClick={() => setSelectedPlan('six_months')}
						/>
						<PricingCard
							title={t('pro_page.one_year')}
							price="1.99"
							perMonth={t('pro_page.per_month')}
							highlighted
							badge={t('pro_page.best_value')}
							bonus={t('pro_page.bonus_months')}
							selected={selectedPlan === 'one_year'}
							onClick={() => setSelectedPlan('one_year')}
						/>
					</div>

					{/* CTA */}
					<div className={b('cta')}>
						<Button
							primary
							glow
							large
							disabled
							text={t('pro_page.coming_soon')}
						/>
					</div>

					{/* Checklist */}
					<ul className={b('checklist')}>
						<li><Check weight="bold" /> {t('pro_page.plan_feature_all_pro')}</li>
						<li><Check weight="bold" /> {t('pro_page.plan_feature_ai')}</li>
						<li><Check weight="bold" /> {t('pro_page.plan_feature_themes')}</li>
						<li><Check weight="bold" /> {t('pro_page.plan_feature_support')}</li>
					</ul>
				</div>
			</div>
		</div>
	);
}
