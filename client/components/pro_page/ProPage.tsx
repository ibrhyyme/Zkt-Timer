import React, {useState} from 'react';
import './ProPage.scss';
import {useTranslation} from 'react-i18next';
import {Crown, Check, CaretDown, Info, Ticket, CheckCircle} from 'phosphor-react';
import {useDispatch} from 'react-redux';
import {gql} from '@apollo/client';
import block from '../../styles/bem';
import ElectricBorder from '../common/electric_border/ElectricBorder';
import {gqlMutate} from '../api';
import {openModal} from '../../actions/general';
import {toastError} from '../../util/toast';
import PromoSuccessModal from './PromoSuccessModal';
import {useMe} from '../../util/hooks/useMe';
import {isPro} from '../../lib/pro';

const b = block('pro-page');

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

const PRO_FEATURES = [
	'sync',
	'smart_cube_analysis',
	'trainer_smart_cube',
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
	pro?: boolean;
}

function FeatureRow({featureKey, pro}: FeatureRowProps) {
	const [open, setOpen] = useState(false);
	const {t} = useTranslation();
	const prefix = pro ? 'pro_page.features' : 'pro_page.basic_features';

	return (
		<div className={b('feature', {open, pro})}>
			<button type="button" className={b('feature-row')} onClick={() => setOpen(!open)}>
				<Check weight="bold" className={b('feature-check', {pro})} />
				<span className={b('feature-label', {pro})}>{t(`${prefix}.${featureKey}.title`)}</span>
				<CaretDown weight="bold" className={b('feature-caret')} />
			</button>
			{open && (
				<div className={b('feature-detail', {pro})}>
					<p>{t(`${prefix}.${featureKey}.desc`)}</p>
				</div>
			)}
		</div>
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

export default function ProPage() {
	const {t} = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const userIsPro = isPro(me);
	const [promoCode, setPromoCode] = useState('');
	const [redeeming, setRedeeming] = useState(false);

	const proExpiresAt = (me as any)?.pro_expires_at || (me as any)?.premium_expires_at;
	const expiryLabel = proExpiresAt
		? new Date(proExpiresAt).toLocaleDateString(undefined, {year: 'numeric', month: 'long', day: 'numeric'})
		: null;

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

	return (
		<div className={b()}>
			<div className={b('container')}>
				{/* Hero */}
				<div className={b('hero')}>
					<h1 className={b('hero-title')}>{t('pro_page.hero_title')}</h1>
					<p className={b('hero-subtitle')}>{t('pro_page.subtitle')}</p>
				</div>

				{/* Cards */}
				<div className={b('cards')}>
					{/* Basic Card */}
					<div className={b('card', {basic: true})}>
						<div className={b('card-top')}>
							<h2 className={b('card-name')}>Basic</h2>
							<p className={b('card-desc')}>{t('pro_page.basic_desc')}</p>
							<div className={b('card-price-block')}>
								<span className={b('card-price')}>{t('pro_page.free')}</span>
							</div>
						</div>

						<div className={b('card-includes')}>
							<span className={b('card-includes-label')}>{t('pro_page.whats_included')}</span>
							<div className={b('card-features')}>
								{BASIC_FEATURES.map((key) => (
									<FeatureRow key={key} featureKey={key} />
								))}
							</div>
							<div className={b('card-hint')}>
								<Info weight="fill" />
								<span>{t('pro_page.click_hint')}</span>
							</div>
						</div>

						<button className={b('card-cta', {basic: true})} disabled>
							{userIsPro ? 'Basic' : t('pro_page.current_plan')}
						</button>
					</div>

					{/* Pro Card */}
					<ElectricBorder
						color="#7c3aed"
						speed={0.6}
						chaos={0.1}
						borderRadius={20}
						className={b('electric-wrap')}
					>
						<div className={b('card', {pro: true})}>
							<div className={b('pro-badge')}>
								<Crown weight="fill" />
								<span>PRO</span>
							</div>

							<div className={b('card-top')}>
								<h2 className={b('card-name', {pro: true})}>Pro</h2>
								<p className={b('card-desc', {pro: true})}>
									{userIsPro ? t('pro_page.pro_active_desc') : t('pro_page.pro_desc')}
								</p>
								{userIsPro && expiryLabel && (
									<p className={b('card-expiry')}>{t('pro_page.pro_expires', {date: expiryLabel})}</p>
								)}
								{!userIsPro && (
									<div className={b('card-price-block')}>
										<span className={b('card-price', {pro: true})}>{t('pro_page.coming_soon')}</span>
									</div>
								)}
							</div>

							<div className={b('card-includes', {pro: true})}>
								<span className={b('card-includes-label', {pro: true})}>
									{t('pro_page.whats_included')}
								</span>
								<div className={b('card-features')}>
									<div className={b('feature', {pro: true})}>
										<div className={b('feature-row')}>
											<Check weight="bold" className={b('feature-check', {pro: true})} />
											<span className={b('feature-label', {pro: true})}>
												{t('pro_page.all_basic_included')}
											</span>
										</div>
									</div>
									{PRO_FEATURES.map((key) => (
										<FeatureRow key={key} featureKey={key} pro />
									))}
								</div>
								<div className={b('card-hint', {pro: true})}>
									<Info weight="fill" />
									<span>{t('pro_page.click_hint')}</span>
								</div>
							</div>

							{userIsPro ? (
								<div className={b('card-active')}>
									<CheckCircle weight="fill" />
									<span>{t('pro_page.current_plan')}</span>
								</div>
							) : (
								<button className={b('card-cta', {pro: true})} disabled>
									{t('pro_page.coming_soon')}
								</button>
							)}
						</div>
					</ElectricBorder>
				</div>

				{/* Promo Code */}
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
