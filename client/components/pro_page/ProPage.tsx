import React, {useState} from 'react';
import './ProPage.scss';
import {useTranslation} from 'react-i18next';
import {Crown, Check, CaretDown, Info, Ticket, CheckCircle, Sparkle} from 'phosphor-react';
import {useDispatch} from 'react-redux';
import {gql} from '@apollo/client';
import block from '../../styles/bem';
import ElectricBorder from '../common/electric_border/ElectricBorder';
import {gqlMutate} from '../api';
import {openModal} from '../../actions/general';
import {toastError} from '../../util/toast';
import PromoSuccessModal from './PromoSuccessModal';
import PlanCompareModal from './PlanCompareModal';
import {useMe} from '../../util/hooks/useMe';
import {isPro} from '../../lib/pro';
import FeatureGuard from '../common/page_disabled/FeatureGuard';

const b = block('pro-page');

type PlanId = 'monthly' | 'yearly' | 'lifetime';

interface Plan {
	id: PlanId;
	priceKey: string;
	detailKey: string;
	trialKey: string;
	hasTrial: boolean;
	popular?: boolean;
}

const PLANS: Plan[] = [
	{id: 'monthly', priceKey: 'pro_page.plan.monthly_price', detailKey: 'pro_page.plan.monthly_detail', trialKey: 'pro_page.plan.trial', hasTrial: true},
	{id: 'yearly', priceKey: 'pro_page.plan.yearly_price', detailKey: 'pro_page.plan.yearly_detail', trialKey: 'pro_page.plan.trial', hasTrial: true, popular: true},
	{id: 'lifetime', priceKey: 'pro_page.plan.lifetime_price', detailKey: 'pro_page.plan.lifetime_detail', trialKey: 'pro_page.plan.no_trial', hasTrial: false},
];

const PRO_FEATURES = [
	'sync',
	'smart_cube_analysis',
	'trainer_smart_cube',
	'trainer_pdf',
	'themes',
	'advanced_stats',
	'leaderboard_publish',
	'timer_background',
	'room_music',
	'pro_badge',
	'data_import',
	'stats_customization',
	'solve_sharing',
] as const;

interface FeatureRowProps {
	featureKey: string;
}

function FeatureRow({featureKey}: FeatureRowProps) {
	const [open, setOpen] = useState(false);
	const {t} = useTranslation();

	return (
		<li className={b('feature', {open})}>
			<button type="button" className={b('feature-row')} onClick={() => setOpen(!open)}>
				<Check weight="bold" className={b('feature-check')} />
				<span className={b('feature-label')}>{t(`pro_page.features.${featureKey}.title`)}</span>
				<CaretDown weight="bold" className={b('feature-caret')} />
			</button>
			{open && (
				<div className={b('feature-detail')}>
					<p>{t(`pro_page.features.${featureKey}.desc`)}</p>
				</div>
			)}
		</li>
	);
}

const REDEEM_PROMO = gql`
	mutation RedeemPromo($code: String!) {
		redeemPromoCode(code: $code) {
			success
			membership_type
			expires_at
		}
	}
`;

function ProPageContent() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const userIsPro = isPro(me);
	const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
	const [promoCode, setPromoCode] = useState('');
	const [redeeming, setRedeeming] = useState(false);

	const proExpiresAt = (me as any)?.pro_expires_at || (me as any)?.premium_expires_at;
	const expiryLabel = proExpiresAt
		? new Date(proExpiresAt).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})
		: null;

	const activePlan = PLANS.find((p) => p.id === selectedPlan)!;

	async function handleRedeem() {
		if (!promoCode.trim() || redeeming) return;
		setRedeeming(true);
		try {
			const result = await gqlMutate(REDEEM_PROMO, {code: promoCode.trim()});
			const data = result?.data?.redeemPromoCode;
			if (data?.success) {
				setPromoCode('');
				dispatch(openModal(
					<PromoSuccessModal membershipType={data.membership_type} expiresAt={data.expires_at} />
				));
			}
		} catch (e: any) {
			const msg = e?.message || '';
			if (msg.includes('already_used')) {
				toastError(t('pro_page.promo.error_used'));
			} else if (msg.includes('max_uses')) {
				toastError(t('pro_page.promo.error_max_uses'));
			} else {
				toastError(t('pro_page.promo.error_invalid'));
			}
		} finally {
			setRedeeming(false);
		}
	}

	function openCompare() {
		dispatch(openModal(<PlanCompareModal />));
	}

	return (
		<div className={b()}>
			<div className={b('container')}>
				<ElectricBorder
					color="#7c3aed"
					speed={0.6}
					chaos={0.1}
					borderRadius={20}
					className={b('electric-wrap')}
				>
					<div className={b('card')}>
						<div className={b('pro-badge')}>
							<Crown weight="fill" />
							<span>PRO</span>
						</div>

						{/* Sol Sütun — Desktop yatayda, mobile üstte */}
						<div className={b('card-main')}>
							<div className={b('card-top')}>
								<h2 className={b('card-name')}>{t('pro_page.pro_card_title')}</h2>
								<p className={b('card-desc')}>
									{userIsPro ? t('pro_page.pro_active_desc') : t('pro_page.pro_desc')}
								</p>
								{userIsPro && expiryLabel && (
									<p className={b('card-expiry')}>{t('pro_page.pro_expires', {date: expiryLabel})}</p>
								)}
							</div>

							<div className={b('segments')} role="tablist">
								{PLANS.map((plan) => (
									<button
										key={plan.id}
										type="button"
										role="tab"
										aria-selected={selectedPlan === plan.id}
										className={b('segment', {active: selectedPlan === plan.id})}
										onClick={() => setSelectedPlan(plan.id)}
									>
										<span className={b('segment-label')}>{t(`pro_page.plan.${plan.id}_label`)}</span>
										{plan.popular && (
											<span className={b('segment-badge')}>
												<Sparkle weight="fill" />
												{t('pro_page.plan.popular')}
											</span>
										)}
									</button>
								))}
							</div>

							<div className={b('price-block')}>
								<div className={b('price-amount')}>{t(activePlan.priceKey)}</div>
								<div className={b('price-detail')}>{t(activePlan.detailKey)}</div>
								<div className={b('price-trial', {muted: !activePlan.hasTrial})}>
									{activePlan.hasTrial && <Sparkle weight="fill" />}
									<span>{t(activePlan.trialKey)}</span>
								</div>
								<div className={b('price-region-hint')}>{t('pro_page.plan.region_hint')}</div>
							</div>

							{userIsPro ? (
								<div className={b('card-active')}>
									<CheckCircle weight="fill" />
									<span>{t('pro_page.current_plan')}</span>
								</div>
							) : (
								<>
									<button className={b('cta')} disabled>
										{t('pro_page.mobile_only_cta')}
									</button>
									<p className={b('cta-hint')}>
										<Info weight="fill" />
										<span>{t('pro_page.mobile_only_hint')}</span>
									</p>
								</>
							)}
						</div>

						{/* Sağ Sütun — Desktop yatayda, mobile altta. Tüm feature listesi */}
						<div className={b('features-summary')}>
							<span className={b('features-summary-label')}>{t('pro_page.pro_includes')}</span>
							<ul className={b('features-list')}>
								<li className={b('feature', {highlight: true})}>
									<div className={b('feature-row', {static: true})}>
										<Check weight="bold" className={b('feature-check', {highlight: true})} />
										<span className={b('feature-label', {highlight: true})}>{t('pro_page.all_basic_included')}</span>
									</div>
								</li>
								{PRO_FEATURES.map((key) => (
									<FeatureRow key={key} featureKey={key} />
								))}
							</ul>
							<button type="button" className={b('compare-link')} onClick={openCompare}>
								{t('pro_page.compare_plans')}
							</button>
						</div>
					</div>
				</ElectricBorder>

				{!userIsPro && (
					<div className={b('basic-hint')}>
						<span>{t('pro_page.basic_hint')}</span>
					</div>
				)}

				<div className={b('promo')}>
					<Ticket weight="duotone" className={b('promo-icon')} />
					<h3 className={b('promo-title')}>{t('pro_page.promo.title')}</h3>
					<p className={b('promo-desc')}>{t('pro_page.promo.desc')}</p>
					<div className={b('promo-form')}>
						<input
							className={b('promo-input')}
							placeholder={t('pro_page.promo.placeholder')}
							value={promoCode}
							onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
							onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
						/>
						<button
							className={b('promo-btn')}
							onClick={handleRedeem}
							disabled={redeeming || !promoCode.trim()}
						>
							{redeeming ? '...' : t('pro_page.promo.redeem')}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function ProPage() {
	return (
		<FeatureGuard feature="pro_enabled" pageNameKey="pro_page.hero_title">
			<ProPageContent />
		</FeatureGuard>
	);
}
