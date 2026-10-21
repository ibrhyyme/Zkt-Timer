import React, {useState} from 'react';
import './ProPage.scss';
import {useTranslation} from 'react-i18next';
import {
	Crown, Check, CaretDown, Info, CheckCircle, Warning, ArrowRight, AppleLogo,
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
import {PRO_FEATURE_GROUPS, PRO_FEATURES, ProFeature} from '../../lib/pro_features';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import OfflineGuard from '../common/offline_guard/OfflineGuard';
import {isNative, isAndroidNative} from '../../util/platform';
import {getApiBase} from '../../util/api-base';
import {getOfferings, purchasePackage, restorePurchases, showManageSubscriptions} from '../../lib/iap';
import {computeYearlyPricing, splitPriceString} from './pricing';
import {openInAppBrowser} from '../../util/external-link';
import {GetIapStatusDocument, GetIapStatusQuery} from '../../@types/generated/graphql';
import {useGeneral} from '../../util/hooks/useGeneral';
import MobileNav from '../layout/nav/mobile_nav/MobileNav';
import AccountDropdown from '../layout/nav/account_dropdown/AccountDropdown';
import Button from '../common/button/Button';
import {APP_STORE_URL, PLAY_STORE_URL} from '../../util/store-links';

const b = block('pro-page');

type PlanId = 'monthly' | 'yearly' | 'lifetime';

interface Plan {
	id: PlanId;
	priceKey: string;
	detailKey: string;
	trialKey: string;
	cycleLabelKey: string;
	hasTrial: boolean;
	popular?: boolean;
	bestValue?: boolean;
}

// Yearly first: it is the plan most people pick, so it is preselected and on top.
const PLANS: Plan[] = [
	{
		id: 'yearly',
		priceKey: 'pro_page.plan.yearly_price',
		detailKey: 'pro_page.plan.yearly_detail',
		trialKey: 'pro_page.plan.trial',
		cycleLabelKey: 'pro_page.plan.yearly_cycle',
		hasTrial: true,
		popular: true,
	},
	{
		id: 'monthly',
		priceKey: 'pro_page.plan.monthly_price',
		detailKey: 'pro_page.plan.monthly_detail',
		trialKey: 'pro_page.plan.trial',
		cycleLabelKey: 'pro_page.plan.monthly_cycle',
		hasTrial: true,
	},
	{
		id: 'lifetime',
		priceKey: 'pro_page.plan.lifetime_price',
		detailKey: 'pro_page.plan.lifetime_detail',
		trialKey: 'pro_page.plan.no_trial',
		cycleLabelKey: 'pro_page.plan.lifetime_cycle',
		hasTrial: false,
		bestValue: true,
	},
];

// The feature list itself lives in client/lib/pro_features.ts so this page and
// PlanCompareModal cannot drift apart. The advertised count follows its length.
// Numbering runs on across groups, so each section knows where it starts.
const FEATURE_SECTIONS = (() => {
	let start = 0;
	return PRO_FEATURE_GROUPS.map((group) => {
		const items = PRO_FEATURES.filter((feature) => feature.group === group);
		const section = {group, items, start};
		start += items.length;
		return section;
	});
})();

/**
 * The Google Play mark in its own four colours. Store badges are recognised by their
 * logos, and Google's is multicoloured; Apple's mark is single colour by its guidelines,
 * so that one stays a plain glyph.
 */
function GooglePlayMark() {
	return (
		<svg viewBox="0 0 24 24" aria-hidden focusable="false">
			<path d="M3.6 2.2 13.4 12l-9.8 9.8c-.4-.2-.6-.7-.6-1.2V3.4c0-.5.2-1 .6-1.2Z" fill="#4285F4" />
			<path d="M16.8 8.6 13.4 12 3.6 2.2c.3-.2.8-.2 1.2 0l12 6.4Z" fill="#34A853" />
			<path d="M16.8 15.4 4.8 21.8c-.4.2-.9.2-1.2 0l9.8-9.8 3.4 3.4Z" fill="#EA4335" />
			<path d="m16.8 8.6 3.6 1.9c1.1.6 1.1 2.4 0 3l-3.6 1.9-3.4-3.4 3.4-3.4Z" fill="#FBBC04" />
		</svg>
	);
}

function FeatureRow({feature, index}: {feature: ProFeature; index: number}) {
	const [open, setOpen] = useState(false);
	const {t} = useTranslation();
	const Icon = feature.icon || Check;

	return (
		<li className={b('feature', {open})}>
			<button type="button" className={b('feature-row')} onClick={() => setOpen(!open)} aria-expanded={open}>
				<span className={b('feature-index')}>{String(index + 1).padStart(2, '0')}</span>
				<span className={b('feature-icon')}>
					<Icon weight="duotone" />
				</span>
				<span className={b('feature-label')}>
					{t(feature.titleKey)}
				</span>
				<CaretDown weight="bold" className={b('feature-caret')} />
			</button>
			{open && (
				<div className={b('feature-detail')}>
					<p>{t(feature.descKey)}</p>
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
	const [promoOpen, setPromoOpen] = useState(false);
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
	// Store prices only exist on native (offerings stays empty on web). Without them
	// the static i18n prices are shown, with a hint that the store price may differ.
	const hasStorePrices = PLANS.every((plan) => !!offerings[plan.id]?.product?.priceString);

	// Live per-month price + savings % for the yearly plan, from RevenueCat's actual
	// product data (native only; offerings stays empty on web). Null when unavailable,
	// so the static i18n copy below is used instead.
	const computedYearly = React.useMemo(
		() => computeYearlyPricing(offerings.monthly?.product, offerings.yearly?.product),
		[offerings]
	);

	function planPrice(plan: Plan): string {
		return offerings[plan.id]?.product?.priceString || t(plan.priceKey);
	}

	function planDetail(plan: Plan): string {
		if (plan.id === 'monthly') {
			const price = offerings.monthly?.product?.priceString;
			if (price) return t('pro_page.plan.monthly_detail_dynamic', {price});
		} else if (plan.id === 'yearly' && computedYearly) {
			return t('pro_page.plan.yearly_detail_dynamic', {
				perMonth: computedYearly.perMonthString,
				savings: computedYearly.savingsPercent,
			});
		}
		return t(plan.detailKey);
	}

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
					<span className={b('mark')}>
						<Crown weight="fill" />
						Pro
					</span>
					<h2 className={b('subscribed-via-title')}>
						{t('pro_page.subscribed_via_title', {platform: platformLabel})}
					</h2>
					{planId && (
						<dl className={b('subscribed-via-plan')}>
							<dt>{t(`pro_page.plan.${planId}_label`)}</dt>
							{expiryLabel && planId !== 'lifetime' && (
								<dd>{t('pro_page.pro_expires', {date: expiryLabel})}</dd>
							)}
						</dl>
					)}
					<p className={b('subscribed-via-subtitle')}>
						{t('pro_page.subscribed_via_subtitle', {platform: platformLabel})}
					</p>
					<Button
						to="/"
						gray
						noMargin
						text={t('pro_page.subscribed_via_home')}
						icon={<ArrowRight weight="bold" />}
					/>
				</div>
			</div>
		);
	}

	async function syncWithServer() {
		try {
			await fetch(`${getApiBase()}/api/iap/sync`, {method: 'POST', credentials: 'include'});
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
			refetchIap();
			dispatch(getMe());
			// Page reload for instant update of all Pro features (paywall, locked screens, nav badge)
			// — prevents me/Apollo cache inconsistency.
			setTimeout(() => window.location.reload(), 1500);
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
				refetchIap();
				dispatch(getMe());
				// Reload so Pro status is consistent throughout app.
				setTimeout(() => window.location.reload(), 1500);
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

	const totalFeatures = PRO_FEATURES.length;

	const activePrice = planPrice(activePlan);
	const price = splitPriceString(activePrice);

	let status: string;
	if (!userIsPro) status = t('pro_page.basic_hint');
	else if (expiryLabel) status = t('pro_page.pro_expires', {date: expiryLabel});
	else status = t('pro_page.pro_active_desc');

	return (
		<div className={b()}>
			{mobileMode && (
				<div className={b('mobile-header')}>
					<MobileNav />
					<AccountDropdown />
				</div>
			)}

			<div className={b('layout')}>
				<header className={b('intro')}>
					<span className={b('mark')}>
						<Crown weight="fill" />
						Pro
					</span>
					<h1 className={b('title')}>{t('pro_page.intro_title')}</h1>
					<p className={b('lede')}>{t('pro_page.intro_lede', {count: totalFeatures})}</p>
				</header>

				<aside className={b('buy')} id="billing">
					<div className={b('panel')}>
						<div className={b('panel-head')}>
							<h2 className={b('panel-title')}>
								<Crown weight="fill" />
								{t('pro_page.hero_title')}
							</h2>
							<p className={b('status', {pro: userIsPro})}>{status}</p>
						</div>

						<div className={b('panel-body')}>
							<div className={b('plans')} role="radiogroup" aria-label={t('pro_page.hero_title')}>
								{PLANS.map((plan) => {
									const active = selectedPlan === plan.id;
									return (
										<button
											key={plan.id}
											type="button"
											role="radio"
											aria-checked={active}
											className={b('plan', {active})}
											onClick={() => setSelectedPlan(plan.id)}
										>
											<span className={b('plan-radio')} aria-hidden />
											<span className={b('plan-text')}>
												<span className={b('plan-name')}>
													{t(`pro_page.plan.${plan.id}_label`)}
													{plan.popular && <span className={b('plan-tag', {solid: true})}>{t('pro_page.plan.popular')}</span>}
													{plan.bestValue && <span className={b('plan-tag')}>{t('pro_page.plan.best_value')}</span>}
												</span>
												<span className={b('plan-detail')}>{planDetail(plan)}</span>
											</span>
										</button>
									);
								})}
							</div>

							<div className={b('price')} aria-live="polite">
								<span className={b('price-amount')}>
									{price.prefix.trim() && <span className={b('price-currency')}>{price.prefix.trim()}</span>}
									<CountUp
										key={selectedPlan + activePrice}
										from={0}
										to={price.integer}
										duration={0.4}
										decimals={0}
										separator={price.integer >= 1000 ? price.groupSep : ''}
									/>
									{price.decimals && <span className={b('price-decimals')}>{price.decimalSep}{price.decimals}</span>}
									{price.suffix.trim() && <span className={b('price-currency')}>{price.suffix.trim()}</span>}
								</span>
								{activePlan.id !== 'lifetime' && (
									<span className={b('price-cycle')}>{t(activePlan.cycleLabelKey)}</span>
								)}
							</div>

							<div className={b('terms')}>
								{activePlan.hasTrial && (
									<p className={b('terms-line')}>
										<CheckCircle weight="fill" />
										<span>{t(activePlan.trialKey)}</span>
									</p>
								)}
								{!hasStorePrices && (
									<p className={b('terms-line', {muted: true})}>
										<Info />
										<span>{t('pro_page.plan.region_hint')}</span>
									</p>
								)}
							</div>

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

							<div className={b('actions')}>
								{!canPurchase && userIsPro && !isIapPro ? (
									<div className={b('active')}>
										<CheckCircle weight="fill" />
										<span>{t('pro_page.iap.granted_pro', {date: expiryLabel || ''})}</span>
									</div>
								) : isCurrentPlan ? (
									<div className={b('active')}>
										<CheckCircle weight="fill" />
										<span>{t('pro_page.current_plan')}</span>
									</div>
								) : native ? (
									<>
										<Button
											primary
											large
											fullWidth
											noMargin
											loading={purchasing}
											disabled={purchasing || lifetimeBlocked || ownedLifetimeBlocked || downgradeBlocked || isCrossPlatform || !selectedPackage}
											onClick={handlePurchase}
											text={purchaseButtonLabel()}
										/>
										{lifetimeBlocked && (
											<p className={b('hint')}>
												<Info />
												<span>{t('pro_page.iap.lifetime_needs_cancel_hint')}</span>
											</p>
										)}
										{ownedLifetimeBlocked && (
											<p className={b('hint')}>
												<Info />
												<span>{t('pro_page.iap.already_lifetime_hint')}</span>
											</p>
										)}
										{downgradeBlocked && (
											<p className={b('hint')}>
												<Info />
												<span>{t('pro_page.iap.downgrade_blocked_hint', {date: expiryLabel || ''})}</span>
											</p>
										)}
									</>
								) : (
									<>
										<p className={b('store-lead')}>{t('pro_page.mobile_only_hint')}</p>
										<div className={b('stores')}>
											<a className={b('store')} href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
												<AppleLogo weight="fill" />
												App Store
											</a>
											<a className={b('store')} href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
												<GooglePlayMark />
												Google Play
											</a>
										</div>
									</>
								)}
							</div>
						</div>

						<div className={b('panel-foot')}>
							{native && isIapPro && !lifetimeBlocked && (
								<button type="button" className={b('text-btn')} onClick={handleManage}>
									{t('pro_page.iap.manage_subscription')}
								</button>
							)}
							{native && (
								<button type="button" className={b('text-btn')} onClick={handleRestore} disabled={restoring}>
									{restoring ? t('pro_page.iap.restoring') : t('pro_page.iap.restore')}
								</button>
							)}
							<button type="button" className={b('text-btn')} onClick={() => openInAppBrowser('https://zktimer.app/terms')}>
								{t('landing_footer.terms')}
							</button>
							<button type="button" className={b('text-btn')} onClick={() => openInAppBrowser('https://zktimer.app/privacy')}>
								{t('landing_footer.privacy')}
							</button>
						</div>
					</div>

					<div className={b('promo', {open: promoOpen})}>
						{promoOpen ? (
							<>
								<label className={b('promo-label')} htmlFor="pro-promo-code">{t('pro_page.promo.title')}</label>
								<div className={b('promo-form')}>
									<input
										id="pro-promo-code"
										className={b('promo-input')}
										placeholder={t('pro_page.promo.placeholder')}
										value={promoCode}
										autoFocus
										autoComplete="off"
										onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
										onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
									/>
									<Button
										gray
										noMargin
										loading={redeeming}
										onClick={handleRedeem}
										disabled={redeeming || !promoCode.trim()}
										text={t('pro_page.promo.redeem')}
									/>
								</div>
							</>
						) : (
							<button type="button" className={b('text-btn')} onClick={() => setPromoOpen(true)}>
								{t('pro_page.promo.title')}
							</button>
						)}
					</div>
				</aside>

				<section className={b('features')}>
					<div className={b('features-head')}>
						<h2 className={b('features-title')}>{t('pro_page.features_head_label')}</h2>
						<span className={b('features-count')}>
							{t('pro_page.features_head_count', {count: totalFeatures})}
						</span>
					</div>
					<p className={b('features-base')}>
						<Check weight="bold" />
						{t('pro_page.basic_included')}
					</p>
					{FEATURE_SECTIONS.map((section) => (
						<div key={section.group} className={b('group')}>
							<h3 className={b('group-title')}>
								{t(`pro_page.groups.${section.group}`)}
								<span className={b('group-count')}>{section.items.length}</span>
							</h3>
							<ol className={b('feature-list')} start={section.start + 1}>
								{section.items.map((feature, i) => (
									<FeatureRow key={feature.key} feature={feature} index={section.start + i} />
								))}
							</ol>
						</div>
					))}
				</section>
			</div>
		</div>
	);
}

export default function ProPage() {
	return (
		<OfflineGuard>
			<FeatureGuard feature="pro_enabled" pageNameKey="pro_page.hero_title">
				<ProPageContent />
			</FeatureGuard>
		</OfflineGuard>
	);
}
