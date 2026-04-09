import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import './HeroSection.scss';
import block from '../../../../styles/bem';
import Button from '../../../common/button/Button';
import LanguageSwitcher from '../../../common/language_switcher/LanguageSwitcher';
import HeroCube from './HeroCube';
import ParticleCanvas from './ParticleCanvas';
import TextType from '../text_type/TextType';
import { staggerContainer, fadeInUp, fadeInLeft, fadeInRight, hoverScale, tapScale } from '../motion-variants';
import { APP_STORE_URL, PLAY_STORE_URL } from '../../../../util/store-links';
import { isNative } from '../../../../util/platform';

const b = block('welcome-hero');

export default function HeroSection() {
	const { t } = useTranslation();
	const native = isNative();

	const storeCta = (
		<div className={b('store-badges')}>
			<motion.a
				href={APP_STORE_URL}
				target="_blank"
				rel="noopener noreferrer"
				whileHover={hoverScale}
				whileTap={tapScale}
				className={b('store-badge', { type: 'apple' })}
				aria-label={t('welcome_hero.app_store_alt')}
			>
				<img src="/public/images/landing/app-store-badge.svg" alt={t('welcome_hero.app_store_alt')} />
			</motion.a>
			<motion.a
				href={PLAY_STORE_URL}
				target="_blank"
				rel="noopener noreferrer"
				whileHover={hoverScale}
				whileTap={tapScale}
				className={b('store-badge', { type: 'google' })}
				aria-label={t('welcome_hero.google_play_alt')}
			>
				<img src="/public/images/landing/google-play-badge.svg" alt={t('welcome_hero.google_play_alt')} />
			</motion.a>
		</div>
	);

	const authButtons = (
		<>
			{!native && (
				<div className={b('auth-divider')}>
					<span className={b('auth-divider-line')} />
					<span className={b('auth-divider-text')}>{t('welcome_hero.or_continue_web')}</span>
					<span className={b('auth-divider-line')} />
				</div>
			)}
			<div className={b('auth-buttons')}>
				<motion.div whileHover={hoverScale} whileTap={tapScale}>
					<Button
						large
						glow
						onClick={() => (window.location.href = '/signup')}
					>
						{t('welcome_hero.cta_signup')}
					</Button>
				</motion.div>
				<motion.div whileHover={hoverScale} whileTap={tapScale}>
					<Button
						primary
						large
						glow
						onClick={() => (window.location.href = '/login')}
					>
						{t('welcome_hero.cta_login')}
					</Button>
				</motion.div>
			</div>
		</>
	);

	return (
		<section className={b()}>
			{/* Particle Background */}
			<ParticleCanvas />

			{/* Background Ambience */}
			<div className={b('background')}>
				<div className={b('background-orb', { position: 'left' })} />
				<div className={b('background-orb', { position: 'right' })} />
			</div>

			{/* Mobile Language Switcher */}
			<div className={b('mobile-lang')}>
				<LanguageSwitcher />
			</div>

			{/* Hero Content — 2-column layout */}
			<div className={b('content')}>
				{/* Text Side */}
				<motion.div
					className={b('text-side')}
					variants={staggerContainer}
					initial="hidden"
					animate="visible"
				>
					{/* Logo — scale yerine fadeInUp kullanildi (framer-motion SSR scale leading-zero bug'i) */}
					<motion.div className={b('logo-wrap')} variants={fadeInUp}>
						<img
							src="/public/images/zkt-logo.png"
							alt="ZKT-Timer Logo"
							className={b('logo')}
						/>
					</motion.div>

					{/* Headline */}
					<motion.h1 className={b('title')} variants={fadeInLeft}>
						{t('welcome_hero.title_start')}{' '}
						<span className={b('title-highlight')}>
							<TextType
								text={[
									t('welcome_hero.title_highlight'),
									t('welcome_hero.title_highlight_2'),
									t('welcome_hero.title_highlight_3'),
									t('welcome_hero.title_highlight_4'),
								]}
								typingSpeed={60}
								deletingSpeed={35}
								pauseDuration={2500}
								initialDelay={1200}
								loop
								showCursor
								cursorCharacter="|"
							/>
						</span>
					</motion.h1>

					{/* Desktop CTA — Store badges (native'da gizli, zaten uygulama ici) */}
					{!native && (
						<motion.div className={b('actions-desktop')} variants={fadeInUp}>
							{storeCta}
						</motion.div>
					)}
				</motion.div>

				{/* Cube Side */}
				<motion.div
					className={b('cube-side')}
					variants={fadeInRight}
					initial="hidden"
					animate="visible"
				>
					<HeroCube />
				</motion.div>

				{/* Mobile CTA — Store badges (native'da gizli) + auth butonlari */}
				<motion.div
					className={b('actions-mobile')}
					variants={fadeInUp}
					initial="hidden"
					animate="visible"
				>
					{!native && storeCta}
					{authButtons}
				</motion.div>
			</div>

			{/* Scroll Indicator */}
			<motion.div
				className={b('scroll-indicator')}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				transition={{ delay: 1.5, duration: 0.8 }}
			>
				<div className={b('scroll-arrow')} />
			</motion.div>
		</section>
	);
}
