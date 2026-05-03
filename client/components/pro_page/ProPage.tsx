import React, {useState} from 'react';
import './ProPage.scss';
import {useTranslation} from 'react-i18next';
import {
	Crown, Check, CaretDown, Info, Ticket, CheckCircle, Sparkle, Warning,
	CloudArrowUp, ChartBar, Lightning, FilePdf, PaintBrush, FrameCorners,
	MusicNote, Users, Medal, Sliders, ShareNetwork, Rocket, Brain, BookOpen, Crosshair,
	ArrowRight, BellRinging,
} from 'phosphor-react';
import CountUp from '../stats/common/count_up/CountUp';
import {useDispatch} from 'react-redux';
import {gql, useQuery} from '@apollo/client';
import block from '../../styles/bem';
import {gqlMutate} from '../api';
import {openModal} from '../../actions/general';
import {getMe} from '../../actions/account';
import {toastError, toastSuccess} from '../../util/toast';
import PromoSuccessModal from './PromoSuccessModal';
import {useMe} from '../../util/hooks/useMe';
import {isPro} from '../../lib/pro';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import {isNative, isAndroidNative} from '../../util/platform';
import {getOfferings, purchasePackage, restorePurchases, showManageSubscriptions} from '../../lib/iap';
import {openInAppBrowser} from '../../util/external-link';
import {GetIapStatusDocument, GetIapStatusQuery} from '../../@types/generated/graphql';
import {useGeneral} from '../../util/hooks/useGeneral';
import MobileNav from '../layout/nav/mobile_nav/MobileNav';
import AccountDropdown from '../layout/nav/account_dropdown/AccountDropdown';

const b = block('pro-page');

type PlanId = 'monthly' | 'yearly' | 'lifetime';

interface Plan {
	id: PlanId;
	priceKey: string;
	detailKey: string;
	trialKey: string;
	sublabelKey: string;
	cycleLabelKey: string;
	hasTrial: boolean;
	popular?: boolean;
	bestValue?: boolean;
}

// Yearly first — matches design order. planIndex used for sliding thumb.
const PLANS: Plan[] = [
	{
		id: 'yearly',
		priceKey: 'pro_page.plan.yearly_price',
		detailKey: 'pro_page.plan.yearly_detail',
		trialKey: 'pro_page.plan.trial',
		sublabelKey: 'pro_page.plan.yearly_sublabel',
		cycleLabelKey: 'pro_page.plan.yearly_cycle',
		hasTrial: true,
		popular: true,
	},
	{
		id: 'monthly',
		priceKey: 'pro_page.plan.monthly_price',
		detailKey: 'pro_page.plan.monthly_detail',
		trialKey: 'pro_page.plan.trial',
		sublabelKey: 'pro_page.plan.monthly_sublabel',
		cycleLabelKey: 'pro_page.plan.monthly_cycle',
		hasTrial: true,
	},
	{
		id: 'lifetime',
		priceKey: 'pro_page.plan.lifetime_price',
		detailKey: 'pro_page.plan.lifetime_detail',
		trialKey: 'pro_page.plan.no_trial',
		sublabelKey: 'pro_page.plan.lifetime_sublabel',
		cycleLabelKey: 'pro_page.plan.lifetime_cycle',
		hasTrial: false,
		bestValue: true,
	},
];

const PRO_FEATURES = [
	'sync',
	'smart_cube_analysis',
	'trainer_smart_cube',
	'trainer_pdf',
	'themes',
	'timer_background',
	'room_music',
	'room_smart_cube',
	'competition_follow',
	'pro_badge',
	'stats_customization',
	'solve_sharing',
] as const;

const UPCOMING_FEATURES = ['early_access', 'ai_analysis', 'pll_trainer', 'cross_trainer'] as const;

const FEATURE_ICONS: Record<string, React.ElementType> = {
	sync: CloudArrowUp,
	smart_cube_analysis: ChartBar,
	trainer_smart_cube: Lightning,
	trainer_pdf: FilePdf,
	themes: PaintBrush,
	timer_background: FrameCorners,
	room_music: MusicNote,
	room_smart_cube: Users,
	competition_follow: BellRinging,
	pro_badge: Medal,
	stats_customization: Sliders,
	solve_sharing: ShareNetwork,
	early_access: Rocket,
	ai_analysis: Brain,
	pll_trainer: BookOpen,
	cross_trainer: Crosshair,
};

const TESTIMONIALS = [
	{initials: 'EA', name: 'Efe A.', colorA: '#ff7ab6', colorB: '#8b78ff', quoteKey: 'pro_page.testimonials.t1'},
	{initials: 'MK', name: 'Melis K.', colorA: '#6ee7b7', colorB: '#6366f1', quoteKey: 'pro_page.testimonials.t2'},
	{initials: 'KS', name: 'Kaan S.', colorA: '#b5ff5a', colorB: '#06b6d4', quoteKey: 'pro_page.testimonials.t3'},
	{initials: 'SD', name: 'Selin D.', colorA: '#ffd166', colorB: '#ff7ab6', quoteKey: 'pro_page.testimonials.t4'},
	{initials: 'ÖY', name: 'Ömer Y.', colorA: '#8b78ff', colorB: '#3ef0a0', quoteKey: 'pro_page.testimonials.t5'},
	{initials: 'AN', name: 'Ayşegül N.', colorA: '#ff7ab6', colorB: '#ffd166', quoteKey: 'pro_page.testimonials.t6'},
];


function FeatureRow({featureKey, upcoming}: {featureKey: string; upcoming?: boolean}) {
	const [open, setOpen] = useState(false);
	const {t} = useTranslation();
	const Icon = FEATURE_ICONS[featureKey];

	return (
		<li className={b('feature', {open, upcoming})}>
			<button type="button" className={b('feature-row')} onClick={() => setOpen(!open)}>
				<span className={b('feat-icon', {soon: !!upcoming})}>
					{Icon
						? <Icon weight="fill" />
						: <Check weight="bold" />
					}
				</span>
				<span className={b('feature-label')}>
					{t(`pro_page.features.${featureKey}.title`)}
					{upcoming && <span className={b('feat-soon')}>Yakında</span>}
				</span>
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

interface IapOfferings {
	monthly?: any;
	yearly?: any;
	lifetime?: any;
}

function ProPageContent() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const userIsPro = isPro(me);
	const native = isNative();
	const mobileMode = useGeneral('mobile_mode');
	const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
	const [promoCode, setPromoCode] = useState('');
	const [redeeming, setRedeeming] = useState(false);
	const [purchasing, setPurchasing] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [offerings, setOfferings] = useState<IapOfferings>({});

	const {data: iapData, refetch: refetchIap} = useQuery<GetIapStatusQuery>(GetIapStatusDocument, {
		fetchPolicy: 'cache-and-network',
		skip: !me,
	});

	const iapStatus = iapData?.getIapStatus;
	const isIapPro = iapStatus?.is_iap_pro ?? false;
	const isGrantedPro = userIsPro && !isIapPro;
	const canPurchase = iapStatus?.can_purchase ?? !isGrantedPro;
	const iapCancellation = iapStatus?.iap_cancellation_at;
	const iapBillingIssue = iapStatus?.iap_billing_issue_at;
	const currentIapProductId = iapStatus?.iap_product_id;

	const proExpiresAt = (me as any)?.pro_expires_at || (me as any)?.premium_expires_at;
	const expiryLabel = proExpiresAt
		? new Date(proExpiresAt).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})
		: null;

	const activePlan = PLANS.find((p) => p.id === selectedPlan)!;
	// Index in PLANS array — used for sliding thumb transform
	const planIndex = PLANS.findIndex((p) => p.id === selectedPlan);

	React.useEffect(() => {
		if (!native) return;
		getOfferings().then(setOfferings).catch(() => {});
	}, [native]);

	React.useEffect(() => {
		if (!isIapPro || !currentIapProductId) return;
		if (currentIapProductId.endsWith('monthly')) setSelectedPlan('monthly');
		else if (currentIapProductId.endsWith('yearly')) setSelectedPlan('yearly');
		else if (currentIapProductId.endsWith('lifetime')) setSelectedPlan('lifetime');
	}, [isIapPro, currentIapProductId]);

	const selectedPackage = offerings[selectedPlan];
	const dynamicPrice = selectedPackage?.product?.priceString;

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

	function currentPlanId(): PlanId | null {
		if (!currentIapProductId) return null;
		if (currentIapProductId.endsWith('monthly')) return 'monthly';
		if (currentIapProductId.endsWith('yearly')) return 'yearly';
		if (currentIapProductId.endsWith('lifetime')) return 'lifetime';
		return null;
	}

	const isCurrentPlan = isIapPro && currentPlanId() === selectedPlan;
	const hasActiveSubscription = isIapPro && currentPlanId() !== null && currentPlanId() !== 'lifetime';
	const lifetimeBlocked = selectedPlan === 'lifetime' && hasActiveSubscription;
	const subscriptionPlatform = iapStatus?.iap_platform;
	const currentNativePlatform = native ? (isAndroidNative() ? 'android' : 'ios') : null;
	const isCrossPlatform = native && isIapPro && !!subscriptionPlatform && subscriptionPlatform !== currentNativePlatform;
	const isLifetimeOwner = isIapPro && currentPlanId() === 'lifetime';
	const ownedLifetimeBlocked = isLifetimeOwner && selectedPlan !== 'lifetime';
	const downgradeBlocked = isIapPro && currentPlanId() === 'yearly' && selectedPlan === 'monthly';
	const iapPaused = iapStatus?.iap_paused_until;

	if (isIapPro && (!native || isCrossPlatform)) {
		const platformLabel = subscriptionPlatform === 'android' ? 'Android' : 'iOS';
		const planId = currentPlanId();
		return (
			<div className={b('subscribed-via')}>
				{mobileMode && (
					<div className={b('mobile-header')}>
						<MobileNav />
						<AccountDropdown />
					</div>
				)}
				<div className={b('subscribed-via-card')}>
					<div className={b('subscribed-via-icon')}>
						<Crown weight="fill" size={32} />
					</div>
					<span className={b('eyebrow')}>
						<span className={b('eyebrow-dot')} />
						PRO
					</span>
					<h2 className={b('subscribed-via-title')}>
						{t('pro_page.subscribed_via_title', {platform: platformLabel})}
					</h2>
					{planId && (
						<div className={b('subscribed-via-plan-badge')}>
							<span>{t(`pro_page.plan.${planId}_label`)}</span>
							{expiryLabel && planId !== 'lifetime' && (
								<span className={b('subscribed-via-expiry')}>
									{t('pro_page.pro_expires', {date: expiryLabel})}
								</span>
							)}
						</div>
					)}
					<p className={b('subscribed-via-subtitle')}>
						{t('pro_page.subscribed_via_subtitle', {platform: platformLabel})}
					</p>
					<a href="/" className={b('subscribed-via-btn')}>
						{t('pro_page.subscribed_via_home')}
						<ArrowRight weight="bold" />
					</a>
				</div>
			</div>
		);
	}

	async function syncWithServer() {
		try {
			await fetch('/api/iap/sync', {method: 'POST', credentials: 'include'});
		} catch {}
	}

	async function handlePurchase() {
		if (!native || !selectedPackage || purchasing) return;
		if (!canPurchase) {
			toastError(t('pro_page.iap.blocked_by_grant'));
			return;
		}
		if (isCurrentPlan) return;
		if (lifetimeBlocked) {
			toastError(t('pro_page.iap.lifetime_needs_cancel'));
			return;
		}
		if (isCrossPlatform) {
			toastError(t('pro_page.iap.cross_platform_blocked', {platform: subscriptionPlatform === 'android' ? 'Android' : 'iOS'}));
			return;
		}
		if (ownedLifetimeBlocked) {
			toastError(t('pro_page.iap.already_lifetime'));
			return;
		}
		if (downgradeBlocked) {
			toastError(t('pro_page.iap.downgrade_blocked_toast'));
			return;
		}

		setPurchasing(true);
		try {
			const oldProductId = currentIapProductId || undefined;
			const monthlyPkg = offerings.monthly?.product?.price || 0;
			const yearlyPkg = offerings.yearly?.product?.price || 0;
			const yearlyMonthly = yearlyPkg / 12;
			let isUpgrade = true;
			if (currentIapProductId?.endsWith('yearly') && selectedPlan === 'monthly') {
				isUpgrade = false;
			} else if (currentIapProductId?.endsWith('monthly') && selectedPlan === 'yearly') {
				isUpgrade = yearlyMonthly > monthlyPkg ? false : true;
			}

			await purchasePackage(selectedPackage, oldProductId, isUpgrade);
			toastSuccess(t('pro_page.iap.purchase_success'));
			await syncWithServer();
			setTimeout(() => { refetchIap(); dispatch(getMe()); }, 1000);
		} catch (err: any) {
			const code = err?.code || '';
			const msg = String(err?.message || '').toLowerCase();
			if (code === 'PURCHASE_CANCELLED' || msg.includes('cancel')) {
				// kullanici iptal etti
			} else {
				console.error('[IAP] purchase hatasi', err);
				toastError(t('pro_page.iap.purchase_error'));
			}
		} finally {
			setPurchasing(false);
		}
	}

	async function handleRestore() {
		if (!native || restoring) return;
		setRestoring(true);
		try {
			const result = await restorePurchases();
			if (result?.isPro) {
				toastSuccess(t('pro_page.iap.restore_success'));
				await syncWithServer();
				setTimeout(() => { refetchIap(); dispatch(getMe()); }, 500);
			} else {
				toastError(t('pro_page.iap.restore_empty'));
			}
		} catch (err) {
			toastError(t('pro_page.iap.restore_error'));
		} finally {
			setRestoring(false);
		}
	}

	async function handleManage() {
		await showManageSubscriptions();
	}

	function purchaseButtonLabel(): string {
		if (purchasing) return t('pro_page.iap.purchasing');
		if (isCurrentPlan) return t('pro_page.current_plan');
		if (lifetimeBlocked) return t('pro_page.iap.cancel_first');
		if (ownedLifetimeBlocked) return t('pro_page.iap.already_lifetime_cta');
		if (downgradeBlocked) return t('pro_page.iap.downgrade_blocked_cta');
		if (isCrossPlatform) return t('pro_page.iap.cross_platform_cta', {platform: subscriptionPlatform === 'android' ? 'Android' : 'iOS'});
		if (hasActiveSubscription && selectedPlan !== 'lifetime') {
			const current = currentPlanId();
			if (current === 'monthly' && selectedPlan === 'yearly') return t('pro_page.iap.upgrade_to_yearly');
			if (current === 'yearly' && selectedPlan === 'monthly') return t('pro_page.iap.downgrade_to_monthly');
		}
		return t('pro_page.iap.purchase_cta');
	}

	const totalFeatures = PRO_FEATURES.length + UPCOMING_FEATURES.length;

	return (
		<div className={b()}>
			{mobileMode && (
				<div className={b('mobile-header')}>
					<MobileNav />
					<AccountDropdown />
				</div>
			)}
			{/* ── HERO ─────────────────────────────────────── */}
			<section className={b('hero')}>
				<span className={b('eyebrow')}>
					<span className={b('eyebrow-dot')} />
					PRO
				</span>
				<h1 className={b('hero-title')}>
					{t('pro_page.hero_title_1')}<br />
					<em>{t('pro_page.hero_title_em')}</em>
				</h1>
				<p className={b('hero-sub')}>{t('pro_page.hero_sub')}</p>
			</section>

			{/* ── BILLING PANEL ─────────────────────────────── */}
			<section className={b('billing-wrap')} id="billing">
				<div className={b('billing-card')}>
					<div className={b('billing-grid')}>

						{/* LEFT — plan selection, price, CTA */}
						<div className={b('billing-left')}>
							<div className={b('plan-header')}>
								<span className={b('plan-badge')}>
									<Crown weight="fill" />
									PRO
								</span>
								<span className={b('plan-badge', {live: true})}>
									<span className={b('plan-live-dot')} />
									{t('pro_page.plan_live')}
								</span>
							</div>

							<h2 className={b('plan-title')}>
								Pro <em>{t('pro_page.plan_title_em')}</em>
							</h2>

							<p className={b('plan-lede')}>
								{userIsPro ? t('pro_page.pro_active_desc') : t('pro_page.pro_desc')}
							</p>

							{userIsPro && expiryLabel && (
								<p className={b('card-expiry')}>{t('pro_page.pro_expires', {date: expiryLabel})}</p>
							)}

							{/* Segmented switcher with sliding thumb */}
							<div className={b('seg')} role="tablist">
								<div
									className={b('seg-thumb')}
									style={{transform: `translateX(${planIndex * 100}%)`}}
								/>
								{PLANS.map((plan) => (
									<button
										key={plan.id}
										type="button"
										role="tab"
										className={b('seg-btn', {active: selectedPlan === plan.id})}
										onClick={() => setSelectedPlan(plan.id)}
									>
										{plan.popular && (
											<span className={b('seg-badge')}>{t('pro_page.plan.popular')}</span>
										)}
										{plan.bestValue && (
											<span className={b('seg-badge', {bestValue: true})}>{t('pro_page.plan.best_value')}</span>
										)}
										<span className={b('seg-label')}>{t(`pro_page.plan.${plan.id}_label`)}</span>
										<span className={b('seg-sublabel')}>{t(plan.sublabelKey)}</span>
									</button>
								))}
							</div>

							{/* Price block */}
							<div className={b('price-block')}>
								<div className={b('price-row')}>
									{(() => {
										const rawPriceStr = dynamicPrice || t(activePlan.priceKey);
										const numMatch = rawPriceStr.match(/[\d.,]+/);
										const numToken = numMatch?.[0] || '0';
										const numIdx = numMatch?.index ?? 0;
										const pricePrefix = rawPriceStr.slice(0, numIdx);
										const priceSuffix = rawPriceStr.slice(numIdx + numToken.length);
										// Son . veya , + 1-2 digit ondalik ayraci. "1.234,56" / "49,99" / "49.99" / "49"
										const decMatch = numToken.match(/[.,](\d{1,2})$/);
										const decStr = decMatch?.[1] || '';
										const decimalSep = decMatch?.[0]?.[0] || '';
										const intPart = decMatch
											? numToken.slice(0, -decMatch[0].length).replace(/[.,]/g, '')
											: numToken.replace(/[.,]/g, '');
										const intNum = parseInt(intPart || '0', 10);
										// Grouping separator decimal'in tersi (TR: "," → "."; US: "." → ",")
										const groupSep = decimalSep === ',' ? '.' : ',';
										return (
											<span className={b('price-main')}>
												{pricePrefix}
												<CountUp
													key={selectedPlan + (dynamicPrice || '')}
													from={0}
													to={intNum}
													duration={0.4}
													decimals={0}
													separator={intNum >= 1000 ? groupSep : ''}
												/>
												{decStr && `${decimalSep}${decStr}`}
												{priceSuffix}
											</span>
										);
									})()}
									{activePlan.id !== 'lifetime' && (
										<span className={b('price-cycle')}>{t(activePlan.cycleLabelKey)}</span>
									)}
								</div>
								<div className={b('price-detail')}>{t(activePlan.detailKey)}</div>
								{activePlan.hasTrial && (
									<span className={b('trial-pill')}>
										<Sparkle weight="fill" />
										{t(activePlan.trialKey)}
									</span>
								)}
								{!dynamicPrice && (
									<div className={b('price-region-hint')}>{t('pro_page.plan.region_hint')}</div>
								)}
							</div>

							{/* Notice banners */}
							{iapCancellation && isIapPro && (
								<div className={b('notice', {warn: true})}>
									<Warning weight="fill" />
									<span>{t('pro_page.iap.cancellation_notice', {date: expiryLabel || ''})}</span>
								</div>
							)}
							{iapBillingIssue && isIapPro && (
								<div className={b('notice', {danger: true})}>
									<Warning weight="fill" />
									<div>
										<div>{t('pro_page.iap.billing_issue_notice')}</div>
										{native && (
											<button type="button" className={b('notice-action')} onClick={handleManage}>
												{t('pro_page.iap.update_payment')}
											</button>
										)}
									</div>
								</div>
							)}
							{iapPaused && (
								<div className={b('notice', {warn: true})}>
									<Warning weight="fill" />
									<span>{t('pro_page.iap.paused_notice')}</span>
								</div>
							)}

							{/* CTA area */}
							{!canPurchase && userIsPro && !isIapPro ? (
								<div className={b('card-active')}>
									<CheckCircle weight="fill" />
									<span>{t('pro_page.iap.granted_pro', {date: expiryLabel || ''})}</span>
								</div>
							) : isCurrentPlan ? (
								<div className={b('card-active')}>
									<CheckCircle weight="fill" />
									<span>{t('pro_page.current_plan')}</span>
								</div>
							) : native ? (
								<>
									<button
										className={b('cta')}
										disabled={purchasing || lifetimeBlocked || ownedLifetimeBlocked || downgradeBlocked || isCrossPlatform || !selectedPackage}
										onClick={handlePurchase}
									>
										{!purchasing && <ArrowRight weight="bold" />}
										{purchaseButtonLabel()}
									</button>
									{lifetimeBlocked && (
										<p className={b('cta-hint')}>
											<Info weight="fill" />
											<span>{t('pro_page.iap.lifetime_needs_cancel_hint')}</span>
										</p>
									)}
									{ownedLifetimeBlocked && (
										<p className={b('cta-hint')}>
											<Info weight="fill" />
											<span>{t('pro_page.iap.already_lifetime_hint')}</span>
										</p>
									)}
									{downgradeBlocked && (
										<p className={b('cta-hint')}>
											<Info weight="fill" />
											<span>{t('pro_page.iap.downgrade_blocked_hint', {date: expiryLabel || ''})}</span>
										</p>
									)}
									{isIapPro && !lifetimeBlocked && (
										<button type="button" className={b('secondary-link')} onClick={handleManage}>
											{t('pro_page.iap.manage_subscription')}
										</button>
									)}
									<button
										type="button"
										className={b('secondary-link')}
										onClick={handleRestore}
										disabled={restoring}
									>
										{restoring ? t('pro_page.iap.restoring') : t('pro_page.iap.restore')}
									</button>
								</>
							) : (
								<>
									<button className={b('cta')} disabled>
										{t('pro_page.mobile_only_cta')}
									</button>
									<p className={b('fine-note')}>
										<Info weight="fill" />
										<span>{t('pro_page.mobile_only_hint')}</span>
									</p>
								</>
							)}

							<div className={b('legal-links')}>
								<button type="button" className={b('legal-link')} onClick={() => openInAppBrowser('https://zktimer.app/terms')}>
									{t('landing_footer.terms')}
								</button>
								<span className={b('legal-sep')}>·</span>
								<button type="button" className={b('legal-link')} onClick={() => openInAppBrowser('https://zktimer.app/privacy')}>
									{t('landing_footer.privacy')}
								</button>
							</div>
						</div>

						{/* RIGHT — feature list */}
						<div className={b('billing-right')}>
							<div className={b('features-head')}>
								<span className={b('features-eyebrow')}>{t('pro_page.features_head_label')}</span>
								<span className={b('features-count')}>
									{t('pro_page.features_head_count', {count: totalFeatures})}
								</span>
							</div>

							<div className={b('feature-hero-card')}>
								<div className={b('feature-hero-icon')}>
									<Check weight="bold" />
								</div>
								<div className={b('feature-hero-text')}>
									<strong>{t('pro_page.all_basic_included')}</strong>
									<span>{t('pro_page.all_basic_desc')}</span>
								</div>
							</div>

							<div className={b('features-list')}>
								<ul className={b('features-col')}>
									{PRO_FEATURES.slice(0, 8).map((key) => (
										<FeatureRow key={key} featureKey={key} />
									))}
								</ul>
								<ul className={b('features-col')}>
									{PRO_FEATURES.slice(8).map((key) => (
										<FeatureRow key={key} featureKey={key} />
									))}
									{UPCOMING_FEATURES.map((key) => (
										<FeatureRow key={key} featureKey={key} upcoming />
									))}
								</ul>
							</div>
						</div>
					</div>
				</div>

			</section>

			{/* ── STORIES ───────────────────────────────────── */}
			<section className={b('stories')}>
				<div className={b('stories-head')}>
					<span className={b('eyebrow')}>
						<span className={b('eyebrow-dot')} />
						{t('pro_page.stories_eyebrow')}
					</span>
					<h2 className={b('stories-title')}>
						{t('pro_page.stories_title_1')} <em>{t('pro_page.stories_title_em')}</em>{t('pro_page.stories_title_2')}
					</h2>
					<p className={b('stories-sub')}>{t('pro_page.stories_sub')}</p>
				</div>
				<div className={b('stories-grid')}>
					{TESTIMONIALS.map((testimonial) => (
						<div key={testimonial.name} className={b('story')}>
							<p className={b('story-quote')}>{t(testimonial.quoteKey)}</p>
							<div className={b('story-who')}>
								<div
									className={b('story-avatar')}
									style={{background: `linear-gradient(135deg, ${testimonial.colorA}, ${testimonial.colorB})`}}
								>
									{testimonial.initials}
								</div>
								<div className={b('story-who-text')}>
									<div className={b('story-name')}>{testimonial.name}</div>
								</div>
							</div>
						</div>
					))}
				</div>
			</section>

			{/* ── FINALE ────────────────────────────────────── */}
			<section className={b('finale')}>
				<div className={b('finale-card')}>
					<span className={b('eyebrow')}>
						<span className={b('eyebrow-dot')} />
						{t('pro_page.finale_eyebrow')}
					</span>
					<h2 className={b('finale-title')}>
						{t('pro_page.finale_title_1')} <em>{t('pro_page.finale_title_em')}</em>{t('pro_page.finale_title_2')}
					</h2>
					<p className={b('finale-sub')}>{t('pro_page.finale_sub')}</p>
					<a href="#billing" className={b('finale-cta')}>
						{t('pro_page.finale_cta')}
						<ArrowRight weight="bold" />
					</a>
					<div className={b('finale-footnote')}>
						<span><Check weight="bold" />{t('pro_page.finale_no_card')}</span>
						<span><Check weight="bold" />{t('pro_page.finale_secure')}</span>
					</div>
				</div>
			</section>

			{/* ── PROMO ─────────────────────────────────────── */}
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
	);
}

export default function ProPage() {
	return (
		<FeatureGuard feature="pro_enabled" pageNameKey="pro_page.hero_title">
			<ProPageContent />
		</FeatureGuard>
	);
}
