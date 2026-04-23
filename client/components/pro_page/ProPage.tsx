import React, {useEffect, useState} from 'react';
import './ProPage.scss';
import {useTranslation} from 'react-i18next';
import {Crown, Check, CaretDown, Info, Ticket, CheckCircle, Sparkle, Warning} from 'phosphor-react';
import {useDispatch} from 'react-redux';
import {gql, useQuery} from '@apollo/client';
import block from '../../styles/bem';
import ElectricBorder from '../common/electric_border/ElectricBorder';
import {gqlMutate} from '../api';
import {openModal} from '../../actions/general';
import {toastError, toastSuccess} from '../../util/toast';
import PromoSuccessModal from './PromoSuccessModal';
import PlanCompareModal from './PlanCompareModal';
import {useMe} from '../../util/hooks/useMe';
import {isPro} from '../../lib/pro';
import FeatureGuard from '../common/page_disabled/FeatureGuard';
import {isNative, isAndroidNative} from '../../util/platform';
import {getOfferings, purchasePackage, restorePurchases, showManageSubscriptions} from '../../lib/iap';
import {GetIapStatusDocument, GetIapStatusQuery} from '../../@types/generated/graphql';

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
	const [selectedPlan, setSelectedPlan] = useState<PlanId>('yearly');
	const [promoCode, setPromoCode] = useState('');
	const [redeeming, setRedeeming] = useState(false);
	const [purchasing, setPurchasing] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [offerings, setOfferings] = useState<IapOfferings>({});
	const [debugInfo, setDebugInfo] = useState<string>('');

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

	// Native platformda offerings yukle
	useEffect(() => {
		if (!native) return;
		const iosKey = (window as any).__REVENUECAT_IOS_KEY__ || '';
		const androidKey = (window as any).__REVENUECAT_ANDROID_KEY__ || '';
		setDebugInfo(
			`native=true, iosKeyLen=${iosKey.length}, androidKeyLen=${androidKey.length}, loading...`
		);
		getOfferings()
			.then((off) => {
				setOfferings(off);
				const dbg = (window as any).__IAP_DEBUG__ || {};
				setDebugInfo(
					`keys=${iosKey.length}/${androidKey.length} pkgs=${Object.keys(off).join(',') || 'EMPTY'} all=[${dbg.allKeys?.join(',') || 'NONE'}] pickedId=${dbg.pickedOfferingId || 'null'} pkgCount=${dbg.pkgCount || 0} types=${dbg.pkgTypes || 'none'}${dbg.error ? ' ERR=' + dbg.error : ''}`
				);
			})
			.catch((err) => {
				setDebugInfo(`getOfferings error: ${err?.message || String(err)}`);
			});
	}, [native, userIsPro]);

	// Aktif Pro aboneliği olan kullanıcının seçili planı mevcut planı olsun
	useEffect(() => {
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

	function openCompare() {
		dispatch(openModal(<PlanCompareModal />));
	}

	function currentPlanId(): PlanId | null {
		if (!currentIapProductId) return null;
		if (currentIapProductId.endsWith('monthly')) return 'monthly';
		if (currentIapProductId.endsWith('yearly')) return 'yearly';
		if (currentIapProductId.endsWith('lifetime')) return 'lifetime';
		return null;
	}

	// Secili plan kullanicinin mevcut plani mi?
	const isCurrentPlan = isIapPro && currentPlanId() === selectedPlan;
	const hasActiveSubscription = isIapPro && currentPlanId() !== null && currentPlanId() !== 'lifetime';
	// Lifetime x aktif abonelik catismasi: aktif aboneligi olan kullanici lifetime alamaz
	const lifetimeBlocked = selectedPlan === 'lifetime' && hasActiveSubscription;
	// Cross-platform: abonelik baska platformdan alinmissa bu platformdan satin alinamaz
	const subscriptionPlatform = iapStatus?.iap_platform;
	const currentNativePlatform = native ? (isAndroidNative() ? 'android' : 'ios') : null;
	const isCrossPlatform = native && isIapPro && !!subscriptionPlatform && subscriptionPlatform !== currentNativePlatform;
	// Lifetime sahibi aylik/yillik alamaz; yillik abone ayliga dusamaz
	const isLifetimeOwner = isIapPro && currentPlanId() === 'lifetime';
	const ownedLifetimeBlocked = isLifetimeOwner && selectedPlan !== 'lifetime';
	const downgradeBlocked = isIapPro && currentPlanId() === 'yearly' && selectedPlan === 'monthly';
	const iapPaused = iapStatus?.iap_paused_until;

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
			// Upgrade/downgrade Android icin eski product id + isUpgrade belirle
			const oldProductId = currentIapProductId || undefined;
			const monthlyPkg = offerings.monthly?.product?.price || 0;
			const yearlyPkg = offerings.yearly?.product?.price || 0;
			const yearlyMonthly = yearlyPkg / 12;
			// Upgrade: monthly -> yearly, monthly -> lifetime, yearly -> lifetime
			// Downgrade: yearly -> monthly
			let isUpgrade = true;
			if (currentIapProductId?.endsWith('yearly') && selectedPlan === 'monthly') {
				isUpgrade = false;
			} else if (currentIapProductId?.endsWith('monthly') && selectedPlan === 'yearly') {
				isUpgrade = yearlyMonthly > monthlyPkg ? false : true; // yillik aylik basina daha ucuz olmali
			}

			await purchasePackage(selectedPackage, oldProductId, isUpgrade);
			toastSuccess(t('pro_page.iap.purchase_success'));
			// Webhook birkac saniye surebilir — refetch + kisa delay
			setTimeout(() => refetchIap(), 2500);
		} catch (err: any) {
			const code = err?.code || '';
			const msg = String(err?.message || '').toLowerCase();
			if (code === 'PURCHASE_CANCELLED' || msg.includes('cancel')) {
				// Kullanici iptal etti, sessizce gec
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
				setTimeout(() => refetchIap(), 2000);
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

							{debugInfo && native && Object.keys(offerings).length === 0 && (
								<div style={{padding: '8px', background: 'rgba(255,200,0,0.15)', border: '1px solid orange', fontSize: '11px', color: '#fff', margin: '8px 0', wordBreak: 'break-word'}}>
									DEBUG: {debugInfo}
								</div>
							)}

							<div className={b('price-block')}>
								<div className={b('price-amount')}>
									{dynamicPrice || t(activePlan.priceKey)}
								</div>
								<div className={b('price-detail')}>{t(activePlan.detailKey)}</div>
								<div className={b('price-trial', {muted: !activePlan.hasTrial})}>
									{activePlan.hasTrial && <Sparkle weight="fill" />}
									<span>{t(activePlan.trialKey)}</span>
								</div>
								{!dynamicPrice && (
									<div className={b('price-region-hint')}>{t('pro_page.plan.region_hint')}</div>
								)}
							</div>

							{/* Bildirim bannerlari */}
							{iapCancellation && isIapPro && (
								<div className={b('notice', {warn: true})}>
									<Warning weight="fill" />
									<span>
										{t('pro_page.iap.cancellation_notice', {
											date: expiryLabel || '',
										})}
									</span>
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
							{isCrossPlatform && subscriptionPlatform && (
								<div className={b('notice', {warn: true})}>
									<Info weight="fill" />
									<span>{t('pro_page.iap.cross_platform_notice', {
										platform: subscriptionPlatform === 'android' ? 'Android' : 'iOS',
									})}</span>
								</div>
							)}
							{iapPaused && (
								<div className={b('notice', {warn: true})}>
									<Warning weight="fill" />
									<span>{t('pro_page.iap.paused_notice')}</span>
								</div>
							)}

							{/* CTA buton tercihi */}
							{!canPurchase && userIsPro && !isIapPro ? (
								// Admin/promo ile Pro — satin alma kapali
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
